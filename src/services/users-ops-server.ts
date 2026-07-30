import "server-only";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Servicio server-only para eliminación, reactivación y autogestión
 * de perfil de usuario. Requiere admin client (service role key).
 */

/**
 * Elimina (suave) un usuario:
 * 1. Verifica con can_delete_user que no tenga registros asociados
 * 2. Marca profiles.deleted_at = now() + is_active = false (vía RPC)
 * 3. Banea al usuario en auth.users (ban_duration largo)
 */
export async function deleteUser(profileId: string): Promise<{ success: boolean }> {
  const adminClient = createAdminClient();

  // 1. Verificar que se puede eliminar
  const { data: canDelete, error: canError } = await adminClient.rpc("can_delete_user", {
    p_profile_id: profileId,
  });
  if (canError) throw new Error(`can_delete_user: ${canError.message}`);
  if (!canDelete) {
    throw new Error("No se puede eliminar: el usuario tiene registros asociados (siniestros, gestiones, inspecciones, etc.). Desactivar en su lugar.");
  }

  // 2. Eliminación suave vía RPC
  const { error: softError } = await adminClient.rpc("soft_delete_user", {
    p_profile_id: profileId,
  });
  if (softError) throw new Error(`soft_delete_user: ${softError.message}`);

  // 3. Banear en auth.users
  const { data: profile } = await adminClient
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (profile?.user_id) {
    const { error: banError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
      ban_duration: "87600h", // 10 años
    });
    if (banError) {
      logger.warn("No se pudo banear al usuario en auth.users", {
        component: "users-server-ops",
        action: "deleteUser.ban",
        metadata: { error: banError.message, userId: profile.user_id },
      });
    }
  }

  return { success: true };
}

/**
 * Reactiva un usuario eliminado o desactivado:
 * 1. Limpia profiles.deleted_at + is_active = true (vía RPC)
 * 2. Desbanea en auth.users
 */
export async function reactivateUser(profileId: string): Promise<{ success: boolean }> {
  const adminClient = createAdminClient();

  // 1. Reactivar vía RPC
  const { error: reactError } = await adminClient.rpc("reactivate_user", {
    p_profile_id: profileId,
  });
  if (reactError) throw new Error(`reactivate_user: ${reactError.message}`);

  // 2. Desbanear en auth.users
  const { data: profile } = await adminClient
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (profile?.user_id) {
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
      ban_duration: "none",
    });
    if (unbanError) {
      logger.warn("No se pudo desbanear al usuario en auth.users", {
        component: "users-server-ops",
        action: "reactivateUser.unban",
        metadata: { error: unbanError.message, userId: profile.user_id },
      });
    }
  }

  return { success: true };
}

/**
 * Verifica si un usuario se puede eliminar (sin registros asociados).
 */
export async function canDeleteUser(profileId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.rpc("can_delete_user", {
    p_profile_id: profileId,
  });
  if (error) throw new Error(`can_delete_user: ${error.message}`);
  return !!data;
}

/**
 * Actualiza el perfil PROPIO del usuario autenticado.
 * Solo puede tocar: phone, rut, avatar_url.
 * No puede tocar: email, role, company_id, first_name, last_name, country_id.
 *
 * Validaciones:
 * - RUT único (si se ingresa)
 * - RUT con DV si el país es Chile
 */
