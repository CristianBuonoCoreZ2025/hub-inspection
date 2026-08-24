import { fetchAll, fetchById, insertRow, updateRow, deleteRow, updateWhere, insertMany, deleteWhere, getSupabaseClient } from "@/lib/supabase/db";

export interface Policy {
  id: string;
  policy_name: string;
  policy_number: string | null;
  policy_type: "individual" | "collective";
  insurance_company_id: string | null;
  country_id: string | null;
  broker_id: string | null;
  business_line_id: string | null;
  currency: string;
  premium_amount: number | null;
  insured_amount: number | null;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "expired" | "cancelled";
  comments: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Relaciones
  insurance_company?: { id: string; name: string } | null;
  broker?: { id: string; name: string } | null;
  business_line?: { id: string; name: string } | null;
  country?: { id: string; name: string } | null;
  policy_coverages?: PolicyCoverage[];
}

export interface PolicyCoverage {
  id: string;
  policy_id: string | null;
  policy_number: string;
  coverage_name: string;
  subcoverage_name: string | null;
  insured_amount: number | null;
  deductible_amount: number | null;
  currency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  coverage_catalog_id: string | null;
  subcoverage_catalog_id: string | null;
  coverage_catalog?: { code: string; name: string } | null;
  subcoverage_catalog?: { code: string; name: string } | null;
}

const POLICY_SELECT = "id, policy_name, policy_number, policy_type, insurance_company_id, country_id, broker_id, business_line_id, currency, premium_amount, insured_amount, start_date, end_date, status, comments, company_id, created_at, updated_at";

// Fetch related names separately (workaround for untracked Hasura relationships)
export async function getPolicyRelations(ids: {
  insuranceCompanyIds?: string[];
  brokerIds?: string[];
  businessLineIds?: string[];
  countryIds?: string[];
}): Promise<{
  insuranceCompanies: Record<string, { id: string; name: string }>;
  brokers: Record<string, { id: string; name: string }>;
  businessLines: Record<string, { id: string; name: string }>;
  countries: Record<string, { id: string; name: string }>;
}> {
  const [ins, brk, bl, ctry] = await Promise.all([
    ids.insuranceCompanyIds?.length
      ? fetchAll<{ id: string; name: string }>("insurance_companies", {
          select: "id, name",
          in: { id: ids.insuranceCompanyIds },
        })
      : Promise.resolve([]),
    ids.brokerIds?.length
      ? fetchAll<{ id: string; name: string }>("brokers", {
          select: "id, name",
          in: { id: ids.brokerIds },
        })
      : Promise.resolve([]),
    ids.businessLineIds?.length
      ? fetchAll<{ id: string; name: string }>("business_lines", {
          select: "id, name",
          in: { id: ids.businessLineIds },
        })
      : Promise.resolve([]),
    ids.countryIds?.length
      ? fetchAll<{ id: string; name: string }>("countries", {
          select: "id, name",
          in: { id: ids.countryIds },
        })
      : Promise.resolve([]),
  ]);

  return {
    insuranceCompanies: Object.fromEntries((ins || []).map((x) => [x.id, x])),
    brokers: Object.fromEntries((brk || []).map((x) => [x.id, x])),
    businessLines: Object.fromEntries((bl || []).map((x) => [x.id, x])),
    countries: Object.fromEntries((ctry || []).map((x) => [x.id, x])),
  };
}

// Obtener compañías de seguros que tienen pólizas (para filtros)
// Usa GraphQL normal (no run_sql) para funcionar en cliente
export async function getInsuranceCompaniesWithPolicies(companyId?: string): Promise<{ id: string; name: string; policy_count: number }[]> {
  const [policies, companies] = await Promise.all([
    fetchAll<{ insurance_company_id: string | null }>("policies", {
      select: "insurance_company_id",
      ...(companyId ? { eq: { company_id: companyId } } : {}),
    }),
    fetchAll<{ id: string; name: string }>("insurance_companies", {
      select: "id, name",
      order: { column: "name", ascending: true },
    }),
  ]);

  // Contar pólizas por compañía (solo las que tienen company_id asignado)
  const counts: Record<string, number> = {};
  policies.forEach((p) => {
    if (p.insurance_company_id) {
      counts[p.insurance_company_id] = (counts[p.insurance_company_id] || 0) + 1;
    }
  });

  // Filtrar compañías que tienen pólizas y agregar el count
  return companies
    .filter((c) => counts[c.id])
    .map((c) => ({ ...c, policy_count: counts[c.id] }))
    .sort((a, b) => b.policy_count - a.policy_count);
}

