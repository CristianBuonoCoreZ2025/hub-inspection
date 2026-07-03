import { NextRequest, NextResponse } from "next/server";
import { adminGraphqlRequest } from "@/lib/nhost/admin-graphql";
import { presignEvidenceUrls } from "@/lib/nhost/storage-presigned";
import { logger } from "@/lib/logger";

/**
 * API route que devuelve las evidencias de una sesión de inspección
 * con presigned URLs (accesibles sin auth en el navegador).
 *
 * Usada por el tab de Evidencias del inspector para mostrar imágenes
 * sin depender de permisos de storage.files para el rol 'user'.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ evidences: [] }, { status: 400 });
    }

    const query = `
      query GetEvidences($sessionId: uuid!) {
        inspection_evidences(
          where: { session_id: { _eq: $sessionId } }
          order_by: { created_at: desc }
        ) {
          id url type description category created_at
        }
      }
    `;
    const data = await adminGraphqlRequest<{ inspection_evidences: any[] }>(
      query,
      { sessionId }
    );

    const evidences = data.inspection_evidences || [];
    await presignEvidenceUrls(evidences);

    return NextResponse.json({ evidences });
  } catch (err) {
    logger.error("API /api/inspection/evidences error", err as Error, {
      component: "inspection-evidences-route",
      action: "get.evidences",
    });
    return NextResponse.json(
      { evidences: [], error: "No se pudieron cargar las evidencias" },
      { status: 500 }
    );
  }
}
