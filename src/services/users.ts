import { getNhostClient } from "@/lib/nhost/client";
import { graphqlRequest } from "@/lib/nhost/graphql";
import type { Profile, InviteUserInput } from "@/types";

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
`;

export async function getUsers(companyId?: string) {
  const where = companyId
    ? `{ company_id: { _eq: "${companyId}" } }`
    : `{ is_active: { _eq: true } }`;
  const query = `
    query GetUsers {
      profiles(where: ${where}, order_by: { full_name: asc }) {
        ${PROFILE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ profiles: Profile[] }>(query);
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

  const tempPassword = Math.random().toString(36).slice(-12);

  const response = await nhost.auth.signUpEmailPassword({
    email: input.email,
    password: tempPassword,
    options: {
      metadata: {
        full_name: input.fullName,
        role: input.role,
        company_id: input.company_id,
      },
    },
  });

  // Si requiere verificacion de email, session es null pero el trigger
  // handle_new_user ya creo el perfil con la metadata automaticamente.
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
        "Verifica en Nhost Console que la verificacion de email este desactivada " +
        "o que el trigger handle_new_user exista."
      );
    }
    return { user: { id: data.profiles[0].user_id, email: input.email } };
  }

  const session = response.body.session;
  if (!session?.user) {
    throw new Error("No se pudo crear el usuario: session invalida");
  }

  // El trigger handle_new_user ya creo el perfil, pero nos aseguramos
  // de que tenga company_id y role correctos (upsert).
  const mutation = `
    mutation UpsertProfile($object: profiles_insert_input!) {
      insert_profiles_one(object: $object, on_conflict: { constraint: profiles_user_id_key, update_columns: [full_name, role, company_id, is_active] }) {
        ${PROFILE_FIELDS}
      }
    }
  `;
  await graphqlRequest(mutation, {
    object: {
      user_id: session.user.id,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      company_id: input.company_id,
      is_active: true,
    },
  });

  return { user: session.user };
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