// Obtener corredores que tienen pólizas (para filtros)
export async function getBrokersWithPolicies(companyId?: string): Promise<{ id: string; name: string; policy_count: number }[]> {
  const [policies, brokers] = await Promise.all([
    fetchAll<{ broker_id: string | null }>("policies", {
      select: "broker_id",
      ...(companyId ? { eq: { company_id: companyId } } : {}),
    }),
    fetchAll<{ id: string; name: string }>("brokers", {
      select: "id, name",
      order: { column: "name", ascending: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  policies.forEach((p) => {
    if (p.broker_id) {
      counts[p.broker_id] = (counts[p.broker_id] || 0) + 1;
    }
  });

  return brokers
    .filter((b) => counts[b.id])
    .map((b) => ({ ...b, policy_count: counts[b.id] }))
    .sort((a, b) => b.policy_count - a.policy_count);
}

// Obtener líneas de negocio que tienen pólizas (para filtros)
export async function getBusinessLinesWithPolicies(companyId?: string): Promise<{ id: string; name: string; policy_count: number }[]> {
  const [policies, businessLines] = await Promise.all([
    fetchAll<{ business_line_id: string | null }>("policies", {
      select: "business_line_id",
      ...(companyId ? { eq: { company_id: companyId } } : {}),
    }),
    fetchAll<{ id: string; name: string }>("business_lines", {
      select: "id, name",
      order: { column: "name", ascending: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  policies.forEach((p) => {
    if (p.business_line_id) {
      counts[p.business_line_id] = (counts[p.business_line_id] || 0) + 1;
    }
  });

  return businessLines
    .filter((b) => counts[b.id])
    .map((b) => ({ ...b, policy_count: counts[b.id] }))
    .sort((a, b) => b.policy_count - a.policy_count);
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

export async function getPolicies(params: {
  companyId?: string;
  insuranceCompanyId?: string;
  brokerId?: string;
  businessLineId?: string;
  status?: string;
}): Promise<Policy[]> {
  const eq: Record<string, string> = {};
  if (params.companyId) eq.company_id = params.companyId;
  if (params.insuranceCompanyId) eq.insurance_company_id = params.insuranceCompanyId;
  if (params.brokerId) eq.broker_id = params.brokerId;
  if (params.businessLineId) eq.business_line_id = params.businessLineId;
  if (params.status) eq.status = params.status;

  return fetchAll<Policy>("policies", {
    select: POLICY_SELECT,
    ...(Object.keys(eq).length > 0 ? { eq } : {}),
    order: { column: "created_at", ascending: false },
  });
}

export async function getPolicyById(id: string): Promise<Policy | null> {
  return fetchById<Policy>("policies", id, POLICY_SELECT);
}

export async function getPolicyCoveragesByPolicyIdDirect(policyId: string): Promise<PolicyCoverage[]> {
  return fetchAll<PolicyCoverage>("policy_coverages", {
    select: "id, policy_id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at, coverage_catalog_id, subcoverage_catalog_id",
    eq: { policy_id: policyId, is_active: true },
    order: { column: "coverage_name", ascending: true },
  });
}

export async function getPolicyByNumber(policyNumber: string): Promise<Policy | null> {
  const policies = await fetchAll<Policy>("policies", {
    select: POLICY_SELECT,
    eq: { policy_number: policyNumber },
    limit: 1,
  });
  return policies[0] || null;
}

export async function searchPolicies(searchTerm: string, companyId?: string): Promise<Policy[]> {
  const supabase = getSupabaseClient();
  const pattern = `%${searchTerm}%`;
  let query = supabase
    .from("policies")
    .select(POLICY_SELECT)
    .or(`policy_number.ilike.${pattern},policy_name.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Policy[]) ?? [];
}

// ═══════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════

export async function createPolicy(input: {
  policy_name: string;
  policy_number?: string | null;
  policy_type?: "individual" | "collective";
  insurance_company_id?: string | null;
  country_id?: string | null;
  broker_id?: string | null;
  business_line_id?: string | null;
  currency?: string;
  premium_amount?: number;
  insured_amount?: number | null;
  start_date: string;
  end_date: string;
  status?: string;
  comments?: string | null;
  company_id: string;
}): Promise<Policy> {
  return insertRow<Policy>(
    "policies",
    {
      policy_name: input.policy_name,
      policy_number: input.policy_number || null,
      policy_type: input.policy_type || "individual",
      insurance_company_id: input.insurance_company_id || null,
      country_id: input.country_id || null,
      broker_id: input.broker_id || null,
      business_line_id: input.business_line_id || null,
      currency: input.currency || "CLP",
      premium_amount: input.premium_amount ?? 0,
      insured_amount: input.insured_amount ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status || "active",
      comments: input.comments || null,
      company_id: input.company_id,
    },
    POLICY_SELECT,
  );
}

export async function updatePolicy(id: string, input: Partial<Policy>): Promise<Policy> {
  const set: Record<string, unknown> = {};
  Object.entries(input).forEach(([k, v]) => {
    if (v !== undefined && !["id", "created_at", "updated_at", "insurance_company", "broker", "business_line", "country", "policy_coverages"].includes(k)) {
      set[k] = v;
    }
  });

  return updateRow<Policy>("policies", id, set, POLICY_SELECT);
}

export async function deletePolicy(id: string): Promise<boolean> {
  await deleteRow("policies", id);
  return true;
}

// ═══════════════════════════════════════════════════════════════
// Coberturas de póliza
// ═══════════════════════════════════════════════════════════════

export async function getPolicyCoveragesByPolicyId(policyId: string): Promise<PolicyCoverage[]> {
  return fetchAll<PolicyCoverage>("policy_coverages", {
    select: "id, policy_id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at, coverage_catalog_id, subcoverage_catalog_id, coverage_catalog:coverage_catalog!policy_coverages_coverage_catalog_id_fkey(code, name), subcoverage_catalog:subcoverage_catalog!policy_coverages_subcoverage_catalog_id_fkey(code, name)",
    eq: { policy_id: policyId, is_active: true },
    order: { column: "coverage_name", ascending: true },
  });
}

export async function createPolicyCoverageForPolicy(input: {
  policy_id: string;
  policy_number: string;
  coverage_name: string;
  subcoverage_name?: string;
  insured_amount?: number | null;
  deductible_amount?: number | null;
  currency?: string;
  coverage_catalog_id?: string;
  subcoverage_catalog_id?: string;
}): Promise<PolicyCoverage> {
  return insertRow<PolicyCoverage>(
    "policy_coverages",
    {
      policy_id: input.policy_id,
      policy_number: input.policy_number,
      coverage_name: input.coverage_name,
      subcoverage_name: input.subcoverage_name || null,
      insured_amount: input.insured_amount ?? null,
      deductible_amount: input.deductible_amount ?? null,
      currency: input.currency || "CLP",
      coverage_catalog_id: input.coverage_catalog_id || null,
      subcoverage_catalog_id: input.subcoverage_catalog_id || null,
    },
    "id, policy_id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at",
  );
}

export async function updatePolicyCoverage(id: string, input: Record<string, unknown>): Promise<PolicyCoverage> {
  return updateRow<PolicyCoverage>(
    "policy_coverages",
    id,
    input,
    "id, policy_id, policy_number, coverage_name, subcoverage_name, insured_amount, deductible_amount, currency, is_active, created_at, updated_at",
  );
}

export async function deactivatePolicyCoverage(id: string): Promise<PolicyCoverage> {
  return updatePolicyCoverage(id, { is_active: false });
}

// Desactivar una cobertura y todas sus subcoberturas asociadas
export async function deactivatePolicyCoverageWithSubcoverages(
  policyId: string,
  coverageCatalogId: string
): Promise<void> {
  await updateWhere("policy_coverages", { is_active: false }, {
    policy_id: policyId,
    coverage_catalog_id: coverageCatalogId,
    is_active: true,
  });
}

// Insertar múltiples coberturas/subcoberturas de una vez
export async function createPolicyCoveragesBatch(
  policyId: string,
  policyNumber: string,
  items: Array<{
    coverage_catalog_id: string;
    subcoverage_catalog_id?: string | null;
    coverage_name: string;
    subcoverage_name?: string | null;
    insured_amount?: number | null;
    deductible_amount?: number | null;
    currency?: string;
  }>
): Promise<void> {
  if (items.length === 0) return;
  const objects = items.map((item) => ({
    policy_id: policyId,
    policy_number: policyNumber,
    coverage_name: item.coverage_name,
    subcoverage_name: item.subcoverage_name || null,
    insured_amount: item.insured_amount ?? null,
    deductible_amount: item.deductible_amount ?? null,
    currency: item.currency || "CLP",
    coverage_catalog_id: item.coverage_catalog_id || null,
    subcoverage_catalog_id: item.subcoverage_catalog_id || null,
  }));

  await insertMany("policy_coverages", objects);
}

// ═══════════════════════════════════════════════════════════════
// Líneas de negocio de una póliza (N:M)
// ═══════════════════════════════════════════════════════════════

export interface PolicyBusinessLine {
  id: string;
  policy_id: string;
  business_line_id: string;
  is_primary: boolean;
  business_line?: { id: string; name: string } | null;
}

export async function getPolicyBusinessLines(policyId: string): Promise<PolicyBusinessLine[]> {
  return fetchAll<PolicyBusinessLine>("policy_business_lines", {
    select: "id, policy_id, business_line_id, is_primary",
    eq: { policy_id: policyId },
    order: { column: "is_primary", ascending: false },
  });
}

export async function setPolicyBusinessLines(
  policyId: string,
  businessLineIds: string[],
  primaryId?: string
): Promise<void> {
  // Eliminar todas las relaciones existentes
  await deleteWhere("policy_business_lines", { policy_id: policyId });

  // Insertar las nuevas
  if (businessLineIds.length > 0) {
    await insertMany(
      "policy_business_lines",
      businessLineIds.map((blId) => ({
        policy_id: policyId,
        business_line_id: blId,
        is_primary: blId === primaryId,
      })),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Documentos de póliza (físicos — subidos manualmente)
// ═══════════════════════════════════════════════════════════════

export interface PolicyDocument {
  id: string;
  policy_id: string;
  document_name: string;
  document_url: string | null;
  document_type: string | null;
  file_size: number | null;
  is_active: boolean;
  ai_summary: string | null;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPolicyDocuments(policyId: string): Promise<PolicyDocument[]> {
  return fetchAll<PolicyDocument>("policy_documents", {
    select: "id, policy_id, document_name, document_url, document_type, file_size, is_active, ai_summary, ai_model, created_at, updated_at",
    eq: { policy_id: policyId, is_active: true },
    order: { column: "created_at", ascending: false },
  });
}

export async function createPolicyDocument(input: {
  policy_id: string;
  document_name: string;
  document_url: string;
  document_type?: string;
  file_size?: number;
}): Promise<PolicyDocument> {
  return insertRow<PolicyDocument>(
    "policy_documents",
    {
      policy_id: input.policy_id,
      document_name: input.document_name,
      document_url: input.document_url,
      document_type: input.document_type || null,
      file_size: input.file_size || null,
      is_active: true,
    },
    "id, policy_id, document_name, document_url, document_type, file_size, is_active, created_at, updated_at",
  );
}

export async function deactivatePolicyDocument(id: string): Promise<void> {
  await updateRow("policy_documents", id, { is_active: false }, "id");
}
