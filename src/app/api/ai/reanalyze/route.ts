import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/ai/reanalyze
 *
 * Re-analiza un archivo con IA SIN abrir un modal. Resetea el registro
 * a ai_status = "pending" y dispara process-pending en background.
 * El polling de la UI detecta el estado "pending" y muestra el
 * AiProgressOverlay sobre la foto (igual que el análisis inicial).
 *
 * Body:
 *   { table: "claim_images" | "claim_documents" | "inspection_evidences",
 *     id:   "<uuid del registro>",
 *     claimId?: string }  // para disparar process-pending del siniestro
 *
 * No espera a que termine el análisis — retorna inmediatamente { ok: true }.
 */
export const runtime = "nodejs";
export const maxDuration = 10;

const ALLOWED_TABLES = ["claim_images", "claim_documents", "inspection_evidences"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

// inspection_evidences no tiene updated_at
const TABLES_WITHOUT_UPDATED_AT = new Set<string>(["inspection_evidences"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, id, claimId } = body as {
      table: string;
      id: string;
      claimId?: string;
    };

    if (!table || !id) {
      return NextResponse.json(
        { error: "Faltan parámetros: table, id" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json(
        { error: `Tabla no permitida. Debe ser una de: ${ALLOWED_TABLES.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const tableName = table as AllowedTable;
    const hasUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.has(tableName);

    // Resolver claimId si no se pasó (para disparar process-pending)
    let resolvedClaimId = claimId || null;
    let resolvedSessionId: string | null = null;
    if (!resolvedClaimId) {
      if (tableName === "claim_images" || tableName === "claim_documents") {
        const { data } = await supabase
          .from(tableName)
          .select("claim_id")
          .eq("id", id)
          .maybeSingle();
        resolvedClaimId = data?.claim_id || null;
      } else if (tableName === "inspection_evidences") {
        const { data } = await supabase
          .from(tableName)
          .select("session_id")
          .eq("id", id)
          .maybeSingle();
        resolvedSessionId = data?.session_id || null;
      }
    }

    // Resetear el registro a "pending" — limpiar análisis anterior
    const resetUpdate: Record<string, unknown> = {
      ai_status: "pending",
      ai_summary: null,
      ai_model: null,
      ai_progress: null,
      ai_prompt_snapshot: null,
      ai_analyzed_at: null,
    };
    if (hasUpdatedAt) resetUpdate.updated_at = new Date().toISOString();

    const { error: resetErr } = await supabase
      .from(tableName)
      .update(resetUpdate)
      .eq("id", id);

    if (resetErr) {
      logger.error("reanalyze: error reseteando registro", new Error(resetErr.message), {
        component: "ai-reanalyze",
        action: "reset",
        metadata: { table: tableName, id, error: resetErr.message },
      });
      return NextResponse.json(
        { error: `No se pudo resetear el registro: ${resetErr.message}` },
        { status: 500 }
      );
    }

    logger.info("reanalyze: registro reseteado a pending", {
      component: "ai-reanalyze",
      action: "reset",
      metadata: { table: tableName, id },
    });

    // Disparar process-pending en background (fire-and-forget)
    const payload: Record<string, string> = {};
    if (resolvedClaimId) payload.claimId = resolvedClaimId;
    else if (resolvedSessionId) payload.sessionId = resolvedSessionId;

    if (Object.keys(payload).length > 0) {
      fetch(`${request.nextUrl.origin}/api/ai/process-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Fire-and-forget — si falla, el polling del frontend lo reintenta
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("reanalyze: error general", err as Error, {
      component: "ai-reanalyze",
      action: "route",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
