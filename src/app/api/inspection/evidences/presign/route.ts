import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { presignInspectionFile, type InspectionFileType } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/evidences/presign
 *
 * Genera una URL presigned para subir un archivo grande (ej: grabación de video)
 * directamente a R2 desde el cliente, evitando el límite de body size de Vercel.
 *
 * Flujo:
 *  1. Cliente llama este endpoint con { sessionId, mimeType, ext, originalName, source }
 *  2. Server genera key + fileCode + presigned URL
 *  3. Cliente sube via PUT a la presigned URL
 *  4. Cliente llama /api/inspection/evidences/register para registrar en BD
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mimeType, ext, originalName, source } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }
    if (!mimeType || typeof mimeType !== "string") {
      return NextResponse.json({ error: "Falta mimeType" }, { status: 400 });
    }

    // Validar sesión existe
    const supabase = createAdminClient();
    const { data: sessionRow, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select("id, status, claim_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    if (sessionRow.status === "completed" || sessionRow.status === "cancelled") {
      return NextResponse.json({ error: "Inspección finalizada" }, { status: 403 });
    }

    // Resolver usuario actual (para captured_by)
    let userId: string | null = null;
    try {
      const serverClient = await createServerClient();
      const { data: { user } } = await serverClient.auth.getUser();
      if (user?.id) userId = user.id;
    } catch {
      // sin sesión — continúa sin userId
    }

    const fileType: InspectionFileType = "EVI";
    const extValue = typeof ext === "string" && ext ? ext : ".bin";

    const { presignedUrl, url, key, fileCode, ctx } = await presignInspectionFile(
      sessionId,
      mimeType,
      fileType,
      extValue,
    );

    logger.info("Presign generado", {
      component: "inspection-evidences-presign",
      action: "presign.success",
      metadata: { sessionId, fileCode, key, mimeType },
    });

    return NextResponse.json({
      presignedUrl,
      url,
      key,
      fileCode,
      claimId: sessionRow.claim_id,
      userId,
      ctx: { claimActionId: ctx.claimActionId, actionCode: ctx.actionCode, liquidationNumber: ctx.liquidationNumber },
    });
  } catch (err) {
    logger.error("API /api/inspection/evidences/presign error", err as Error, {
      component: "inspection-evidences-presign",
      action: "presign.error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar URL de subida" },
      { status: 500 },
    );
  }
}
