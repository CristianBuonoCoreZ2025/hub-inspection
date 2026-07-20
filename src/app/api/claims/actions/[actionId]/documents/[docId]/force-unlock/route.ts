import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { forceUnlockDocument } from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/documents/[docId]/force-unlock
 *
 * Fuerza el desbloqueo de un documento (admin).
 * TODO: validar que el usuario tenga rol admin.
 *
 * Devuelve: { document }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const user = await requireCurrentUser();

    // TODO: validar rol admin del usuario
    // Por ahora, cualquier usuario autenticado puede forzar el desbloqueo
    // (la validación de admin se hará cuando se implemente el sistema de roles)

    const document = await forceUnlockDocument(docId);
    logger.info("Documento desbloqueado forzadamente por admin", {
      component: "document-lock",
      action: "force-unlock",
      metadata: { docId, adminId: user.id },
    });

    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API force-unlock document error", err as Error);
    return NextResponse.json({ error: "Error al forzar desbloqueo" }, { status: 500 });
  }
}
