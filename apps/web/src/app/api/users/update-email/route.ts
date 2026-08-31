import { NextRequest, NextResponse } from "next/server";
import { updateUserEmail } from "@/services/users-ops-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/update-email
 * Body: { profileId, newEmail }
 *
 * Actualiza el email de un usuario en AMBAS tablas:
 *   - auth.users.email (vía Supabase admin API)
 *   - profiles.email
 *
 * Sin esto, editar el email desde el frontend solo cambiaba profiles.email
 * y el usuario no podía entrar con el nuevo correo.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, newEmail } = body;

    if (!profileId || !newEmail) {
      return NextResponse.json(
        { error: "profileId y newEmail son obligatorios" },
        { status: 400 }
      );
    }

    const result = await updateUserEmail(profileId, newEmail);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "update user email error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-update-email", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
