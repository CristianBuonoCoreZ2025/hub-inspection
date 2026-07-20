import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { lockDocument, isDocumentLockedByOther } from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/documents/[docId]/lock
 *
 * Bloquea un documento para edición offline por el usuario actual.
 * Devuelve error 409 si ya está bloqueado por otro usuario.
 *
 * Devuelve: { document } — el documento actualizado con el lock
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const user = await requireCurrentUser();

    // Verificar si ya está locked por otro
    const lockStatus = await isDocumentLockedByOther(docId, user.id);
    if (lockStatus.locked) {
      return NextResponse.json(
        {
          error: `El documento está bloqueado por ${lockStatus.lockedBy?.full_name || "otro usuario"}`,
          lockedBy: lockStatus.lockedBy,
          expiresAt: lockStatus.expiresAt,
        },
        { status: 409 }
      );
    }

    const document = await lockDocument(docId, user.id);
    logger.info("Documento bloqueado para edición offline", {
      component: "document-lock",
      action: "lock",
      metadata: { docId, userId: user.id },
    });

    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API lock document error", err as Error);
    return NextResponse.json({ error: "Error al bloquear documento" }, { status: 500 });
  }
}
