import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * API route para exportar todos los claims sin joins pesados.
 *
 * POST /api/export-claims
 *   Body: {
 *     page: number,
 *     pageSize: number,       // máx 200
 *     statusIds?: string[],
 *     insuranceCompanyIds?: string[],
 *     adjusterIds?: string[],
 *     inspectorIds?: string[],
 *     dateFrom?: string,
 *     dateTo?: string,
 *     q?: string,
 *   }
 *   → Usa la service role key para evitar RLS y timeouts
 *   → Devuelve { data: Claim[], total: number }
 *
 * El select es ligero (sin joins) para maximizar velocidad.
 * Los datos relacionados (status, city, claim_type, etc.) se resuelven
 * en el cliente con catálogos ya cargados.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

// Select ligero: solo columnas planas + city + inspector (joins pequeños)
const LIGHT_SELECT = "id, liquidation_number, client_reference, claim_number, claim_date, report_date, created_at, status_id, claim_type_id, country_id, city_id, claim_address, disabled, company_id, insurance_company_id, assigned_adjuster_id, adjuster_id, inspector_id, city:cities!claims_city_id_fkey(id, name), inspector:profiles!claims_inspector_id_fkey(id, full_name)";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const page = Math.max(1, body?.page || 1);
    const pageSize = Math.min(200, Math.max(1, body?.pageSize || 100));
    const statusIds: string[] | undefined = Array.isArray(body?.statusIds) && body.statusIds.length ? body.statusIds : undefined;
    const insuranceCompanyIds: string[] | undefined = Array.isArray(body?.insuranceCompanyIds) && body.insuranceCompanyIds.length ? body.insuranceCompanyIds : undefined;
    const adjusterIds: string[] | undefined = Array.isArray(body?.adjusterIds) && body.adjusterIds.length ? body.adjusterIds : undefined;
    const inspectorIds: string[] | undefined = Array.isArray(body?.inspectorIds) && body.inspectorIds.length ? body.inspectorIds : undefined;
    const dateFrom: string | undefined = body?.dateFrom || undefined;
    const dateTo: string | undefined = body?.dateTo || undefined;
    const q: string | undefined = body?.q?.trim() || undefined;
    const inspectorId: string | undefined = body?.inspectorId || undefined;
    const userRole: string | undefined = body?.userRole || undefined;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      logger.error("[export-claims] Faltan variables de entorno de Supabase");
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Si hay búsqueda, resolver IDs primero
    let searchClaimIds: string[] | null = null;
    if (q && q.trim().length >= 4) {
      const { data: searchData, error: searchErr } = await supabase.rpc("search_claims_unaccent", { p_q: q });
      if (searchErr) {
        logger.error(`[export-claims] Error search: ${searchErr.message}`);
        return NextResponse.json({ data: [], total: 0 });
      }
      searchClaimIds = (searchData || []).map((r: { claim_id: string }) => r.claim_id);
      if (searchClaimIds && searchClaimIds.length === 0) {
        return NextResponse.json({ data: [], total: 0 });
      }
    }

    // Query base
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("claims")
      .select(LIGHT_SELECT, { count: "exact" })
      .eq("disabled", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (statusIds) query = query.in("status_id", statusIds);
    if (insuranceCompanyIds) query = query.in("insurance_company_id", insuranceCompanyIds);
    if (adjusterIds) query = query.in("adjuster_id", adjusterIds);
    if (inspectorIds) query = query.in("inspector_id", inspectorIds);
    if (dateFrom) query = query.gte("claim_date", dateFrom);
    if (dateTo) query = query.lte("claim_date", dateTo);
    if (searchClaimIds) query = query.in("id", searchClaimIds);

    // Si el usuario es inspector, forzar filtro por su inspector_id
    // (el API usa service role key que bypassa RLS)
    if (userRole === "inspector" && inspectorId) {
      query = query.eq("inspector_id", inspectorId);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error(`[export-claims] Error: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[export-claims] Error inesperado: ${msg}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
