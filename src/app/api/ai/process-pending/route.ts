import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/process-pending
 *
 * Procesa los archivos con IA pendiente y los analiza UNO POR UNO,
 * secuencialmente. Un único endpoint para TODOS los tipos de archivo:
 *   - inspection_evidences (sessionId)
 *   - claim_images         (claimId)
 *   - claim_documents      (claimId)
 *   - policy_documents     (policyId)
 *
 * Body:
 *   { sessionId: string }  → inspection_evidences
 *   { claimId: string }    → claim_images + claim_documents (procesa ambas)
 *   { policyId: string }   → policy_documents
 *
 * Este endpoint reemplaza el after() de todos los uploads. El frontend
 * lo dispara después de subir archivos (fire-and-forget).
 */
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — puede haber varios archivos pendientes

// Tablas con columna updated_at (inspection_evidences NO la tiene)
const TABLES_WITH_UPDATED_AT = new Set(["claim_images", "claim_documents", "policy_documents"]);

interface PendingRecord {
  id: string;
  url: string;
  type?: string | null;
  mime_type?: string | null;
  document_type?: string | null;
  original_filename?: string | null;
  document_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  created_at: string;
}

interface TableConfig {
  table: string;
  filterColumn: string;
  filterValue: string;
  urlColumn: string;
  nameColumn: string;
  mimeColumn: string | null;
  hasAiStatus: boolean;
  excludeLiveVideo: boolean;
  hasIsActive: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, claimId, policyId } = body as {
      sessionId?: string;
      claimId?: string;
      policyId?: string;
    };

    if (!sessionId && !claimId && !policyId) {
      return NextResponse.json(
        { error: "Falta sessionId, claimId o policyId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Obtener la línea de negocio del siniestro para contextualizar el prompt de IA
    let businessLine: string | undefined;
    let businessLineId: string | undefined;
    let claimIdForBL: string | null = null;
    if (claimId) {
      claimIdForBL = claimId;
    } else if (sessionId) {
      const { data: sessionData } = await supabase
        .from("inspection_sessions")
        .select("claim_id")
        .eq("id", sessionId)
        .maybeSingle();
      claimIdForBL = sessionData?.claim_id || null;
    }
    if (claimIdForBL) {
      // Lookup en dos pasos: primero el business_line_id, luego el nombre
      const { data: claimData } = await supabase
        .from("claims")
        .select("business_line_id")
        .eq("id", claimIdForBL)
        .maybeSingle();
      if (claimData?.business_line_id) {
        businessLineId = claimData.business_line_id;
        const { data: blData } = await supabase
          .from("business_lines")
          .select("name")
          .eq("id", claimData.business_line_id)
          .maybeSingle();
        if (blData?.name) {
          businessLine = blData.name;
          logger.info("process-pending: línea de negocio detectada", {
            component: "ai-process-pending",
            action: "business_line",
            metadata: { claimId: claimIdForBL, businessLine },
          });
        }
      }
    }

    // Determinar qué tablas procesar según el contexto
    const configs: TableConfig[] = [];
    if (sessionId) {
      configs.push({
        table: "inspection_evidences",
        filterColumn: "session_id",
        filterValue: sessionId,
        urlColumn: "url",
        nameColumn: "description",
        mimeColumn: null,
        hasAiStatus: true,
        excludeLiveVideo: true,
        hasIsActive: false,
      });
    }
    if (claimId) {
      configs.push({
        table: "claim_images",
        filterColumn: "claim_id",
        filterValue: claimId,
        urlColumn: "url",
        nameColumn: "original_filename",
        mimeColumn: "mime_type",
        hasAiStatus: true,
        excludeLiveVideo: false,
        hasIsActive: true,
      });
      configs.push({
        table: "claim_documents",
        filterColumn: "claim_id",
        filterValue: claimId,
        urlColumn: "file_url",
        nameColumn: "original_filename",
        mimeColumn: "mime_type",
        hasAiStatus: true,
        excludeLiveVideo: false,
        hasIsActive: true,
      });
    }
    if (policyId) {
      configs.push({
        table: "policy_documents",
        filterColumn: "policy_id",
        filterValue: policyId,
        urlColumn: "document_url",
        nameColumn: "document_name",
        mimeColumn: "document_type",
        hasAiStatus: false, // policy_documents no tiene ai_status
        excludeLiveVideo: false,
        hasIsActive: true,
      });
    }

    const allResults: Array<{
      table: string;
      processed: number;
      success: number;
      fail: number;
    }> = [];

    for (const cfg of configs) {
      const hasUpdatedAt = TABLES_WITH_UPDATED_AT.has(cfg.table);
      // Solo inspection_evidences tiene columna metadata y source
      const hasMetadata = cfg.table === "inspection_evidences";
      const hasSource = cfg.table === "inspection_evidences";

      // Construir query según la tabla — solo incluir columnas que existen
      const selectParts = ["id", cfg.urlColumn, cfg.nameColumn];
      if (cfg.mimeColumn) selectParts.push(cfg.mimeColumn);
      else selectParts.push("type");
      if (hasMetadata) selectParts.push("metadata");
      if (hasSource) selectParts.push("source");
      selectParts.push("created_at");
      const selectCols = selectParts.join(", ");

      let query = supabase
        .from(cfg.table)
        .select(selectCols)
        .eq(cfg.filterColumn, cfg.filterValue)
        .order("created_at", { ascending: true });

      // Solo registros activos (no eliminados)
      if (cfg.hasIsActive) {
        query = query.eq("is_active", true);
      }

      // Filtro de "pending"
      if (cfg.hasAiStatus) {
        query = query.eq("ai_status", "pending");
      } else {
        // policy_documents: no tiene ai_status, usar ai_summary IS NULL
        query = query.is("ai_summary", null);
      }

      if (cfg.excludeLiveVideo) {
        query = query.neq("source", "live_video");
      }

      const { data: pendingRecords, error: fetchErr } = await query;

      if (fetchErr) {
        logger.error("process-pending: error buscando registros", new Error(fetchErr.message), {
          component: "ai-process-pending",
          action: "fetch.pending",
          metadata: { table: cfg.table, error: fetchErr.message },
        });
        allResults.push({ table: cfg.table, processed: 0, success: 0, fail: 0 });
        continue;
      }

      if (!pendingRecords || pendingRecords.length === 0) {
        allResults.push({ table: cfg.table, processed: 0, success: 0, fail: 0 });
        continue;
      }

      logger.info("process-pending: iniciando procesamiento", {
        component: "ai-process-pending",
        action: "start",
        metadata: { table: cfg.table, count: pendingRecords.length },
      });

      let successCount = 0;
      let failCount = 0;

      // Procesar UNO POR UNO, secuencialmente
      for (const record of pendingRecords as unknown as PendingRecord[]) {
        try {
          // ─── Chequear si el usuario canceló (ai_status = skipped) ───
          if (cfg.hasAiStatus) {
            const { data: checkRecord } = await supabase
              .from(cfg.table)
              .select("ai_status")
              .eq("id", record.id)
              .maybeSingle();
            if (checkRecord?.ai_status === "skipped") {
              logger.info("process-pending: registro cancelado por usuario, saltando", {
                component: "ai-process-pending",
                action: "record.cancelled",
                metadata: { table: cfg.table, recordId: record.id },
              });
              continue;
            }
          }

          // Marcar como "processing" (solo si tiene ai_status)
          if (cfg.hasAiStatus) {
            const processingUpdate: Record<string, unknown> = { ai_status: "processing", ai_progress: "iniciando" };
            if (hasUpdatedAt) processingUpdate.updated_at = new Date().toISOString();
            await supabase.from(cfg.table).update(processingUpdate).eq("id", record.id);
          }

          // Resolver URL del archivo
          const fileUrl = (record as unknown as Record<string, string>)[cfg.urlColumn];
          if (!fileUrl) {
            throw new Error("Sin URL de archivo");
          }

          // Resolver MIME type
          const meta = record.metadata;
          let mimeType: string | null = null;
          if (cfg.mimeColumn) {
            mimeType = (record as unknown as Record<string, string | null>)[cfg.mimeColumn] || null;
          }
          if (!mimeType) {
            mimeType = (meta?.mimeType as string) || null;
          }
          if (!mimeType) {
            if (record.type === "photo") mimeType = "image/jpeg";
            else if (record.type === "video") mimeType = "video/mp4";
            else if (record.type === "pdf") mimeType = "application/pdf";
            else if (cfg.table === "policy_documents" && record.document_type) {
              mimeType = record.document_type;
            } else {
              mimeType = "application/octet-stream";
            }
          }

          // Descargar el archivo desde R2
          const dlRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
          if (!dlRes.ok) {
            throw new Error(`No se pudo descargar el archivo (HTTP ${dlRes.status})`);
          }
          const arrayBuffer = await dlRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Resolver nombre del archivo
          const fileName =
            (record as unknown as Record<string, string | null>)[cfg.nameColumn] ||
            (meta?.originalName as string) ||
            record.id;

          // Analizar con IA — onProgress acumula los pasos en ai_progress
          // Formato: "phase:model:status|phase:model:status|..."
          // Cada modelo probado se agrega al log. Si el último paso era "trying"
          // del mismo modelo, se actualiza (trying → failed u ok) sin duplicar.
          const progressSteps: string[] = [];
          const onProgress = (phase: string, model: string, status: string) => {
            const step = `${phase}:${model}:${status}`;
            const lastIdx = progressSteps.length - 1;
            const lastStep = progressSteps[lastIdx];
            if (lastStep && lastStep.startsWith(`${phase}:${model}:trying`)) {
              progressSteps[lastIdx] = step;
            } else {
              progressSteps.push(step);
            }
            const progressStr = progressSteps.join("|");
            const update: Record<string, unknown> = { ai_progress: progressStr };
            if (hasUpdatedAt) update.updated_at = new Date().toISOString();
            supabase.from(cfg.table).update(update).eq("id", record.id).then(() => {});
          };

          const ai = await summarizeFile(buffer, mimeType, fileName, businessLineId, onProgress);

          if (ai.ok) {
            // Guardar resultado + snapshot del prompt (ai_progress se conserva para el log)
            const doneUpdate: Record<string, unknown> = {
              ai_summary: ai.summary,
              ai_model: ai.model,
              ai_prompt_snapshot: ai.promptSnapshot,
            };
            if (cfg.hasAiStatus) doneUpdate.ai_status = "done";
            if (hasUpdatedAt) doneUpdate.updated_at = new Date().toISOString();
            await supabase.from(cfg.table).update(doneUpdate).eq("id", record.id);

            successCount++;
            logger.info("process-pending: archivo analizado", {
              component: "ai-process-pending",
              action: "record.done",
              metadata: { table: cfg.table, recordId: record.id, model: ai.model },
            });
          } else {
            // IA no procesó — marcar como skipped (o dejar ai_summary null)
            const skippedUpdate: Record<string, unknown> = { ai_progress: null };
            if (cfg.hasAiStatus) skippedUpdate.ai_status = "skipped";
            if (hasUpdatedAt) skippedUpdate.updated_at = new Date().toISOString();
            if (Object.keys(skippedUpdate).length > 0) {
              await supabase.from(cfg.table).update(skippedUpdate).eq("id", record.id);
            }

            failCount++;
            logger.warn("process-pending: IA no procesó archivo", {
              component: "ai-process-pending",
              action: "record.skipped",
              metadata: { table: cfg.table, recordId: record.id, reason: ai.reason, mimeType },
            });
          }
        } catch (err) {
          failCount++;
          const errMsg = err instanceof Error ? err.message : String(err);

          if (cfg.hasAiStatus) {
            const errorUpdate: Record<string, unknown> = { ai_status: "error", ai_progress: null };
            if (hasUpdatedAt) errorUpdate.updated_at = new Date().toISOString();
            await supabase.from(cfg.table).update(errorUpdate).eq("id", record.id);
          }

          logger.warn("process-pending: error en archivo", {
            component: "ai-process-pending",
            action: "record.error",
            metadata: { table: cfg.table, recordId: record.id, error: errMsg },
          });
        }
      }

      logger.info("process-pending: tabla completada", {
        component: "ai-process-pending",
        action: "table.complete",
        metadata: { table: cfg.table, total: pendingRecords.length, success: successCount, fail: failCount },
      });

      allResults.push({
        table: cfg.table,
        processed: pendingRecords.length,
        success: successCount,
        fail: failCount,
      });
    }

    const totalProcessed = allResults.reduce((sum, r) => sum + r.processed, 0);
    const totalSuccess = allResults.reduce((sum, r) => sum + r.success, 0);
    const totalFail = allResults.reduce((sum, r) => sum + r.fail, 0);

    return NextResponse.json({
      ok: true,
      processed: totalProcessed,
      success: totalSuccess,
      fail: totalFail,
      tables: allResults,
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
