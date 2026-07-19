import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { extractGpsFromExif } from "@/lib/storage/exif";
import { summarizePdf } from "@/lib/storage/pdf-summary";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * API route para subir una evidencia de inspección a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo (foto, video, pdf)
 *   - sessionId: UUID de la inspection_session
 *   - lat: latitud opcional (geolocalización del navegador)
 *   - lng: longitud opcional
 *   - originalName: nombre original del archivo (se guarda en metadata)
 *
 * El description se setea automáticamente al código del archivo (ej: L-000000141-HINS-001-EVI-0001).
 * El nombre original del archivo NO se muestra — la regla del plan es "el nombre ES el código".
 *
 * Flujo:
 *  1. Resuelve sessionId → claim_action.code + claim.liquidation_number
 *  2. Obtiene el siguiente correlativo EVI-NNNN atómico desde la BD
 *  3. Sube a R2 con path: claims/{L}/actions/{code}/images/{code}-EVI-NNNN.ext
 *  4. Inserta el registro en inspection_evidences con captured_by + metadata
 *
 * Devuelve: { evidence: { id, url, type, description, created_at } }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");
    const lat = formData.get("lat");
    const lng = formData.get("lng");
    const originalName = formData.get("originalName");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    // Mapear MIME type → file_type de la BD
    const mimeType = file.type || "application/octet-stream";
    const fileType: "photo" | "video" | "pdf" | "document" = mimeType.startsWith("image/")
      ? "photo"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType === "application/pdf"
          ? "pdf"
          : "document";

    // Extensión desde el nombre original
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado (EVI = evidencia)
    const { url, fileCode } = await uploadInspectionFile(
      sessionId,
      buffer,
      mimeType,
      "EVI",
      ext || ".bin"
    );

    // Resolver usuario actual desde la sesión
    const supabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Extraer GPS de los metadatos EXIF de la foto (si los tiene)
    // Esto es clave para prevenir fraudes — la ubicación real de la foto
    // puede diferir de la ubicación del dispositivo al subir
    let exifGps: { lat: number; lng: number } | null = null;
    if (fileType === "photo") {
      exifGps = await extractGpsFromExif(buffer);
    }

    // Construir metadata con info del archivo (geo va en columnas dedicadas)
    const metadata: Record<string, unknown> = {
      originalName: typeof originalName === "string" ? originalName : file.name,
      fileSize: file.size,
      mimeType,
      userAgent: request.headers.get("user-agent") || null,
    };

    // Si es PDF, extraer resumen del contenido (primeras 10 páginas)
    if (fileType === "pdf") {
      const pdfSummary = await summarizePdf(buffer, 10);
      if (pdfSummary) {
        metadata.pdfSummary = pdfSummary.summary;
        metadata.pdfPageCount = pdfSummary.pageCount;
      }
    }

    // ── IA: resumen/descripción automático (free → paid) ──
    // Para imágenes: descripción breve del contenido
    // Para PDFs: resumen de las primeras 5 páginas
    try {
      const ai = await summarizeFile(buffer, mimeType);
      if (ai) {
        metadata.aiSummary = ai.summary;
        metadata.aiModel = ai.model;
        if (ai.pageCount !== undefined) metadata.aiPageCount = ai.pageCount;
        logger.info("IA: resumen de evidencia generado", {
          component: "inspection-evidences-upload",
          action: "ai.summary",
          metadata: { model: ai.model, type: fileType, summaryLength: ai.summary.length },
        });
      }
    } catch (aiErr) {
      logger.warn("IA: no se pudo generar resumen de evidencia", {
        component: "inspection-evidences-upload",
        action: "ai.summary.error",
        metadata: { error: aiErr instanceof Error ? aiErr.message : String(aiErr) },
      });
    }
    // Geo del navegador → columnas lat/lng
    const deviceLat = lat && typeof lat === "string" ? parseFloat(lat) : null;
    const deviceLng = lng && typeof lng === "string" ? parseFloat(lng) : null;

    // Insertar en inspection_evidences — el description es el código del archivo
    // Geo del dispositivo en columnas lat/lng, geo EXIF en exif_lat/exif_lng
    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: sessionId,
        type: fileType,
        url,
        description: fileCode,
        captured_by: user?.id || null,
        captured_at: new Date().toISOString(),
        metadata,
        lat: deviceLat,
        lng: deviceLng,
        exif_lat: exifGps?.lat ?? null,
        exif_lng: exifGps?.lng ?? null,
      })
      .select("id, url, type, description, created_at, lat, lng, exif_lat, exif_lng")
      .single();

    if (error) {
      logger.error("Evidence upload: insert falló", new Error(error.message), {
        component: "inspection-evidences-upload",
        action: "insert.evidence",
      });
      return NextResponse.json({ error: "Error al registrar evidencia" }, { status: 500 });
    }

    return NextResponse.json({ evidence });
  } catch (err) {
    logger.error("API /api/inspection/evidences/upload error", err as Error, {
      component: "inspection-evidences-upload",
      action: "upload.evidence",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir la evidencia" },
      { status: 500 }
    );
  }
}
