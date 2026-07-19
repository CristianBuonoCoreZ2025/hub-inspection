import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { InviteUserInput } from "@/types";

/**
 * Servicio server-only para operaciones de usuarios que requieren
 * el admin client de Supabase (service role key).
 *
 * Este archivo NO debe importarse desde client components.
 */

/**
 * Invita un usuario a la plataforma:
 * 1. Crea el usuario en Supabase Auth con email_confirm=true
 * 2. Hace upsert del perfil con company_id y role
 * 3. Envía email de invitación con link a /forgot-password
 *
 * El usuario recibe el email, va a /forgot-password, ingresa su email,
 * recibe el código OTP y setea su propia contraseña.
 */
export async function inviteUser(input: InviteUserInput & { company_id: string }) {
  const adminClient = createAdminClient();

  // Generar contraseña temporal aleatoria (el usuario la cambiará via OTP)
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

  // Metadata para el trigger handle_new_user
  const metadata: Record<string, string> = {
    full_name: input.fullName,
    role: input.role,
  };
  if (input.company_id) {
    metadata.company_id = input.company_id;
  }

  // Crear el usuario con admin API (no requiere email verification del usuario)
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true, // Marcar email como confirmado — el usuario ya fue invitado
    user_metadata: metadata,
  });

  if (createError) {
    throw new Error(`Supabase Auth: ${createError.message || JSON.stringify(createError)}`);
  }

  if (!userData.user) {
    throw new Error("No se pudo crear el usuario: respuesta inválida de Supabase");
  }

  const userId = userData.user.id;

  // El trigger handle_new_user crea el perfil automáticamente.
  // Upsert para asegurar datos correctos (company_id, role, etc.)
  const { error: upsertError } = await adminClient
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
    logger.warn("Upsert profile en inviteUser falló (el trigger debería haberlo creado)", {
      component: "users-server",
      action: "inviteUser.upsert",
      metadata: { error: upsertError.message, email: input.email },
    });
  }

  // Enviar email de invitación con link a /forgot-password
  // para que el usuario setee su propia contraseña
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await adminClient.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: `${siteUrl}/forgot-password`,
    });
  } catch (inviteErr) {
    // Si falla el envío del email, no es crítico — el admin puede reenviar
    logger.warn("Email de invitación falló", {
      component: "users-server",
      action: "inviteUser.email",
      metadata: { error: String(inviteErr), email: input.email },
    });
  }

  return { user: { id: userId, email: input.email } };
}
