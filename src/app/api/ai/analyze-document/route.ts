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
      table: "claim_documents" | "policy_documents" | "inspection_evidences";
      id: string;
      force?: boolean;
    };

    if (!table || !id) {
      return NextResponse.json(
        { error: "Faltan parámetros: table, id" },
        { status: 400 }
      );
    }

    const allowedTables = ["claim_documents", "policy_documents", "inspection_evidences"];
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
    const mimeType =
      record.document_type ||
      record.type ||
      guessMimeTypeFromUrl(fileUrl, record.document_name);

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
      const ai = await summarizeFile(buffer, mimeType);
      if (ai) {
        aiSummary = ai.summary;
        aiModel = ai.model;
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

    if (!aiSummary) {
      return NextResponse.json(
        { error: "La IA no retornó un análisis para este archivo (tipo no soportado o sin contenido)" },
        { status: 422 }
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

/** Adivina el MIME type desde la extensión de la URL. */
function guessMimeTypeFromUrl(url: string, fallbackName?: string): string {
  const candidate = (url || "") + " " + (fallbackName || "");
  const lower = candidate.toLowerCase();
  if (lower.match(/\.(jpg|jpeg)$/)) return "image/jpeg";
  if (lower.match(/\.png$/)) return "image/png";
  if (lower.match(/\.webp$/)) return "image/webp";
  if (lower.match(/\.gif$/)) return "image/gif";
  if (lower.match(/\.pdf$/)) return "application/pdf";
  if (lower.match(/\.(mp4|mov|webm)$/)) return "video/mp4";
  return "application/octet-stream";
}
