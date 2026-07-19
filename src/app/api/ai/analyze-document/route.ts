import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/analyze-document
 *
 * Analiza (o re-analiza) con IA un archivo ya subido y guarda el resultado
 * en la columna ai_summary + ai_model de la tabla correspondiente.
 *
 * Body:
 *   { table: "claim_documents" | "policy_documents" | "inspection_evidences",
 *     id:   "<uuid del registro>",
 *     force?: boolean }   // si true, re-analiza aunque ya tenga ai_summary
 *
 * El registro debe tener una URL pública (document_url o url) accesible.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, id, force } = body as {
      table: "claim_documents" | "policy_documents" | "inspection_evidences" | "claim_images";
      id: string;
      force?: boolean;
    };

    if (!table || !id) {
      return NextResponse.json(
        { error: "Faltan parámetros: table, id" },
        { status: 400 }
      );
    }

    const allowedTables = ["claim_documents", "policy_documents", "inspection_evidences", "claim_images"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json(
        { error: `Tabla no permitida. Debe ser una de: ${allowedTables.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Traer el registro
    const { data: record, error: fetchErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !record) {
      return NextResponse.json(
        { error: "No se encontró el registro" },
        { status: 404 }
      );
    }

    // Si ya tiene análisis y no se forzó, no re-analizar
    if (!force && record.ai_summary) {
      return NextResponse.json({
        ok: true,
        alreadyAnalyzed: true,
        ai_summary: record.ai_summary,
        ai_model: record.ai_model,
      });
    }

    // Resolver la URL del archivo
    const fileUrl = record.document_url || record.url || null;
    if (!fileUrl) {
      return NextResponse.json(
        { error: "El registro no tiene URL de archivo" },
        { status: 400 }
      );
    }

    // Resolver el MIME type
    // IMPORTANTE: document_type / type en estas tablas NO son MIME types reales,
    // son categorías de negocio ("informe", "carta", "denuncio", etc.).
    // Solo los usamos como MIME si realmente parecen uno (image/*, application/*, text/*).
    // Si no, inferimos desde la URL o el nombre del archivo.
    // claim_images tiene mime_type directo (MIME real).
    const rawType = record.document_type || record.type || record.mime_type || null;
    const fileName = record.document_name || record.name || record.original_filename || null;
    const mimeType = resolveMimeType(fileUrl, fileName, rawType);

    // Descargar el archivo
    let buffer: Buffer;
    try {
      const res = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: `No se pudo descargar el archivo (status ${res.status})` },
          { status: 502 }
        );
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (dlErr) {
      logger.error("analyze-document: error descargando archivo", dlErr as Error, {
        component: "ai-analyze",
        action: "download",
        metadata: { table, id, url: fileUrl },
      });
      return NextResponse.json(
        { error: "No se pudo descargar el archivo desde el storage" },
        { status: 502 }
      );
    }

    // Analizar con IA
    let aiSummary: string | null = null;
    let aiModel: string | null = null;
    try {
      const ai = await summarizeFile(buffer, mimeType, record.document_name || record.name || record.original_filename);
      if (ai.ok) {
        aiSummary = ai.summary;
        aiModel = ai.model;
      } else {
        // Diagnóstico específico: retornar la razón exacta del fallo
        logger.warn("analyze-document: IA no procesó el archivo", {
          component: "ai-analyze",
          action: "ai.summary.skipped",
          metadata: { table, id, mimeType, reason: ai.reason },
        });
        return NextResponse.json(
          { error: ai.reason },
          { status: 422 }
        );
      }
    } catch (aiErr) {
      logger.error("analyze-document: error de IA", aiErr as Error, {
        component: "ai-analyze",
        action: "ai.summary",
        metadata: { table, id, error: String(aiErr) },
      });
      return NextResponse.json(
        { error: "No se pudo generar el análisis con IA" },
        { status: 500 }
      );
    }

    // Guardar en la BD
    const { error: updateErr } = await supabase
      .from(table)
      .update({
        ai_summary: aiSummary,
        ai_model: aiModel,
      })
      .eq("id", id);

    if (updateErr) {
      logger.error("analyze-document: error guardando análisis", new Error(updateErr.message), {
        component: "ai-analyze",
        action: "update",
        metadata: { table, id },
      });
      return NextResponse.json(
        { error: "No se pudo guardar el análisis en la BD" },
        { status: 500 }
      );
    }

    logger.info("analyze-document: análisis generado y guardado", {
      component: "ai-analyze",
      action: "success",
      metadata: { table, id, model: aiModel, summaryLength: aiSummary.length },
    });

    return NextResponse.json({
      ok: true,
      alreadyAnalyzed: false,
      ai_summary: aiSummary,
      ai_model: aiModel,
    });
  } catch (err) {
    logger.error("API /api/ai/analyze-document error", err as Error, {
      component: "ai-analyze",
      action: "route",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

/**
 * Resuelve el MIME type real del archivo.
 *
 * Prioridad:
 * 1. Si `rawType` parece un MIME real (image/*, application/pdf, text/*, video/*),
 *    lo usamos — porque algunos uploads sí guardan el MIME correcto.
 * 2. Si no, inferimos desde la extensión de la URL (lo más confiable, porque R2
 *    guarda el archivo con su extensión original).
 * 3. Si no, inferimos desde el nombre del archivo.
 * 4. Fallback: application/octet-stream.
 *
 * Esto evita el bug donde `document_type` = "informe" (categoría de negocio)
 * se confundía con un MIME type.
 */
function resolveMimeType(
  url: string,
  fileName: string | null,
  rawType: string | null
): string {
  // 1. ¿rawType parece un MIME real?
  if (rawType && looksLikeMime(rawType)) {
    return rawType;
  }
  // 2. Inferir desde la URL
  const fromUrl = guessMimeFromExtension(url);
  if (fromUrl) return fromUrl;
  // 3. Inferir desde el nombre del archivo
  if (fileName) {
    const fromName = guessMimeFromExtension(fileName);
    if (fromName) return fromName;
  }
  // 4. Fallback
  return "application/octet-stream";
}

/** ¿Este string parece un MIME type real (no una categoría de negocio)? */
function looksLikeMime(s: string): boolean {
  const lower = s.toLowerCase().trim();
  return (
    lower.startsWith("image/") ||
    lower.startsWith("application/") ||
    lower.startsWith("text/") ||
    lower.startsWith("video/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("multipart/")
  );
}

/** Adivina el MIME desde la extensión de un nombre/URL. */
function guessMimeFromExtension(s: string): string | null {
  const lower = (s || "").toLowerCase();
  // Tomar la parte después del último punto, sin query string
  const clean = lower.split("?")[0].split("#")[0];
  const ext = clean.includes(".") ? clean.split(".").pop() : "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return null;
  }
}
