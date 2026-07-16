import { fetchAll, insertRow, insertMany, updateRow, getSupabaseClient } from "@/lib/supabase/db";

export interface ReserveCoverage {
  id: string;
  claim_reserve_id: string;
  claim_coverage_id: string;
  insured_amount: number | null;
  claimed_amount: number | null;
  reserved_amount: number | null;
  recovered_amount: number | null;
  deductible_amount: number | null;
  net_reserve: number | null;
  // Campos de ajuste
  adjusted_amount: number | null;
  adjusted_deductible: number | null;
  adjusted_net: number | null;
  adjustment_notes: string | null;
  adjusted_at: string | null;
  claim_coverage?: {
    id: string;
    coverage_name: string | null;
    subcoverage_name: string | null;
    policy_coverage?: {
      coverage_catalog?: { code: string | null; name: string | null } | null;
      subcoverage_catalog?: { code: string | null; name: string | null } | null;
    } | null;
    coverage_catalog?: { code: string | null; name: string | null } | null;
  };
}

export interface ClaimReserve {
  id: string;
  claim_id: string;
  claim_action_id: string | null;
  reserve_number: string | null;
  currency: string | null;
  exchange_rate: number | null;
  capital_amount: number | null;
  claimed_amount: number | null;
  deductible_amount: number | null;
  reserve_amount: number | null;
  final_amount: number | null;
  status: string | null;
  notes: string | null;
  payment_date: string | null;
  // Campos de ajuste
  adjusted_amount: number | null;
  adjusted_deductible: number | null;
  adjusted_final_amount: number | null;
  adjusted_at: string | null;
  adjustment_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  reserve_coverages: ReserveCoverage[];
}

const COVERAGE_REL = "claim_coverage:claim_coverages!reserve_coverages_claim_coverage_id_fkey(id, coverage_name, subcoverage_name, policy_coverage:policy_coverages!claim_coverages_policy_coverage_id_fkey(id, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name)), coverage_catalog:coverage_catalog!claim_coverages_coverage_catalog_id_fkey(code, name))";

const RESERVE_SELECT =
  `id, claim_id, claim_action_id, reserve_number, currency, exchange_rate, capital_amount, claimed_amount, deductible_amount, reserve_amount, final_amount, status, notes, payment_date, adjusted_amount, adjusted_deductible, adjusted_final_amount, adjusted_at, adjustment_notes, is_active, created_at, updated_at, reserve_coverages:reserve_coverages(id, claim_reserve_id, claim_coverage_id, insured_amount, claimed_amount, reserved_amount, recovered_amount, deductible_amount, net_reserve, adjusted_amount, adjusted_deductible, adjusted_net, adjustment_notes, adjusted_at, ${COVERAGE_REL})`;

const RESERVE_COVERAGE_SELECT =
  `id, claim_reserve_id, claim_coverage_id, insured_amount, claimed_amount, reserved_amount, recovered_amount, deductible_amount, net_reserve, adjusted_amount, adjusted_deductible, adjusted_net, adjustment_notes, adjusted_at, ${COVERAGE_REL}`;

export async function getClaimReserves(claimId: string): Promise<ClaimReserve[]> {
  return fetchAll<ClaimReserve>("claim_reserves", {
    select: RESERVE_SELECT,
    eq: { claim_id: claimId, is_active: true },
    order: { column: "created_at", ascending: true },
  });
}

export async function getClaimReserveByAction(actionId: string): Promise<ClaimReserve | null> {
  const rows = await fetchAll<ClaimReserve>("claim_reserves", {
    select: RESERVE_SELECT,
    eq: { claim_action_id: actionId, is_active: true },
    limit: 1,
  });
  return rows[0] || null;
}

export async function createClaimReserve(input: {
  claim_id: string;
  claim_action_id?: string;
  reserve_number?: string;
  currency?: string;
  exchange_rate?: number;
  capital_amount?: number;
  claimed_amount?: number;
  deductible_amount?: number;
  reserve_amount?: number;
  final_amount?: number;
  status?: string;
  notes?: string;
  payment_date?: string;
  reserve_coverages?: { claim_coverage_id: string; insured_amount?: number; claimed_amount?: number; reserved_amount?: number; recovered_amount?: number; deductible_amount?: number; net_reserve?: number }[];
}): Promise<ClaimReserve> {
  const { reserve_coverages, ...reserveFields } = input;

  // 1. Insertar la reserva
  const reserve = await insertRow<ClaimReserve>("claim_reserves", reserveFields, RESERVE_SELECT);

  // 2. Insertar las coberturas de la reserva (si las hay)
  if (reserve_coverages && reserve_coverages.length > 0) {
    const rows = reserve_coverages.map((rc) => ({
      claim_reserve_id: reserve.id,
      ...rc,
    }));
    await insertMany("reserve_coverages", rows);
  }

  // 3. Re-fetch para incluir las reserve_coverages con relaciones
  const refreshed = await getClaimReserves(reserve.claim_id);
  return refreshed.find((r) => r.id === reserve.id) || reserve;
}

export async function updateClaimReserve(id: string, input: Partial<ClaimReserve>): Promise<ClaimReserve> {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined && k !== "reserve_coverages") set[k] = v; });

  return updateRow<ClaimReserve>("claim_reserves", id, set, RESERVE_SELECT);
}

export async function upsertReserveCoverage(reserveId: string, coverageId: string, input: Partial<ReserveCoverage>): Promise<ReserveCoverage> {
  // Supabase upsert via .upsert() with onConflict
  const supabase = getSupabaseClient();
  const row = {
    claim_reserve_id: reserveId,
    claim_coverage_id: coverageId,
    insured_amount: input.insured_amount ?? null,
    claimed_amount: input.claimed_amount ?? null,
    reserved_amount: input.reserved_amount ?? null,
    recovered_amount: input.recovered_amount ?? null,
    deductible_amount: input.deductible_amount ?? null,
    net_reserve: input.net_reserve ?? null,
    adjusted_amount: input.adjusted_amount ?? null,
    adjusted_deductible: input.adjusted_deductible ?? null,
    adjusted_net: input.adjusted_net ?? null,
    adjustment_notes: input.adjustment_notes ?? null,
  };

  const { data, error } = await supabase
    .from("reserve_coverages")
    .upsert(row, { onConflict: "claim_reserve_id,claim_coverage_id" })
    .select(RESERVE_COVERAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as ReserveCoverage;
}

export async function deactivateClaimReserve(id: string): Promise<ClaimReserve> {
  return updateClaimReserve(id, { is_active: false });
}
