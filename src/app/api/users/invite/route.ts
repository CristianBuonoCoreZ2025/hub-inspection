import { NextRequest, NextResponse } from "next/server";
import { inviteUser } from "@/services/users-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/invite
 * Body: { firstName, middleName?, lastName, email, countryId, role, clientIds?, phone?, rut? }
 *
 * Invita un usuario a la plataforma:
 * 1. Valida unicidad de email y RUT
 * 2. Calcula el cliente principal (más antiguo de los marcados)
 * 3. Crea el usuario en Supabase Auth (email_confirm=true)
 * 4. El trigger handle_new_user crea el perfil
 * 5. El trigger sync_user_clients_on_profile_change crea el user_client principal
 * 6. Se insertan los clientes adicionales (upsert)
 * 7. Envía email de invitación con link a /forgot-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, middleName, lastName, email, countryId, role, clientIds, phone, rut } = body;

    if (!email || !firstName || !lastName || !countryId || !role) {
      return NextResponse.json(
        { error: "Faltan datos: firstName, lastName, email, countryId y role son obligatorios" },
        { status: 400 }
      );
    }

    const result = await inviteUser({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      middleName: middleName?.trim() || "",
      lastName: lastName.trim(),
      countryId,
      role,
      clientIds: clientIds || [],
      phone: phone || "",
      rut: rut || "",
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "invite user error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-invite", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
