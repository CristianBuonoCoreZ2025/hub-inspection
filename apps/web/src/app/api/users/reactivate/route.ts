import { NextRequest, NextResponse } from "next/server";
import { reactivateUser } from "@/services/users-ops-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/reactivate
 * Body: { profileId }
 *
 * Reactiva un usuario eliminado o desactivado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: "profileId es obligatorio" }, { status: 400 });
    }

    const result = await reactivateUser(profileId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "reactivate user error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-reactivate", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
