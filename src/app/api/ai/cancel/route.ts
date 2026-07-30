import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/cancel
 *
 * Cancela el análisis de IA de un archivo específico.
 * Marca ai_status = "skipped" para que process-pending lo saltee.
 *
 * Body:
 *   { table: string, id: string }
 *
 * Tablas soportadas: claim_images, claim_documents, inspection_evidences, policy_documents
 */
export const runtime = "nodejs";

const ALLOWED_TABLES = new Set([
  "claim_images",
  "claim_documents",
  "inspection_evidences",
  "policy_documents",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, id } = body as { table?: string; id?: string };

    if (!table || !id) {
      return NextResponse.json(
        { error: "Falta table o id" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json(
        { error: `Tabla no permitida: ${table}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Marcar como skipped — process-pending chequea ai_status antes de procesar
    const update: Record<string, unknown> = {
      ai_status: "skipped",
      ai_progress: null,
    };

    // policy_documents no tiene ai_status, usa ai_summary IS NULL como pendiente
    if (table === "policy_documents") {
      delete update.ai_status;
      update.ai_summary = "[OMITIDO POR EL USUARIO]";
    }

    const { error } = await supabase
      .from(table)
      .update(update)
      .eq("id", id);

    if (error) {
      logger.error("ai/cancel: error actualizando", new Error(error.message), {
        component: "ai-cancel",
        action: "cancel",
        metadata: { table, id, error: error.message },
      });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    logger.info("ai/cancel: análisis cancelado", {
      component: "ai-cancel",
      action: "cancel",
      metadata: { table, id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("ai/cancel: error general", err as Error, {
      component: "ai-cancel",
      action: "route",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
