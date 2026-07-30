import { NextRequest, NextResponse } from "next/server";
import { updateOwnProfile } from "@/services/users-ops-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/me
 * Body: { phone?, rut?, avatar_url? }
 *
 * Actualiza el perfil PROPIO del usuario autenticado.
 * Solo phone, rut, avatar_url. No email, role, company_id, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, rut, avatar_url } = body;

    const result = await updateOwnProfile({ phone, rut, avatar_url });
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "update own profile error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-me", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
