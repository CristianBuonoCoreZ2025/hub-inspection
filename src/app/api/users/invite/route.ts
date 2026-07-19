import { NextRequest, NextResponse } from "next/server";
import { inviteUser } from "@/services/users-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/invite
 * Body: { email, fullName, role, company_id, clientIds? }
 *
 * Invita un usuario a la plataforma:
 * 1. Crea el usuario en Supabase Auth (email_confirm=true)
 * 2. Hace upsert del perfil
 * 3. Envía email de invitación con link a /forgot-password
 *
 * El usuario recibe el email, va a /forgot-password, ingresa su email,
 * recibe el código OTP y setea su propia contraseña.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, role, company_id, clientIds } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json(
        { error: "Faltan datos: email, fullName y role son obligatorios" },
        { status: 400 }
      );
    }

    const result = await inviteUser({
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      role,
      company_id: company_id || "",
      clientIds: clientIds || [],
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