export async function updateOwnProfile(input: {
  phone?: string;
  rut?: string;
  avatar_url?: string;
}): Promise<{ success: boolean }> {
  // Usar createServerClient (lee cookies) para obtener el usuario autenticado.
  // createAdminClient usa service role key y no tiene sesión del usuario.
  const serverClient = await createServerClient();
  const adminClient = createAdminClient();

  // Obtener el usuario autenticado desde la sesión (cookies)
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Buscar el perfil del usuario (vía admin client para bypass RLS)
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, country_id, rut")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`profile: ${profileError.message}`);
  if (!profile) throw new Error("Perfil no encontrado");

  const set: Record<string, unknown> = {};

  if (input.phone !== undefined) {
    set.phone = input.phone.trim() || null;
  }

  if (input.rut !== undefined) {
    const rut = input.rut.trim();
    if (rut) {
      // Validar DV si el país es Chile
      if (profile.country_id) {
        const { data: country } = await adminClient
          .from("countries")
          .select("code")
          .eq("id", profile.country_id)
          .maybeSingle();
        if (country?.code === "CL") {
          const { validateRut } = await import("@/lib/rut-validator");
          if (!validateRut(rut)) {
            throw new Error("El RUT chileno ingresado no tiene un dígito verificador válido");
          }
        }
      }

      // Unicidad de RUT (excluyendo el propio perfil)
      const { data: existingRut } = await adminClient
        .from("profiles")
        .select("id")
        .eq("rut", rut)
        .neq("id", profile.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (existingRut) {
        throw new Error("Ya existe otro usuario con ese RUT");
      }
    }
    set.rut = rut || null;
  }

  if (input.avatar_url !== undefined) {
    set.avatar_url = input.avatar_url || null;
  }

  if (Object.keys(set).length === 0) {
    return { success: true };
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update(set)
    .eq("id", profile.id);
  if (updateError) throw new Error(`update: ${updateError.message}`);

  return { success: true };
}

/**
 * Actualiza el email de un usuario en AMBAS tablas:
 *   1. auth.users.email (vía admin API updateUserById)
 *   2. profiles.email (vía update)
 *
 * Esto es crítico: si solo se actualiza profiles.email, el usuario
 * no puede entrar con el nuevo email porque Supabase Auth sigue
 * validando contra auth.users.email.
 *
 * Validaciones:
 * - Email nuevo válido
 * - Email nuevo no exista en otro profile (no eliminado)
 * - Email nuevo no exista en otro auth.users
 *
 * @param profileId  ID del profile (profiles.id)
 * @param newEmail   Email nuevo (se normaliza a minúsculas)
 */
export async function updateUserEmail(profileId: string, newEmail: string): Promise<{ success: boolean }> {
  const adminClient = createAdminClient();
  const email = newEmail.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Correo electrónico inválido");
  }

  // 1. Obtener el user_id del profile
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id, email")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw new Error(`profile lookup: ${profileError.message}`);
  if (!profile) throw new Error("Perfil no encontrado");

  // Si el email no cambió, no hacer nada
  if (profile.email?.toLowerCase() === email) {
    return { success: true };
  }

  // 2. Verificar unicidad en profiles (excluyendo el propio y los eliminados)
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .neq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingProfile) {
    throw new Error("Ya existe otro usuario con ese correo electrónico");
  }

  // 3. Verificar unicidad en auth.users (listUsers y buscar)
  //    Supabase admin API no tiene un lookup directo por email, hay que paginar.
  //    Usamos listUsers con el email como filtro aproximado.
  const { data: usersList, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) throw new Error(`listUsers: ${listError.message}`);
  const duplicateAuthUser = (usersList.users || []).find(
    (u) => u.email?.toLowerCase() === email && u.id !== profile.user_id
  );
  if (duplicateAuthUser) {
    throw new Error("Ya existe otro usuario con ese correo en Auth");
  }

  // 4. Actualizar auth.users.email vía admin API
  const { error: authError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
    email,
  });
  if (authError) throw new Error(`auth update: ${authError.message}`);

  // 5. Actualizar profiles.email
  const { error: profError } = await adminClient
    .from("profiles")
    .update({ email, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (profError) throw new Error(`profile update: ${profError.message}`);

  logger.info("Email de usuario actualizado en ambas tablas", {
    component: "users-ops-server",
    action: "updateUserEmail",
    metadata: { profileId, oldEmail: profile.email, newEmail: email },
  });

  return { success: true };
}

