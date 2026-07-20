import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { unlockDocument, getDocumentById } from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/documents/[docId]/unlock
 *
 * Desbloquea un documento. Solo el usuario que lo bloqueó puede desbloquearlo
 * (los admins usan /force-unlock).
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

    // Verificar que el usuario es quien tiene el lock
    const doc = await getDocumentById(docId);
    if (!doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (doc.locked_by && doc.locked_by !== user.id) {
      return NextResponse.json(
        { error: "Solo el usuario que bloqueó el documento puede desbloquearlo. Use force-unlock si es admin." },
        { status: 403 }
      );
    }

    const document = await unlockDocument(docId);
    logger.info("Documento desbloqueado", {
      component: "document-lock",
      action: "unlock",
      metadata: { docId, userId: user.id },
    });

    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API unlock document error", err as Error);
    return NextResponse.json({ error: "Error al desbloquear documento" }, { status: 500 });
  }
}
