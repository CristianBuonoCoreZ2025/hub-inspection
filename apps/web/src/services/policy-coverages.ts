import { fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

export interface PolicyCoverage {
  id: string;
  policy_number: string;
  coverage_name: string;
  subcoverage_name: string | null;
  insured_amount: number | null;
  deductible_amount: number | null;
  currency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const COVERAGE_SELECT = "id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at";

// Obtener coberturas de una póliza por número de póliza
export async function getPolicyCoverages(policyNumber: string): Promise<PolicyCoverage[]> {
  return fetchAll<PolicyCoverage>("policy_coverages", {
    select: COVERAGE_SELECT,
    eq: { policy_number: policyNumber, is_active: true },
    order: { column: "coverage_name", ascending: true },
  });
}

// Crear cobertura de póliza
export async function createPolicyCoverage(input: {
  policy_number: string;
  coverage_name: string;
  subcoverage_name?: string;
  insured_amount?: number;
  deductible_amount?: number;
  currency?: string;
}): Promise<PolicyCoverage> {
  return insertRow<PolicyCoverage>(
    "policy_coverages",
    {
      policy_number: input.policy_number,
      coverage_name: input.coverage_name,
      subcoverage_name: input.subcoverage_name || null,
      insured_amount: input.insured_amount ?? 0,
      deductible_amount: input.deductible_amount ?? 0,
      currency: input.currency || "CLP",
    },
    COVERAGE_SELECT,
  );
}

// Actualizar cobertura de póliza
export async function updatePolicyCoverage(id: string, input: Partial<PolicyCoverage>): Promise<PolicyCoverage> {
  const { ...set } = input;
  return updateRow<PolicyCoverage>("policy_coverages", id, set as Record<string, unknown>, COVERAGE_SELECT);
}

// Desactivar cobertura de póliza
export async function deactivatePolicyCoverage(id: string): Promise<PolicyCoverage> {
  return updatePolicyCoverage(id, { is_active: false });
}
