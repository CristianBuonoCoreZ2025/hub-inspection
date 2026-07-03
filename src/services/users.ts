import { getNhostClient } from "@/lib/nhost/client";
import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Profile, InviteUserInput, UserClient } from "@/types";

const PROFILE_FIELDS = `
  id
  user_id
  company_id
  full_name
  email
  phone
  avatar_url
  role
  is_active
  created_at
  updated_at
  user_clients {
    id
    user_id
    company_id
    created_at
    company {
      id
      name
      slug
    }
  }
`;

export async function getUsers(companyId?: string) {
  const where = companyId
    ? `{ company_id: { _eq: "${companyId}" } }`
    : `{}`;
  const query = `
    query GetUsers {
      profiles(where: ${where}, order_by: { full_name: asc_nulls_last }) {
        ${PROFILE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ profiles: (Profile & { user_clients: UserClient[] })[] }>(query);
  return data.profiles;
}

export async function getUserById(id: string) {
  const query = `
    query GetUserById($id: uuid!) {
      profiles_by_pk(id: $id) {
        ${PROFILE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ profiles_by_pk: Profile }>(query, { id });
  return data.profiles_by_pk;
}

export async function inviteUser(input: InviteUserInput & { company_id: string }) {
  const nhost = getNhostClient();

  // Generar contraseña temporal aleatoria (el usuario la cambiará via OTP)
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

  // company_id vacío no debe enviarse (causa error de cast UUID en el trigger)
  const metadata: Record<string, string> = {
    full_name: input.fullName,
    role: input.role,
  };
  if (input.company_id) {
    metadata.company_id = input.company_id;
  }

  const response = await nhost.auth.signUpEmailPassword({
    email: input.email,
    password: tempPassword,
    options: { metadata },
  });

  // Verificar si Nhost Auth devolvió un error
  const body = response.body as { session?: unknown; error?: { message?: string } | null };
  if (body.error) {
    throw new Error(`Nhost Auth: ${body.error.message || JSON.stringify(body.error)}`);
  }

  // El trigger handle_new_user crea el perfil automáticamente.
  // Si no hay session (email verification requerida), buscar el perfil por email.
  let userId: string;
  if (!response.body.session) {
    const query = `
      query GetProfileByEmail($email: String!) {
        profiles(where: { email: { _eq: $email } }) {
          id user_id email full_name role company_id
        }
      }
    `;
    const data = await graphqlRequest<{ profiles: Profile[] }>(query, { email: input.email });
    if (data.profiles.length === 0) {
      throw new Error(
        "No se pudo crear el usuario. El trigger de perfil no respondio. " +
        "Verifica en Nhost Console que el trigger handle_new_user exista."
      );
    }
    userId = data.profiles[0].user_id;
  } else {
    const session = response.body.session;
    if (!session?.user) {
      throw new Error("No se pudo crear el usuario: session invalida");
    }
    userId = session.user.id;

    // Upsert profile para asegurar datos correctos
    const mutation = `
      mutation UpsertProfile($object: profiles_insert_input!) {
        insert_profiles_one(object: $object, on_conflict: { constraint: profiles_user_id_key, update_columns: [full_name, role, company_id, is_active] }) {
          ${PROFILE_FIELDS}
        }
      }
    `;
    await graphqlRequest(mutation, {
      object: {
        user_id: userId,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        company_id: input.company_id || null,
        is_active: true,
      },
    });

    // Cerrar la sesión temporal del admin (no queremos dejar sesión abierta)
    const currentSession = nhost.getUserSession();
    if (currentSession?.refreshTokenId) {
      await nhost.auth.signOut({ refreshToken: currentSession.refreshTokenId });
    }
  }

  // Enviar código de activación al usuario via nuestro sistema propio
  // El usuario debe ir a /forgot-password, ingresar su email, recibir el código y setear su contraseña
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/send-reset-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email }),
    });
  } catch {
    // Si falla el envío, no es crítico - el usuario puede usar /forgot-password manualmente
  }

  return { user: { id: userId, email: input.email } };
}

export async function updateUser(id: string, input: Partial<Profile>) {
  const mutation = `
    mutation UpdateUser($id: uuid!, $set: profiles_set_input!) {
      update_profiles_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${PROFILE_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  if (input.full_name !== undefined) set.full_name = input.full_name;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.role !== undefined) set.role = input.role;
  if (input.is_active !== undefined) set.is_active = input.is_active;

  const data = await graphqlRequest<{ update_profiles_by_pk: Profile }>(mutation, { id, set });
  return data.update_profiles_by_pk;
}

export async function deactivateUser(id: string) {
  return updateUser(id, { is_active: false });
}
