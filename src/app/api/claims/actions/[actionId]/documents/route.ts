import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getClaimActionDocuments, getCurrentDocument } from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * GET /api/claims/actions/[actionId]/documents
 *
 * Lista todas las versiones de documentos de una gestión.
 * Query params:
 *   - current=true → devuelve solo el documento actual
 *
 * Devuelve: { documents: ClaimActionDocument[] } o { document: ClaimActionDocument | null }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params;
    await requireCurrentUser();

    const { searchParams } = new URL(request.url);
    const onlyCurrent = searchParams.get("current") === "true";

    if (onlyCurrent) {
      const document = await getCurrentDocument(actionId);
      return NextResponse.json({ document });
    }

    const documents = await getClaimActionDocuments(actionId);
    return NextResponse.json({ documents });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API list documents error", err as Error);
    return NextResponse.json({ error: "Error al listar documentos" }, { status: 500 });
  }
}
