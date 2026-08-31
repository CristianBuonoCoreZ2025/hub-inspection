import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/evidences/register
 *
 * Registra una evidencia en la BD después de que el cliente subió el archivo
 * directamente a R2 via presigned URL.
 *
 * Body: { sessionId, url, fileCode, key, mimeType, originalName, source, fileSize, userId, claimId }
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, url, fileCode, mimeType, originalName, source, fileSize, userId, claimId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta url" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Validar sesión existe y no está cerrada
    const { data: sessionRow } = await supabase
      .from("inspection_sessions")
      .select("id, status, claim_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!sessionRow) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    if (sessionRow.status === "completed" || sessionRow.status === "cancelled") {
      return NextResponse.json({ error: "Inspección finalizada" }, { status: 403 });
    }

    const dbType: "photo" | "video" | "pdf" | "document" = (mimeType || "").startsWith("image/")
      ? "photo"
      : (mimeType || "").startsWith("video/")
        ? "video"
        : mimeType === "application/pdf"
          ? "pdf"
          : "document";

    const validSources = ["upload", "screenshot_inspector", "screenshot_client", "live_video", "geo_map"];
    const sourceValue = source && validSources.includes(source) ? source : "upload";

    // Validar que captured_by exista en profiles; si no, lo dejamos null
    let capturedBy = userId || null;
    if (capturedBy) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", capturedBy)
        .maybeSingle();
      if (!profileRow) {
        logger.warn("Evidence register: userId no existe en profiles", {
          component: "inspection-evidences-register",
          action: "insert.evidence",
          metadata: { userId: capturedBy },
        });
        capturedBy = null;
      }
    }

    const metadata: Record<string, unknown> = {
      originalName: typeof originalName === "string" ? originalName : fileCode,
      fileSize: typeof fileSize === "number" ? fileSize : null,
      mimeType: mimeType || "application/octet-stream",
      fileCode,
      userAgent: request.headers.get("user-agent") || null,
    };

    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: sessionId,
        claim_id: claimId || sessionRow.claim_id || null,
        type: dbType,
        url,
        description: fileCode,
        captured_by: capturedBy,
        captured_at: new Date().toISOString(),
        source: sourceValue,
        metadata,
        lat: null,
        lng: null,
        exif_lat: null,
        exif_lng: null,
        include_in_report: false,
        ai_status: sourceValue === "live_video" ? "skipped" : "deferred",
      })
      .select("id, url, type, description, category, damage_id, created_at, lat, lng, exif_lat, exif_lng, ai_summary, ai_model, ai_status, source")
      .single();

    if (error) {
      logger.error("Evidence register: insert falló", new Error(error.message), {
        component: "inspection-evidences-register",
        action: "insert.evidence",
        metadata: { error: error.message, code: error.code },
      });
      return NextResponse.json(
        { error: `Error al registrar evidencia: ${error.message}`, code: error.code, hint: error.hint },
        { status: 500 },
      );
    }

    logger.info("Evidencia registrada via presign", {
      component: "inspection-evidences-register",
      action: "register.success",
      metadata: { sessionId, fileCode, evidenceId: evidence.id, type: dbType },
    });

    return NextResponse.json({ evidence });
  } catch (err) {
    logger.error("API /api/inspection/evidences/register error", err as Error, {
      component: "inspection-evidences-register",
      action: "register.error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo registrar la evidencia" },
      { status: 500 },
    );
  }
}
