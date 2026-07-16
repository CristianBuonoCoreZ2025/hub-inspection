import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/workflows/sync-claim
 * Body: { claimId: string }
 *
 * Sincroniza un siniestro con su workflow:
 * - Crea las gestiones de nivel 1 que falten según el estado actual
 * - Usa la funcion SQL sync_workflow_for_claim
 * - No duplica gestiones existentes
 */
export async function POST(req: NextRequest) {
  try {
    const { claimId } = await req.json();
    if (!claimId) {
      return NextResponse.json({ error: "claimId es requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Llamar a la funcion SQL sync_workflow_for_claim
    const { data, error } = await supabase.rpc("sync_workflow_for_claim", {
      p_claim_id: claimId,
    });

    if (error) {
      console.error("[sync-claim] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const created = (data as Record<string, unknown>[]) || [];
    const newActions = created.filter(r => r.created);

    return NextResponse.json({
      synced: true,
      total: created.length,
      created: newActions.length,
      actions: created,
    });
  } catch (err) {
    console.error("[sync-claim] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
