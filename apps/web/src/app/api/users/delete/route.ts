import { NextRequest, NextResponse } from "next/server";
import { deleteUser } from "@/services/users-ops-server";
import { logger } from "@/lib/logger";

/**
 * POST /api/users/delete
 * Body: { profileId }
 *
 * Elimina (suave) un usuario. Verifica que no tenga registros
 * asociados antes de marcarlo como eliminado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: "profileId es obligatorio" }, { status: 400 });
    }

    const result = await deleteUser(profileId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "delete user error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-delete", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
