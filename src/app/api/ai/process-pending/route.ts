import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/process-pending
 *
 * Procesa las evidencias de una sesión que están con ai_status='pending'
 * y las analiza con IA una por una, secuencialmente.
 *
 * Body:
 *   { sessionId: string }   — UUID de la inspection_session
 *
 * Flujo:
 *   1. Busca evidencias con ai_status='pending' de la sesión
 *   2. Para cada una:
 *      a. Descarga el archivo desde R2 (url pública)
 *      b. Determina el MIME type
 *      c. Llama a summarizeFile (visión / texto / PDF)
 *      d. Actualiza ai_summary + ai_model + ai_status='done' (o 'skipped'/'error')
 *   3. Retorna resumen de cuántas se procesaron
 *
 * Este endpoint reemplaza el after() del upload, que no es confiable en
 * Vercel serverless para tareas largas. El frontend lo dispara después
 * de subir evidencias.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — puede haber varias evidencias pendientes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Falta sessionId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar evidencias pending de esta sesión (excluyendo live_video que no se analiza)
    const { data: pendingEvidences, error: fetchErr } = await supabase
      .from("inspection_evidences")
      .select("id, url, type, description, metadata, source")
      .eq("session_id", sessionId)
      .eq("ai_status", "pending")
      .neq("source", "live_video")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      logger.error("process-pending: error buscando evidencias", new Error(fetchErr.message), {
        component: "ai-process-pending",
        action: "fetch.pending",
        metadata: { sessionId, error: fetchErr.message },
      });
      return NextResponse.json(
        { error: `Error al buscar evidencias pendientes: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!pendingEvidences || pendingEvidences.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        message: "No hay evidencias pendientes de análisis",
      });
    }

    logger.info("process-pending: iniciando procesamiento", {
      component: "ai-process-pending",
      action: "start",
      metadata: { sessionId, count: pendingEvidences.length },
    });

    const results: Array<{ id: string; ok: boolean; model?: string; error?: string }> = [];
    let successCount = 0;
    let failCount = 0;

    // Procesar UNA POR UNA, secuencialmente (no en paralelo)
    for (const evidence of pendingEvidences) {
      try {
        // Marcar como "processing" para evitar doble procesamiento
        // (si el usuario dispara dos veces, la segunda no toma las que ya están siendo procesadas)
        // NOTA: inspection_evidences no tiene columna updated_at
        await supabase
          .from("inspection_evidences")
          .update({ ai_status: "processing" })
          .eq("id", evidence.id);

        // Resolver MIME type desde metadata o type
        const meta = evidence.metadata as Record<string, unknown> | null;
        let mimeType = (meta?.mimeType as string) || null;
        if (!mimeType) {
          // Inferir desde el type de la BD
          if (evidence.type === "photo") mimeType = "image/jpeg";
          else if (evidence.type === "video") mimeType = "video/mp4";
          else if (evidence.type === "pdf") mimeType = "application/pdf";
          else mimeType = "application/octet-stream";
        }

        // Descargar el archivo desde R2
        const fileUrl = evidence.url;
        const dlRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
        if (!dlRes.ok) {
          throw new Error(`No se pudo descargar el archivo (HTTP ${dlRes.status})`);
        }
        const arrayBuffer = await dlRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Analizar con IA
        const fileName = (meta?.originalName as string) || evidence.description || evidence.id;
        const ai = await summarizeFile(buffer, mimeType, fileName);

        if (ai.ok) {
          // Guardar resultado (sin updated_at — inspection_evidences no lo tiene)
          await supabase
            .from("inspection_evidences")
            .update({
              ai_summary: ai.summary,
              ai_model: ai.model,
              ai_status: "done",
            })
            .eq("id", evidence.id);

          successCount++;
          results.push({ id: evidence.id, ok: true, model: ai.model });

          logger.info("process-pending: evidencia analizada", {
            component: "ai-process-pending",
            action: "evidence.done",
            metadata: { sessionId, evidenceId: evidence.id, model: ai.model },
          });
        } else {
          // IA no procesó — marcar como skipped
          await supabase
            .from("inspection_evidences")
            .update({ ai_status: "skipped" })
            .eq("id", evidence.id);

          failCount++;
          results.push({ id: evidence.id, ok: false, error: ai.reason });

          logger.warn("process-pending: IA no procesó evidencia", {
            component: "ai-process-pending",
            action: "evidence.skipped",
            metadata: { sessionId, evidenceId: evidence.id, reason: ai.reason, mimeType },
          });
        }
      } catch (err) {
        // Error en esta evidencia — marcar como error y continuar con la siguiente
        failCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ id: evidence.id, ok: false, error: errMsg });

        await supabase
          .from("inspection_evidences")
          .update({ ai_status: "error" })
          .eq("id", evidence.id);

        logger.warn("process-pending: error en evidencia", {
          component: "ai-process-pending",
          action: "evidence.error",
          metadata: { sessionId, evidenceId: evidence.id, error: errMsg },
        });
      }
    }

    logger.info("process-pending: procesamiento completado", {
      component: "ai-process-pending",
      action: "complete",
      metadata: { sessionId, total: pendingEvidences.length, success: successCount, fail: failCount },
    });

    return NextResponse.json({
      ok: true,
      processed: pendingEvidences.length,
      success: successCount,
      fail: failCount,
      results,
    });
  } catch (err) {
    logger.error("process-pending: error general", err as Error, {
      component: "ai-process-pending",
      action: "route",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
