import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { restoreDocumentVersion, getDocumentById, hasPdf } from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/documents/[docId]/restore
 *
 * Restaura una versión anterior del documento creando una nueva versión
 * con el mismo archivo. No modifica la versión original.
 *
 * Devuelve: { document } — la nueva versión creada
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string; docId: string }> }
) {
  try {
    const { actionId, docId } = await params;
    const user = await requireCurrentUser();

    // Verificar que el documento existe y pertenece a la gestión
    const doc = await getDocumentById(docId);
    if (!doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }
    if (doc.claim_action_id !== actionId) {
      return NextResponse.json({ error: "El documento no pertenece a esta gestión" }, { status: 400 });
    }

    // No se puede restaurar si la gestión ya tiene PDF (está cerrada)
    const hasPdfDoc = await hasPdf(actionId);
    if (hasPdfDoc) {
      return NextResponse.json(
        { error: "No se puede restaurar una versión porque la gestión ya tiene un PDF final (cerrada)" },
        { status: 400 }
      );
    }

    // No se puede restaurar un PDF (los PDFs son finales)
    if (doc.file_type === "pdf") {
      return NextResponse.json({ error: "No se puede restaurar un PDF" }, { status: 400 });
    }

    const document = await restoreDocumentVersion(docId, user.id);
    logger.info("Versión de documento restaurada", {
      component: "document-restore",
      action: "restore",
      metadata: { actionId, docId, newVersion: document.version, userId: user.id },
    });

    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API restore document error", err as Error);
    return NextResponse.json({ error: "Error al restaurar versión" }, { status: 500 });
  }
}
