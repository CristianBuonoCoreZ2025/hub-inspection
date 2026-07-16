import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAll, fetchById, updateRow, insertRow, deleteRow } from "@/lib/supabase/db";
import type { Profile, InviteUserInput, UserClient, UserSecondaryRole, SecondaryRole } from "@/types";

const PROFILE_FIELDS =
  "id, user_id, company_id, full_name, first_name, last_name, email, phone, rut, country_id, avatar_url, role, is_active, created_at, updated_at, user_clients:user_clients!user_clients_user_id_fkey(id, user_id, company_id, created_at, company:companies!user_clients_company_id_fkey(id, name, slug)), secondary_roles:user_secondary_roles!user_secondary_roles_profile_id_fkey(id, profile_id, role, company_id, created_at, updated_at, company:companies!user_secondary_roles_company_id_fkey(id, name))";

export async function getUsers(companyId?: string) {
  const options: Parameters<typeof fetchAll>[1] = {
    select: PROFILE_FIELDS,
    order: { column: "full_name", ascending: true },
  };
  if (companyId) {
    options.eq = { company_id: companyId };
  }
  return fetchAll<Profile & { user_clients: UserClient[]; secondary_roles: UserSecondaryRole[] }>("profiles", options);
}

export async function getUserById(id: string) {
  return fetchById<Profile & { secondary_roles: UserSecondaryRole[] }>("profiles", id, PROFILE_FIELDS);
}

// ═══ Obtener usuarios por rol (perfil principal o secundario) para una empresa ═══
export async function getUsersByRoleForCompany(
  role: string,
  companyId?: string
): Promise<{ id: string; full_name: string; email: string; role: string; source: "primary" | "secondary" | "internal" }[]> {
  const { data, error } = await getSupabaseClient().rpc("get_users_by_role_for_company", {
    p_role: role,
    p_company_id: companyId || null,
  });
  if (error) throw new Error(`get_users_by_role_for_company: ${error.message}`);
  return (data || []) as { id: string; full_name: string; email: string; role: string; source: "primary" | "secondary" | "internal" }[];
}

export async function getUsersByRolesForCompany(
  roles: string[],
  companyId?: string
): Promise<{ id: string; full_name: string; email: string; role: string; source: "primary" | "secondary" | "internal" }[]> {
  const { data, error } = await getSupabaseClient().rpc("get_users_by_roles_for_company", {
    p_roles: roles,
    p_company_id: companyId || null,
  });
  if (error) throw new Error(`get_users_by_roles_for_company: ${error.message}`);
  return (data || []) as { id: string; full_name: string; email: string; role: string; source: "primary" | "secondary" | "internal" }[];
}

// ═══ Gestionar perfiles secundarios ═══
export async function addSecondaryRole(profileId: string, role: SecondaryRole, companyId?: string): Promise<UserSecondaryRole> {
  return insertRow<UserSecondaryRole>("user_secondary_roles", {
    profile_id: profileId,
    role,
    company_id: companyId || null,
  }, "id, profile_id, role, company_id, created_at, updated_at, company:companies!user_secondary_roles_company_id_fkey(id, name)");
}

export async function removeSecondaryRole(id: string): Promise<void> {
  await deleteRow("user_secondary_roles", id);
}

export async function getSecondaryRoles(profileId: string): Promise<UserSecondaryRole[]> {
  return fetchAll<UserSecondaryRole>("user_secondary_roles", {
    select: "id, profile_id, role, company_id, created_at, updated_at, company:companies!user_secondary_roles_company_id_fkey(id, name)",
    eq: { profile_id: profileId },
    order: { column: "role", ascending: true },
  });
}

export async function inviteUser(input: InviteUserInput & { company_id: string }) {
  const supabase = getSupabaseClient();

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

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: tempPassword,
    options: { data: metadata },
  });

  if (error) {
    throw new Error(`Supabase Auth: ${error.message || JSON.stringify(error)}`);
  }

  // El trigger handle_new_user crea el perfil automáticamente.
  // Si no hay session (email verification requerida), buscar el perfil por email.
  let userId: string;
  if (!data.session) {
    const profiles = await fetchAll<Profile>("profiles", {
      select: "id, user_id, email, full_name, role, company_id",
      eq: { email: input.email },
    });
    if (profiles.length === 0) {
      throw new Error(
        "No se pudo crear el usuario. El trigger de perfil no respondio. " +
        "Verifica que el trigger handle_new_user exista."
      );
    }
    userId = profiles[0].user_id;
  } else {
    if (!data.user) {
      throw new Error("No se pudo crear el usuario: session invalida");
    }
    userId = data.user.id;

    // Upsert profile para asegurar datos correctos
    const supabaseUpsert = getSupabaseClient();
    const { error: upsertError } = await supabaseUpsert
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email: input.email,
          full_name: input.fullName,
          role: input.role,
          company_id: input.company_id || null,
          is_active: true,
        },
        { onConflict: "user_id" }
      );
    if (upsertError) {
      // No es crítico — el trigger ya debería haber creado el perfil
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
  const set: Record<string, unknown> = {};
  if (input.full_name !== undefined) set.full_name = input.full_name;
  if (input.first_name !== undefined) set.first_name = input.first_name;
  if (input.last_name !== undefined) set.last_name = input.last_name;
  if (input.email !== undefined) set.email = input.email;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.rut !== undefined) set.rut = input.rut;
  if (input.country_id !== undefined) set.country_id = input.country_id;
  if (input.role !== undefined) set.role = input.role;
  if (input.is_active !== undefined) set.is_active = input.is_active;

  return updateRow<Profile>("profiles", id, set, PROFILE_FIELDS);
}

export async function deactivateUser(id: string) {
  return updateUser(id, { is_active: false });
}
