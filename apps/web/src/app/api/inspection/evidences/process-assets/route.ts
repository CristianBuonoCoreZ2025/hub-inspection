import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  resolveInspectionStorageContext,
  reuploadInspectionFileOptimized,
} from "@/lib/storage/inspection-upload";
import { downloadFromR2 } from "@/lib/storage/r2-upload";
import { r2PublicUrl } from "@/lib/storage/r2-client";
import { summarizePdf } from "@/lib/storage/pdf-summary";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/evidences/process-assets
 *
 * Procesa las evidencias de una sesión al cerrarla:
 *   - Redimensiona/comprime imágenes.
 *   - Extrae resumen de PDFs.
 *
 * Se dispara desde el dashboard cuando la inspección pasa a "completed".
 * El trabajo pesado corre en after() para responder inmediatamente.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

function extractKeyFromUrl(url: string): string {
  if (url.startsWith(r2PublicUrl)) {
    return url.slice(r2PublicUrl.length).replace(/^\//, "");
  }
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    after(async () => {
      const supabase = createAdminClient();

      try {
        const ctx = await resolveInspectionStorageContext(sessionId);

        const { data: evidences } = await supabase
          .from("inspection_evidences")
          .select("id, url, type, metadata, source")
          .eq("session_id", sessionId)
          .neq("source", "live_video");

        if (!evidences || evidences.length === 0) return;

        for (const evidence of evidences) {
          const metadata = (evidence.metadata as Record<string, unknown>) || {};
          const fileCode = typeof metadata.fileCode === "string" ? metadata.fileCode : "";
          const seq = parseInt(fileCode.split("-").pop() || "0", 10);

          // Saltar si ya fue procesada
          if (evidence.type === "photo" && typeof metadata.optimizedFileSize === "number") continue;
          if (evidence.type === "pdf" && typeof metadata.pdfSummary === "string") continue;

          const key = extractKeyFromUrl(evidence.url);
          const mimeType = typeof metadata.mimeType === "string" ? metadata.mimeType : "application/octet-stream";
          const ext = evidence.url.includes(".") ? "." + evidence.url.split(".").pop() : ".bin";

          try {
            const buffer = await downloadFromR2(key);

            if (evidence.type === "photo") {
              const optimized = await reuploadInspectionFileOptimized(
                ctx,
                seq,
                buffer,
                mimeType,
                "EVI",
                ext
              );

              await supabase
                .from("inspection_evidences")
                .update({
                  url: optimized.url,
                  metadata: {
                    ...metadata,
                    fileSize: optimized.optimizedSize,
                    originalFileSize: metadata.fileSize,
                  },
                })
                .eq("id", evidence.id);
            } else if (evidence.type === "pdf") {
              const pdfSummary = await summarizePdf(buffer, 10);
              if (pdfSummary) {
                await supabase
                  .from("inspection_evidences")
                  .update({
                    metadata: { ...metadata, pdfSummary: pdfSummary.summary, pdfPageCount: pdfSummary.pageCount },
                  })
                  .eq("id", evidence.id);
              }
            }
          } catch (assetErr) {
            logger.warn("process-assets: no se pudo procesar evidencia", {
              component: "inspection-evidences-process-assets",
              action: "process.error",
              metadata: {
                evidenceId: evidence.id,
                error: assetErr instanceof Error ? assetErr.message : String(assetErr),
              },
            });
          }
        }

        logger.info("process-assets: evidencias procesadas", {
          component: "inspection-evidences-process-assets",
          action: "complete",
          metadata: { sessionId, count: evidences.length },
        });
      } catch (err) {
        logger.error("process-assets: error general", err as Error, {
          component: "inspection-evidences-process-assets",
          action: "route.error",
          metadata: { sessionId },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("process-assets: error en request", err as Error, {
      component: "inspection-evidences-process-assets",
      action: "request.error",
    });
    return NextResponse.json({ error: "No se pudo iniciar el procesamiento" }, { status: 500 });
  }
}
