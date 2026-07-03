import { NextRequest, NextResponse } from "next/server";
import { adminGraphqlRequest } from "@/lib/nhost/admin-graphql";
import { presignEvidenceUrls, presignSignatureUrls, presignSketchUrls } from "@/lib/nhost/storage-presigned";
import {
  INSPECTION_LIVE_QUERY,
  attachInspectionNumber,
} from "@/services/inspections";
import { logger } from "@/lib/logger";

/**
 * API route pública (sin auth) que devuelve la sesión de inspección en vivo
 * para la página del magic link `/inspection/[token]`.
 *
 * Usa el admin secret server-side para leer los datos sin requerir permisos
 * anonymous en Hasura (más seguro: no expone evidencias/notas de otros tenants).
 *
 * El control de expiración del link lo hace el cliente con `magic_link_expires_at`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ session: null }, { status: 400 });
    }

    const data = await adminGraphqlRequest<{ inspection_sessions: any[] }>(
      INSPECTION_LIVE_QUERY,
      { token }
    );
    const session = data.inspection_sessions?.[0];
    if (!session) {
      console.log("[inspection/live] token no encontrado:", token);
      return NextResponse.json({ session: null });
    }

    // Log diagnóstico de counts (server-side)
    const counts = {
      id: session.id,
      status: session.status,
      evidences: session.inspection_evidences?.length ?? -1,
      notes: session.inspection_notes?.length ?? -1,
      checklists: session.inspection_checklists?.length ?? -1,
      damages: session.inspection_damages?.length ?? -1,
      chat: session.inspection_chat_messages?.length ?? -1,
    };
    console.log("[inspection/live] counts:", counts);

    // Calcular inspection_number ({liquidation_number}-I-{seq:3})
    try {
      const countQuery = `
        query CountSessionsForClaim($claimId: uuid!, $createdAt: timestamptz!) {
          inspection_sessions(
            where: { claim_id: { _eq: $claimId }, created_at: { _lte: $createdAt } }
          ) { id }
        }
      `;
      const countData = await adminGraphqlRequest<{ inspection_sessions: { id: string }[] }>(
        countQuery,
        {
          claimId: session.claim_id,
          createdAt: session.created_at || new Date().toISOString(),
        }
      );
      attachInspectionNumber(session, countData.inspection_sessions.length);
    } catch {
      attachInspectionNumber(session, 1);
    }

    // Convertir URLs a presigned URLs (acceso público temporal)
    // para que el navegador del cliente (sin auth) pueda cargar las imágenes.
    if (session.inspection_evidences?.length) {
      await presignEvidenceUrls(session.inspection_evidences);
    }
    if (session.inspection_signatures?.length) {
      await presignSignatureUrls(session.inspection_signatures);
    }
    if (session.damage_sketches?.length) {
      await presignSketchUrls(session.damage_sketches);
    }

    return NextResponse.json({ session });
  } catch (err) {
    const error = err as Error;
    logger.error("API /api/inspection/live error", error, {
      component: "inspection-live-route",
      action: "get.live-session",
    });
    // En desarrollo, incluir el mensaje de error real para diagnóstico
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        session: null,
        error: "No se pudo cargar la inspección",
        detail: isDev ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
