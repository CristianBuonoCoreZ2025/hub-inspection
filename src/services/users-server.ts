import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { validateRut } from "@/lib/rut-validator";
import type { InviteUserInput } from "@/types";

/**
 * Servicio server-only para operaciones de usuarios que requieren
 * el admin client de Supabase (service role key).
 *
 * Este archivo NO debe importarse desde client components.
 */

/**
 * Mapa de zona horaria por defecto según código de país (ISO 3166-1 alpha-2).
 * Si el país no está en el mapa, se usa UTC.
 */
const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  AR: "America/Argentina/Buenos_Aires",
  BO: "America/La_Paz",
  BR: "America/Sao_Paulo",
  CL: "America/Santiago",
  CO: "America/Bogota",
  EC: "America/Guayaquil",
  GY: "America/Guyana",
  PY: "America/Asuncion",
  PE: "America/Lima",
  SR: "America/Paramaribo",
  UY: "America/Montevideo",
  VE: "America/Caracas",
};

/**
 * Invita un usuario a la plataforma:
 * 1. Valida unicidad de email y RUT
 * 2. Calcula el cliente principal (más antiguo de los marcados)
 * 3. Deriva la zona horaria del país
 * 4. Crea el usuario en Supabase Auth con email_confirm=true
 * 5. El trigger handle_new_user crea el perfil automáticamente
 * 6. El trigger sync_user_clients_on_profile_change crea el user_client principal
 * 7. setUserClients agrega los clientes adicionales (upsert, no borra)
 * 8. Envía email de invitación con link a /forgot-password
 *
 * El usuario recibe el email, va a /forgot-password, ingresa su email,
 * recibe el código OTP y setea su propia contraseña.
 */
export async function inviteUser(
  input: InviteUserInput
): Promise<{ user: { id: string; email: string } }> {
  const adminClient = createAdminClient();

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const middleName = input.middleName?.trim() || "";
  const lastName = input.lastName.trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  // ── Validación de unicidad de email ──
  const { data: existingEmail } = await adminClient
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingEmail) {
    throw new Error("Ya existe un usuario con ese correo electrónico");
  }

  // ── Validación de RUT (si se ingresó) ──
  const rut = input.rut?.trim() || "";
  if (rut) {
    // Validar DV si el país es Chile
    const { data: country } = await adminClient
      .from("countries")
      .select("code")
      .eq("id", input.countryId)
      .maybeSingle();
    if (country?.code === "CL" && !validateRut(rut)) {
      throw new Error("El RUT chileno ingresado no tiene un dígito verificador válido");
    }

    // Unicidad de RUT
    const { data: existingRut } = await adminClient
      .from("profiles")
      .select("id")
      .eq("rut", rut)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingRut) {
      throw new Error("Ya existe un usuario con ese RUT");
    }
  }

  // ── Calcular cliente principal (más antiguo de los marcados) ──
  let companyId: string | null = null;
  let timezone = "UTC";
  if (input.clientIds.length > 0) {
    const { data: companies } = await adminClient
      .from("companies")
      .select("id, created_at")
      .in("id", input.clientIds)
      .order("created_at", { ascending: true })
      .limit(1);
    if (companies && companies.length > 0) {
      companyId = companies[0].id;
    }
  }

  // ── Derivar zona horaria del país ──
  const { data: countryData } = await adminClient
    .from("countries")
    .select("code")
    .eq("id", input.countryId)
    .maybeSingle();
  if (countryData?.code && TIMEZONE_BY_COUNTRY[countryData.code]) {
    timezone = TIMEZONE_BY_COUNTRY[countryData.code];
  }

  // ── Generar contraseña temporal aleatoria ──
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

  // ── Metadata para el trigger handle_new_user ──
  const metadata: Record<string, string> = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    role: input.role,
    country_id: input.countryId,
    timezone,
  };
  if (companyId) {
    metadata.company_id = companyId;
  }

  // ── Crear el usuario con admin API ──
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (createError) {
    throw new Error(`Supabase Auth: ${createError.message || JSON.stringify(createError)}`);
  }

  if (!userData.user) {
    throw new Error("No se pudo crear el usuario: respuesta inválida de Supabase");
  }

  const userId = userData.user.id;

  // ── Upsert del perfil (el trigger debería haberlo creado, pero aseguramos datos) ──
  const { error: upsertError } = await adminClient
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        role: input.role,
        company_id: companyId,
        country_id: input.countryId,
        timezone,
        rut: rut || null,
        phone: input.phone?.trim() || null,
        is_active: true,
      },
      { onConflict: "user_id" }
    );
  if (upsertError) {
    logger.warn("Upsert profile en inviteUser falló (el trigger debería haberlo creado)", {
      component: "users-server",
      action: "inviteUser.upsert",
      metadata: { error: upsertError.message, email },
    });
  }

  // ── Clientes adicionales (upsert, no borrar) ──
  // El trigger sync_user_clients_on_profile_change ya insertó el principal.
  // Aquí insertamos el resto (ON CONFLICT DO NOTHING evita duplicar el principal).
  if (input.clientIds.length > 0) {
    const rows = input.clientIds.map((cid) => ({ user_id: userId, company_id: cid }));
    const { error: ucError } = await adminClient
      .from("user_clients")
      .upsert(rows, { onConflict: "user_id,company_id", ignoreDuplicates: true });
    if (ucError) {
      logger.warn("Error al insertar user_clients adicionales", {
        component: "users-server",
        action: "inviteUser.user_clients",
        metadata: { error: ucError.message, userId },
      });
    }
  }

  // ── Enviar email de invitación ──
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/forgot-password`,
    });
  } catch (inviteErr) {
    logger.warn("Email de invitación falló", {
      component: "users-server",
      action: "inviteUser.email",
      metadata: { error: String(inviteErr), email },
    });
  }

  return { user: { id: userId, email } };
}
