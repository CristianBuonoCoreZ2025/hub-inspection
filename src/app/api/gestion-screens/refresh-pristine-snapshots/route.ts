import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/gestion-screens/refresh-pristine-snapshots
 * Body: { claim_id?: string }  — si no se pasa, refresca TODAS las gestiones prístinas
 *                                de TODOS los siniestros.
 *
 * Refresca el screen_snapshot de las gestiones prístinas (sin datos, status=todo)
 * con el form_schema actual de la pantalla vinculada.
 * Las gestiones con datos o emitidas NO se tocan (protección contra inconsistencias).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const claimId: string | undefined = body.claim_id;

    const supabase = createAdminClient();

    // Llamar a la función SQL refresh_pristine_snapshots
    const { data, error } = await supabase.rpc("refresh_pristine_snapshots", {
      p_claim_id: claimId ?? null,
    });

    if (error) throw new Error(error.message);

    const refreshed = (data || []).filter((r: { refreshed: boolean }) => r.refreshed).length;
    const protected_ = (data || []).length - refreshed;

    return NextResponse.json({
      refreshed_count: refreshed,
      protected_count: protected_,
      details: data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
