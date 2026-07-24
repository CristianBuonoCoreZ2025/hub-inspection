import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import {
  uploadInspectionFileRaw,
  reuploadInspectionFileOptimized,
  type InspectionFileType,
} from "@/lib/storage/inspection-upload";
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
 *   - source: upload | screenshot_inspector | screenshot_client | live_video | geo_map
 *
 * El description se setea automáticamente al código del archivo (ej: L-000000141-HINS-001-EVI-0001).
 *
 * Flujo (rápido — responde al cliente en ~1s, igual que claim_images):
 *  1. Sube el archivo original a R2 (sin optimizar)
 *  2. Extrae GPS de EXIF (síncrono, rápido — clave para anti-fraude)
 *  3. Inserta el registro en inspection_evidences con ai_status='pending'
 *  4. Devuelve éxito al cliente
 *
 * Flujo paralelo (background, después de responder):
 *  5. Optimiza el archivo (sharp: max 1920px, quality 80 — solo imágenes)
 *  6. Re-sube la versión optimizada a R2
 *  7. Actualiza url + file_path en inspection_evidences
 *  8. Genera resumen con IA (visión / texto)
 *  9. Actualiza ai_summary + ai_model + ai_status='done'
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");
    const originalName = formData.get("originalName");
    const source = formData.get("source");
    const damageId = formData.get("damageId");
    const documentType = formData.get("documentType");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    // Mapear MIME type → file_type de la BD
    const mimeType = file.type || "application/octet-stream";
    const fileType: InspectionFileType =
      mimeType.startsWith("image/")
        ? "EVI"
        : mimeType.startsWith("video/")
          ? "EVI"
          : "EVI"; // EVI sirve para foto, video y pdf (el type en BD se setea aparte)

    // Tipo en BD (para la columna `type` de inspection_evidences)
    const dbType: "photo" | "video" | "pdf" | "document" = mimeType.startsWith("image/")
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

    // ── PASO 1: Subir original a R2 (sin optimizar — rápido) ──
    const { url, seq, fileCode, ctx } = await uploadInspectionFileRaw(
      sessionId,
      buffer,
      mimeType,
      fileType,
      ext || ".bin"
    );

    // ── PASO 2: Resolver usuario actual (para captured_by) ──
    let userId: string | null = null;
    try {
      const serverClient = await createServerClient();
      const { data: { user } } = await serverClient.auth.getUser();
      if (user?.id) {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (profile) userId = user.id;
      }
    } catch {
      // sin sesión — continúa sin userId (cliente vía magic link)
    }

    // ── PASO 3: Extraer GPS de EXIF (síncrono, rápido — clave anti-fraude) ──
    let exifGps: { lat: number; lng: number } | null = null;
    if (dbType === "photo") {
      try {
        exifGps = await extractGpsFromExif(buffer);
      } catch (exifErr) {
        logger.warn("EXIF: no se pudo extraer GPS (no crítico)", {
          component: "inspection-evidences-upload",
          action: "exif.error",
          metadata: { error: exifErr instanceof Error ? exifErr.message : String(exifErr) },
        });
      }
    }

    // Construir metadata con info del archivo (geo va en columnas dedicadas)
    const metadata: Record<string, unknown> = {
      originalName: typeof originalName === "string" ? originalName : file.name,
      fileSize: file.size,
      mimeType,
      fileCode,
      userAgent: request.headers.get("user-agent") || null,
    };

    // ── Geo de la foto: SOLO EXIF GPS ──
    // La ubicación del dispositivo NO se guarda en evidencias.
    // La georreferenciación de cada foto viene de sus metadatos EXIF.
    // La georreferenciación inicial (¿desde dónde se hace la inspección?)
    // es un proceso distinto manejado por GeoCapture.
    const photoLat = exifGps?.lat ?? null;
    const photoLng = exifGps?.lng ?? null;

    // ── PASO 4: Insertar registro con ai_status='pending' ──
    const supabase = createAdminClient();
    const validSources = ["upload", "screenshot_inspector", "screenshot_client", "live_video", "geo_map"];
    const sourceValue = source && typeof source === "string" && validSources.includes(source) ? source : "upload";

    const documentTypeValue = typeof documentType === "string" && documentType.trim() ? documentType.trim() : null;
    const damageIdValue = typeof damageId === "string" && /^[0-9a-fA-F-]{36}$/.test(damageId) ? damageId : null;

    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: sessionId,
        type: dbType,
        url,
        description: documentTypeValue || fileCode,
        category: documentTypeValue,
        damage_id: damageIdValue,
        captured_by: userId,
        captured_at: new Date().toISOString(),
        source: sourceValue,
        metadata,
        lat: photoLat,
        lng: photoLng,
        exif_lat: exifGps?.lat ?? null,
        exif_lng: exifGps?.lng ?? null,
        ai_status: sourceValue === "live_video" ? "skipped" : "pending",
      })
      .select("id, url, type, description, category, damage_id, created_at, lat, lng, exif_lat, exif_lng, ai_summary, ai_model, ai_status, source")
      .single();

    if (error) {
      logger.error("Evidence upload: insert falló", new Error(error.message), {
        component: "inspection-evidences-upload",
        action: "insert.evidence",
        metadata: { error: error.message, code: error.code },
      });
      return NextResponse.json(
        { error: `Error al registrar evidencia: ${error.message} (code: ${error.code})` },
        { status: 500 }
      );
    }

    logger.info("Evidencia de inspección registrada", {
      component: "inspection-evidences-upload",
      action: "upload.success",
      metadata: { sessionId, fileCode, evidenceId: evidence.id, type: dbType },
    });

    // ── PASO 5: Devolver éxito al cliente ──
    const response = NextResponse.json({ evidence });

    // ── PASO 6-9: Procesamiento en background (optimización + IA) ──
    // after() ejecuta después de que la respuesta se envía al cliente.
    // Si falla, no afecta al usuario — la evidencia ya está subida y registrada.
    after(async () => {
      const evidenceId = evidence.id;
      // Las grabaciones de sesión no se optimizan ni analizan con IA
      if (sourceValue === "live_video") return;
      try {
        // ── Optimización: re-subir versión optimizada ──
        try {
          const optimized = await reuploadInspectionFileOptimized(
            ctx,
            seq,
            buffer,
            mimeType,
            fileType,
            ext || ".bin"
          );

          // Actualizar url + metadata.fileSize con el tamaño optimizado real
          await supabase
            .from("inspection_evidences")
            .update({
              url: optimized.url,
              metadata: { ...metadata, fileSize: optimized.optimizedSize, originalFileSize: file.size },
              updated_at: new Date().toISOString(),
            })
            .eq("id", evidenceId);

          logger.info("Evidencia optimizada y actualizada en BD", {
            component: "inspection-evidences-upload",
            action: "optimize.success",
            metadata: { evidenceId, newKey: optimized.key },
          });
        } catch (optErr) {
          logger.warn("Optimización de evidencia falló (no crítico)", {
            component: "inspection-evidences-upload",
            action: "optimize.error",
            metadata: {
              error: optErr instanceof Error ? optErr.message : String(optErr),
            },
          });
        }

        // ── PDF: extraer texto del contenido (primeras 10 páginas) ──
        if (dbType === "pdf") {
          try {
            const pdfSummary = await summarizePdf(buffer, 10);
            if (pdfSummary) {
              await supabase
                .from("inspection_evidences")
                .update({
                  metadata: { ...metadata, pdfSummary: pdfSummary.summary, pdfPageCount: pdfSummary.pageCount },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", evidenceId);
            }
          } catch (pdfErr) {
            logger.warn("PDF summary falló (no crítico)", {
              component: "inspection-evidences-upload",
              action: "pdf.summary.error",
              metadata: { error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr) },
            });
          }
        }

        // ── IA: resumen/descripción automático (free → paid) ──
        let aiStatus: "done" | "error" | "skipped" = "error";
        try {
          const ai = await summarizeFile(buffer, mimeType, file.name);
          if (ai.ok) {
            aiStatus = "done";
            await supabase
              .from("inspection_evidences")
              .update({
                ai_summary: ai.summary,
                ai_model: ai.model,
                ai_status: aiStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", evidenceId);

            logger.info("IA: resumen de evidencia generado y guardado", {
              component: "inspection-evidences-upload",
              action: "ai.summary.success",
              metadata: { evidenceId, model: ai.model, type: dbType },
            });
          } else {
            aiStatus = "skipped";
            await supabase
              .from("inspection_evidences")
              .update({ ai_status: aiStatus, updated_at: new Date().toISOString() })
              .eq("id", evidenceId);
            logger.warn("IA: no se pudo generar resumen de evidencia", {
              component: "inspection-evidences-upload",
              action: "ai.summary.skipped",
              metadata: { evidenceId, reason: ai.reason, mimeType },
            });
          }
        } catch (aiErr) {
          await supabase
            .from("inspection_evidences")
            .update({ ai_status: aiStatus, updated_at: new Date().toISOString() })
            .eq("id", evidenceId);
          logger.warn("IA: error generando resumen de evidencia (no crítico)", {
            component: "inspection-evidences-upload",
            action: "ai.summary.error",
            metadata: {
              error: aiErr instanceof Error ? aiErr.message : String(aiErr),
            },
          });
        }
      } catch (bgErr) {
        logger.error("Background processing de evidencia falló", bgErr as Error, {
          component: "inspection-evidences-upload",
          action: "background.error",
          metadata: { evidenceId },
        });
      }
    });

    return response;
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
