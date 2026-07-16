import { fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

export interface ClaimCoverage {
  id: string;
  claim_id: string;
  claim_action_id: string | null;
  policy_coverage_id: string | null;
  coverage_catalog_id: string | null;
  coverage_name: string | null;
  subcoverage_name: string | null;
  insured_amount: number | null;
  claimed_amount: number | null;
  reserved_amount: number | null;
  recovered_amount: number | null;
  deductible_amount: number | null;
  net_reserve: number | null;
  currency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  policy_coverage?: {
    id: string;
    coverage_catalog?: { code: string; name: string } | null;
    subcoverage_catalog?: { code: string; name: string } | null;
  } | null;
  coverage_catalog?: { code: string; name: string } | null;
}

const COVERAGE_SELECT =
  "id, claim_id, claim_action_id, policy_coverage_id, coverage_catalog_id, coverage_name, subcoverage_name, insured_amount, claimed_amount, reserved_amount, recovered_amount, deductible_amount, net_reserve, currency, is_active, created_at, updated_at, policy_coverage:policy_coverages!claim_coverages_policy_coverage_id_fkey(id, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name)), coverage_catalog:coverage_catalog!claim_coverages_coverage_catalog_id_fkey(code, name)";

const COVERAGE_INSERT_SELECT =
  "id, claim_id, claim_action_id, policy_coverage_id, coverage_catalog_id, coverage_name, subcoverage_name, insured_amount, claimed_amount, reserved_amount, recovered_amount, deductible_amount, net_reserve, currency, is_active, created_at, updated_at";

export async function getClaimCoverages(claimId: string): Promise<ClaimCoverage[]> {
  return fetchAll<ClaimCoverage>("claim_coverages", {
    select: COVERAGE_SELECT,
    eq: { claim_id: claimId, is_active: true },
    order: { column: "created_at", ascending: true },
  });
}

export async function getClaimCoveragesByAction(claimId: string, actionId: string): Promise<ClaimCoverage[]> {
  return fetchAll<ClaimCoverage>("claim_coverages", {
    select: COVERAGE_SELECT,
    eq: { claim_id: claimId, claim_action_id: actionId, is_active: true },
    order: { column: "created_at", ascending: true },
  });
}

/**
 * Obtiene las coberturas del siniestro que fueron ingresadas via una gestión
 * de Ingreso de Coberturas (tienen claim_action_id no nulo).
 * Esto alimenta la cadena: Ingreso de Coberturas → Reserva → Ajuste
 */
export async function getClaimCoveragesFromIngreso(claimId: string): Promise<ClaimCoverage[]> {
  return fetchAll<ClaimCoverage>("claim_coverages", {
    select: COVERAGE_SELECT,
    eq: { claim_id: claimId, is_active: true },
    order: { column: "created_at", ascending: true },
  }).then((rows) => rows.filter((r) => r.claim_action_id !== null));
}

export async function createClaimCoverage(input: {
  claim_id: string;
  claim_action_id?: string;
  policy_coverage_id?: string;
  coverage_catalog_id?: string;
  coverage_name?: string;
  subcoverage_name?: string;
  insured_amount?: number;
  claimed_amount?: number;
  reserved_amount?: number;
  recovered_amount?: number;
  deductible_amount?: number;
  net_reserve?: number;
  currency?: string;
}): Promise<ClaimCoverage> {
  return insertRow<ClaimCoverage>("claim_coverages", input, COVERAGE_INSERT_SELECT);
}

export async function updateClaimCoverage(id: string, input: Partial<ClaimCoverage>): Promise<ClaimCoverage> {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => { if (v !== undefined) set[k] = v; });

  return updateRow<ClaimCoverage>("claim_coverages", id, set, COVERAGE_INSERT_SELECT);
}

export async function deactivateClaimCoverage(id: string): Promise<ClaimCoverage> {
  return updateClaimCoverage(id, { is_active: false });
}
