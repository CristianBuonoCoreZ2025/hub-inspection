import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFileRaw } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/live/[token]/evidence
 *
 * API pública para que el asegurado suba evidencias desde el Magic Link.
 * - Valida el magic_link_token
 * - Sube el archivo original a R2 (sin optimizar, sin esperar IA)
 * - Inserta el registro en inspection_evidences con ai_status='pending'
 *   para que el análisis con IA se corra después desde la aplicación matriz
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: sessions, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select("id, status, magic_link_token")
      .eq("magic_link_token", token)
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    const session = sessions[0];
    if (session.status === "completed" || session.status === "cancelled") {
      return NextResponse.json({ error: "Inspección finalizada" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const dbType: "photo" | "video" | "pdf" | "document" = mimeType.startsWith("image/")
      ? "photo"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType === "application/pdf"
          ? "pdf"
          : "document";

    const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { url, fileCode } = await uploadInspectionFileRaw(
      session.id,
      buffer,
      mimeType,
      "EVI",
      ext || ".bin",
    );

    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: session.id,
        type: dbType,
        url,
        description: fileCode,
        captured_by: null,
        captured_at: new Date().toISOString(),
        source: "upload",
        metadata: {
          originalName: file.name,
          mimeType,
          fileSize: buffer.length,
        },
        lat: null,
        lng: null,
        exif_lat: null,
        exif_lng: null,
        ai_status: "pending",
      })
      .select("id, url, type, description, created_at, source")
      .single();

    if (error) throw new Error(error.message);

    logger.info("Evidencia subida desde magic link", {
      component: "magic-link-evidence",
      action: "upload.success",
      metadata: { sessionId: session.id, evidenceId: evidence.id, fileCode },
    });

    return NextResponse.json({ evidence });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("API /api/inspection/live/[token]/evidence error", error, {
      component: "magic-link-evidence",
      action: "upload.error",
    });
    return NextResponse.json(
      { error: "No se pudo subir la evidencia", detail: error.message },
      { status: 500 },
    );
  }
}
