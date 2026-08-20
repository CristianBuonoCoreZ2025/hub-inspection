import { fetchAll, fetchById, insertRow, updateRow, deleteRow, deleteWhere } from "@/lib/supabase/db";
import { getSupabaseClient } from "@/lib/supabase/client";
import { rutBodyNumber } from "@/lib/validations/rut";
import type { Claim, ClaimInput, ClaimsParticipant } from "@/types";

const LIGHT_CLAIM_SELECT =
  "id, claim_number, policy_number, policy_id, claim_date, status_id, report_date, assignment_date, client_reference, company_report_number, liquidation_number, is_special_claim, summary, event_id, internal_number, notes, company_id, assigned_adjuster_id, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, claim_cause_id, claim_type_id, business_line_id, insurance_product_id, country_id, region_id, city_id, commune_id, construction_type_id, destination_housing_id, damage_classification_id, habitability_id, type_id, currency_id, service_type_id, billing_type_id, claim_address, claim_latitude, claim_longitude, owner_same_as_insured, policy_item, policy_start_date, policy_end_date, policy_amount, policy_premium, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, updated_at, updated_by, disabled, disabled_reason, disabled_at, disabled_by, reopened_at, reopened_by, reopened_reason";

const DYNAMIC_CLAIM_SELECT =
  `${LIGHT_CLAIM_SELECT}, status:lookup_catalog!claims_status_id_fkey(id, category, code, name), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name, email), adjuster:profiles!claims_adjuster_id_fkey(id, full_name, email), broker:brokers!claims_broker_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), policy:policies!claims_policy_id_fkey(id, policy_number, policy_name, status, currency), currency:currencies!claims_currency_id_fkey(id, code, name, symbol, decimals), country:countries!claims_country_id_fkey(id, name), region:regions!claims_region_id_fkey(id, name), city:cities!claims_city_id_fkey(id, name), commune:communes!claims_commune_id_fkey(id, name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(id, name), business_line:business_lines!claims_business_line_id_fkey(id, name), claim_type:claim_types!claims_claim_type_id_fkey(id, name), claims_participants:claims_participants(claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, person_type, country, region, city, commune, is_active, linked_to_insured)`;

const CLAIM_SELECT =
  `${DYNAMIC_CLAIM_SELECT}, inspector:profiles!claims_inspector_id_fkey(id, full_name, email), auditor:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant:profiles!claims_assistant_id_fkey(id, full_name, email)`;

const CLAIM_WITH_INSPECTIONS_SELECT =
  `${CLAIM_SELECT}, inspection_sessions:inspection_sessions!inspection_sessions_claim_id_fkey(id, claim_action_id, inspector_id, status, inspection_number, inspection_type, scheduled_at, started_at, ended_at, lock_overridden_by, lock_overridden_at)`;



export async function getClaims(
  companyId?: string,
  options?: {
    page?: number;
    pageSize?: number;
    statusIds?: string[];
    insuranceCompanyIds?: string[];
    liquidation?: string;
    adjusterIds?: string[];
    inspectorIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    sortKey?: string | null;
    sortDir?: "asc" | "desc";
    q?: string;
  }
) {
  const supabase = getSupabaseClient();

  let searchClaimIds: string[] = [];
  const q = options?.q?.trim();
  if (q) {
    const { data: searchData, error: searchErr } = await supabase.rpc("search_claims_unaccent", { p_q: q });
    if (searchErr) throw new Error(searchErr.message);
    searchClaimIds = (searchData || []).map((r: { claim_id: string }) => r.claim_id);
  }

  const columnMap: Record<string, string> = {
    liquidation_number: "liquidation_number",
    client_reference: "client_reference",
    claim_number: "claim_number",
    claim_date: "claim_date",
    report_date: "report_date",
    created_at: "created_at",
    status: "status_id",
  };

  const hasPagination = options?.page !== undefined || options?.pageSize !== undefined;
  const effectivePageSize = hasPagination
    ? Math.max(1, Math.min(options?.pageSize ?? 50, 100))
    : undefined;
  const effectivePage = hasPagination ? Math.max(1, options?.page ?? 1) : undefined;
  const from = hasPagination && effectivePageSize && effectivePage
    ? (effectivePage - 1) * effectivePageSize
    : undefined;
  const to = hasPagination && from !== undefined && effectivePageSize
    ? from + effectivePageSize - 1
    : undefined;

  const orderColumn = (options?.sortKey && columnMap[options.sortKey]) ? columnMap[options.sortKey] : "created_at";
  const ascending = (options?.sortDir === "asc");

  let query = supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .eq("disabled", false)
    .order(orderColumn, { ascending });

  if (companyId) query = query.eq("company_id", companyId);
  if (effectivePageSize !== undefined) query = query.limit(effectivePageSize);
  if (from !== undefined && to !== undefined) query = query.range(from, to);
  if (options?.statusIds?.length) query = query.in("status_id", options.statusIds);
  if (options?.insuranceCompanyIds?.length) query = query.in("insurance_company_id", options.insuranceCompanyIds);
  if (options?.liquidation) query = query.ilike("liquidation_number", `%${options.liquidation}%`);
  if (options?.adjusterIds?.length) query = query.in("adjuster_id", options.adjusterIds);
  if (options?.inspectorIds?.length) query = query.in("inspector_id", options.inspectorIds);
  if (options?.dateFrom) query = query.gte("claim_date", options.dateFrom);
  if (options?.dateTo) query = query.lte("claim_date", options.dateTo);

  if (q) {
    if (searchClaimIds.length) {
      query = query.in("id", searchClaimIds);
    } else {
      // No hubo coincidencias: forzar resultado vacío
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as Claim[]) || [];
}

export async function checkClaimNumberExists(claimNumber: string, insuranceCompanyId: string, excludeClaimId?: string) {
  const eq: Record<string, unknown> = {
    claim_number: claimNumber,
    insurance_company_id: insuranceCompanyId,
  };
  const neq: Record<string, unknown> = {};
  if (excludeClaimId) neq.id = excludeClaimId;

  const rows = await fetchAll<{ id: string; claim_number: string }>("claims", {
    select: "id, claim_number",
    eq,
    neq: Object.keys(neq).length > 0 ? neq : undefined,
    limit: 1,
  });
  return rows.length > 0;
}

export async function findParticipantByRut(rut: string, country: string) {
  if (!rut || !country) return null;
  const rows = await fetchAll<ParticipantMatch>("claims_participants", {
    select: "id, type, person_type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune",
    ilike: { rut, country },
    limit: 1,
    order: { column: "created_at", ascending: false },
  });
  return rows[0] || null;
}

export type ParticipantMatch = {
  id: string;
  type: string;
  person_type: "natural" | "legal";
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  rut: string | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  commune: string | null;
};

export async function getClaimsParticipants(claimIds: string[]) {
  if (claimIds.length === 0) return [];
  type Participant = {
    id: string;
    claim_id: string;
    type: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    rut: string | null;
    email: string | null;
    phone: string | null;
    cell_phone: string | null;
    address: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    commune: string | null;
  };
  // PostgREST limita a 200 filas por defecto y tiene un limite en el
  // numero de valores del filtro `in`. Traer en batches de 100 claim_ids
  // y paginar cada batch hasta traer todos los participantes.
  const BATCH_SIZE = 100;
  const all: Participant[] = [];
  for (let i = 0; i < claimIds.length; i += BATCH_SIZE) {
    const batch = claimIds.slice(i, i + BATCH_SIZE);
    let from = 0;
    while (true) {
      const rows = await fetchAll<Participant>("claims_participants", {
        select: "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune",
        in: { claim_id: batch },
        range: { from, to: from + 199 },
      });
      all.push(...rows);
      if (rows.length < 200) break;
      from += 200;
    }
  }
  return all;
}

export async function getClaimById(id: string) {
  return fetchById<Claim>("claims", id, CLAIM_WITH_INSPECTIONS_SELECT);
}


export async function getClaimsCount(
  companyId?: string,
  options?: {
    statusIds?: string[];
    insuranceCompanyIds?: string[];
    liquidation?: string;
    adjusterIds?: string[];
    inspectorIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    q?: string;
  }
) {
  const supabase = getSupabaseClient();

  let searchClaimIds: string[] = [];
  const q = options?.q?.trim();
  if (q) {
    const { data: searchData, error: searchErr } = await supabase.rpc("search_claims_unaccent", { p_q: q });
    if (searchErr) throw new Error(searchErr.message);
    searchClaimIds = (searchData || []).map((r: { claim_id: string }) => r.claim_id);
  }

  let query = supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false);

  if (companyId) query = query.eq("company_id", companyId);
  if (options?.statusIds?.length) query = query.in("status_id", options.statusIds);
  if (options?.insuranceCompanyIds?.length) query = query.in("insurance_company_id", options.insuranceCompanyIds);
  if (options?.liquidation) query = query.ilike("liquidation_number", `%${options.liquidation}%`);
  if (options?.adjusterIds?.length) query = query.in("adjuster_id", options.adjusterIds);
  if (options?.inspectorIds?.length) query = query.in("inspector_id", options.inspectorIds);
  if (options?.dateFrom) query = query.gte("claim_date", options.dateFrom);
  if (options?.dateTo) query = query.lte("claim_date", options.dateTo);

  if (q) {
    if (searchClaimIds.length) {
      query = query.in("id", searchClaimIds);
    } else {
      // No hubo coincidencias: forzar resultado vacío
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}


export async function disableClaim(id: string, reason: string, userId?: string) {
  return updateRow<{ id: string; disabled: boolean }>("claims", id, {
    disabled: true,
    disabled_reason: reason,
    disabled_at: new Date().toISOString(),
    disabled_by: userId || null,
    updated_by: userId || null,
  }, "id, disabled");
}

export async function enableClaim(id: string, userId?: string) {
  return updateRow<{ id: string; disabled: boolean }>("claims", id, {
    disabled: false,
    disabled_reason: null,
    disabled_at: null,
    disabled_by: null,
    updated_by: userId || null,
  }, "id, disabled");
}

export async function getDisabledClaims(companyId?: string) {
  const eq: Record<string, unknown> = { disabled: true };
  if (companyId) eq.company_id = companyId;

  return fetchAll<Claim>("claims", {
    select: CLAIM_SELECT,
    eq,
    order: { column: "disabled_at", ascending: false },
  });
}

export async function getClosedClaims() {
  // Obtener el status_id correspondiente a "closed"
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "claim_status", code: "closed" },
    limit: 1,
  });
  const closedStatusId = statusRows[0]?.id;
  if (!closedStatusId) throw new Error("No se encontró el estado 'closed'");

  return fetchAll<Claim>("claims", {
    select: CLAIM_SELECT,
    eq: { status_id: closedStatusId, disabled: false },
    order: { column: "updated_at", ascending: false },
  });
}

export async function reopenClaim(id: string, reason: string, userId?: string) {
  // Obtener el status_id correspondiente a "reopened"
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "claim_status", code: "reopened" },
    limit: 1,
  });
  const reopenedStatusId = statusRows[0]?.id;
  if (!reopenedStatusId) throw new Error("No se encontró el estado 'reopened'");

  // 1. Cambiar estado del siniestro a "reopened"
  const data = await updateRow<{ id: string }>("claims", id, {
    status_id: reopenedStatusId,
    reopened_reason: reason,
    reopened_at: new Date().toISOString(),
    reopened_by: userId || null,
  }, "id, status_id, reopened_at, reopened_reason");

  // 2. Crear claim_action de reapertura (registra el motivo individual)
  //    action_features_id para "Reapertura" = a1000001-0000-0000-0000-000000000012
  //    action_template_id para "Reapertura" = b2000001-0000-0000-0000-000000000013
  try {
    await insertRow("claim_actions", {
      claim_id: id,
      action_features_id: "a1000001-0000-0000-0000-000000000012",
      action_template_id: "b2000001-0000-0000-0000-000000000013",
      name: "Reapertura",
      description: reason,
      code: "REA",
      action_data: { reason },
      is_blocker: false,
      created_by: userId || null,
      issued_by: userId || null,
      issued_on: new Date().toISOString(),
    }, "id");
  } catch (e) {
    // No fallar la reapertura si no se puede crear la acción
    console.error("No se pudo crear claim_action de reapertura:", e);
  }

  return data;
}

// ═══ Cerrar siniestro (gestión de cierre) ═══

export async function closeClaim(id: string, reason: string, closeReasonId: string | null, userId?: string) {
  // Obtener el status_id correspondiente a "closed"
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "claim_status", code: "closed" },
    limit: 1,
  });
  const closedStatusId = statusRows[0]?.id;
  if (!closedStatusId) throw new Error("No se encontró el estado 'closed'");

  // 1. Cambiar estado del siniestro a "closed"
  const data = await updateRow<{ id: string }>("claims", id, {
    status_id: closedStatusId,
  }, "id, status_id");

  // 2. Crear claim_action de cierre
  try {
    await insertRow("claim_actions", {
      claim_id: id,
      action_features_id: "a1000001-0000-0000-0000-000000000011",
      action_template_id: "b2000001-0000-0000-0000-000000000012",
      name: "Cierre de carpeta",
      description: reason,
      code: "C",
      action_data: { reason, close_reason_id: closeReasonId || null },
      is_blocker: false,
      created_by: userId || null,
      issued_by: userId || null,
      issued_on: new Date().toISOString(),
    }, "id");
  } catch (e) {
    console.error("No se pudo crear claim_action de cierre:", e);
  }

  return data;
}

// ═══ Despachar siniestro (gestión de despacho) ═══

export async function dispatchClaim(id: string, notes: string, userId?: string) {
  // Obtener el status_id correspondiente a "dispatchment"
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "claim_status", code: "dispatchment" },
    limit: 1,
  });
  const dispatchmentStatusId = statusRows[0]?.id;
  if (!dispatchmentStatusId) throw new Error("No se encontró el estado 'dispatchment'");

  // 1. Cambiar estado del siniestro a "dispatchment"
  const data = await updateRow<{ id: string }>("claims", id, {
    status_id: dispatchmentStatusId,
  }, "id, status_id");

  // 2. Crear claim_action de solicitud de despacho
  try {
    await insertRow("claim_actions", {
      claim_id: id,
      action_features_id: "a1000001-0000-0000-0000-000000000020",
      action_template_id: "b2000001-0000-0000-0000-000000000014",
      name: "Solicitud de Despacho",
      description: notes,
      code: "DES",
      action_data: { notes },
      is_blocker: false,
      created_by: userId || null,
      issued_by: userId || null,
      issued_on: new Date().toISOString(),
    }, "id");
  } catch (e) {
    console.error("No se pudo crear claim_action de despacho:", e);
  }

  return data;
}

export async function getReopenedClaims() {
  // Obtener el status_id correspondiente a "reopened"
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "claim_status", code: "reopened" },
    limit: 1,
  });
  const reopenedStatusId = statusRows[0]?.id;
  if (!reopenedStatusId) throw new Error("No se encontró el estado 'reopened'");

  return fetchAll<Claim>("claims", {
    select: CLAIM_SELECT,
    eq: { status_id: reopenedStatusId, disabled: false },
    order: { column: "reopened_at", ascending: false },
  });
}

export async function getClaimParticipants(id: string): Promise<ClaimsParticipant[]> {
  return fetchAll<ClaimsParticipant>("claims_participants", {
    select: "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, person_type, country, region, city, commune, linked_to_insured",
    eq: { claim_id: id },
  });
}

function buildClaimObject(input: Partial<ClaimInput> & { company_id?: string }): Record<string, unknown> {
  return {
    claim_number: input.claimNumber,
    policy_number: input.policyNumber,
    claim_date: input.claimDate,
    status_id: input.statusId || null,
    report_date: input.reportDate || null,
    assignment_date: input.assignmentDate || null,
    client_reference: input.clientReference || null,
    summary: input.summary || null,
    company_id: input.company_id,
  };
}

export async function createClaim(input: ClaimInput & { company_id: string }) {
  const claim = await insertRow<Claim>("claims", { ...buildClaimObject(input) }, CLAIM_SELECT);
  // No se geocodifica automáticamente — las coordenadas deben venir del
  // selector manual de ubicación.
  return claim;
}

// ═══════════════════════════════════════════════════════════════
// CREACIÓN MÍNIMA (modal rápido desde grilla)
// ═══════════════════════════════════════════════════════════════

export async function createClaimMinimal(
  input: {
    claimNumber: string;
    policyNumber: string;
    claimDate: string;
    clientReference?: string | null;
    assignmentDate?: string | null;
    reportDate?: string | null;
    summary?: string | null;
    statusId?: string | null;
    inspectorId?: string | null;
    adjusterId?: string | null;
    auditorId?: string | null;
    dispatcherId?: string | null;
    assistantId?: string | null;
    insuranceCompanyId?: string | null;
    claimTypeId?: string | null;
    claimCauseId?: string | null;
    businessLineId?: string | null;
    insuranceProductId?: string | null;
    advisorId?: string | null;
    brokerId?: string | null;
    eventId?: string | null;
    constructionTypeId?: string | null;
    habitabilityId?: string | null;
    destinationHousingId?: string | null;
    damageClassificationId?: string | null;
    propertyClassificationId?: string | null;
    ownerSameAsInsured?: boolean | null;
    company_id: string;
    countryId?: string | null;
    // ── Campos nuevos para importación masiva ──
    policyItem?: string | null;
    policyStartDate?: string | null;
    policyEndDate?: string | null;
    policyAmount?: number | null;
    policyPremium?: number | null;
    currencyId?: string | null;
    internalNumber?: string | null;
    isSpecialClaim?: boolean | null;
    brokerExecutive?: string | null;
    companyReportNumber?: string | null;
    createdAt?: string | null;
    // ── Campos adicionales de claims ──
    recoveryTypeLegal?: boolean | null;
    recoveryTypeMaterial?: boolean | null;
    recoveryComments?: string | null;
    claimLatitude?: number | null;
    claimLongitude?: number | null;
    regionId?: string | null;
    cityId?: string | null;
    communeId?: string | null;
    policyId?: string | null;
    typeId?: string | null;
    assignedAdjusterId?: string | null;
    notes?: string | null;
  },
  insured: {
    insuredName: string;
    lastName?: string | null;
    rut?: string | null;
    insuredEmail?: string | null;
    insuredPhone?: string | null;
    cellPhone: string;
    insuredAddress?: string | null;
    insuredCountry?: string | null;
    insuredRegion?: string | null;
    insuredCity?: string | null;
    insuredCommune?: string | null;
    insuredPersonType?: string | null;
  },
  claimAddress: {
    claimAddress: string;
    claimCountry?: string | null;
    claimRegion?: string | null;
    claimCity?: string | null;
    claimCommune?: string | null;
    claimLatitude?: number | null;
    claimLongitude?: number | null;
  },
  contractor?: {
    contractorName: string;
    contractorLastName?: string | null;
    contractorRut?: string | null;
    contractorEmail?: string | null;
    contractorCellPhone?: string | null;
    contractorPhone?: string | null;
    contractorAddress?: string | null;
    contractorCountry?: string | null;
    contractorRegion?: string | null;
    contractorCity?: string | null;
    contractorCommune?: string | null;
    contractorPersonType?: string | null;
  } | null,
  beneficiary?: {
    beneficiaryName: string;
    beneficiaryLastName?: string | null;
    beneficiaryRut?: string | null;
    beneficiaryEmail?: string | null;
    beneficiaryCellPhone?: string | null;
    beneficiaryPhone?: string | null;
    beneficiaryAddress?: string | null;
    beneficiaryCountry?: string | null;
    beneficiaryRegion?: string | null;
    beneficiaryCity?: string | null;
    beneficiaryCommune?: string | null;
    beneficiaryPersonType?: string | null;
  } | null,
  contact?: {
    contactName?: string | null;
    contactLastName?: string | null;
    contactRole?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactRut?: string | null;
    contactAddress?: string | null;
    contactCountry?: string | null;
    contactRegion?: string | null;
    contactCity?: string | null;
    contactCommune?: string | null;
    contactPersonType?: string | null;
  } | null,
  linkParticipants?: boolean,
  linkContact?: boolean
) {
  // 1. Crear claim
  const claim = await insertRow<Claim>("claims", {
    claim_number: input.claimNumber,
    policy_number: input.policyNumber,
    claim_date: input.claimDate,
    client_reference: input.clientReference || null,
    assignment_date: input.assignmentDate || null,
    report_date: input.reportDate || null,
    status_id: input.statusId || null,
    summary: input.summary || null,
    inspector_id: input.inspectorId || null,
    adjuster_id: input.adjusterId || null,
    auditor_id: input.auditorId || null,
    dispatcher_id: input.dispatcherId || null,
    assistant_id: input.assistantId || null,
    insurance_company_id: input.insuranceCompanyId || null,
    claim_type_id: input.claimTypeId || null,
    claim_cause_id: input.claimCauseId || null,
    business_line_id: input.businessLineId || null,
    insurance_product_id: input.insuranceProductId || null,
    advisor_id: input.advisorId || null,
    broker_id: input.brokerId || null,
    event_id: input.eventId || null,
    construction_type_id: input.constructionTypeId || null,
    habitability_id: input.habitabilityId || null,
    destination_housing_id: input.destinationHousingId || null,
    damage_classification_id: input.damageClassificationId || null,
    property_classification_id: input.propertyClassificationId || null,
    owner_same_as_insured: input.ownerSameAsInsured ?? null,
    claim_address: claimAddress.claimAddress,
    country_id: input.countryId || null,
    company_id: input.company_id,
    claim_latitude: input.claimLatitude ?? claimAddress.claimLatitude ?? null,
    claim_longitude: input.claimLongitude ?? claimAddress.claimLongitude ?? null,
    // ── Campos nuevos para importación masiva ──
    policy_item: input.policyItem || null,
    policy_start_date: input.policyStartDate || null,
    policy_end_date: input.policyEndDate || null,
    policy_amount: input.policyAmount ?? null,
    policy_premium: input.policyPremium ?? null,
    currency_id: input.currencyId || null,
    internal_number: input.internalNumber || null,
    is_special_claim: input.isSpecialClaim ?? null,
    broker_executive: input.brokerExecutive || null,
    company_report_number: input.companyReportNumber || null,
    ...(input.createdAt ? { created_at: input.createdAt } : {}),
    // ── Campos adicionales de claims (que no estaban ya arriba) ──
    recovery_type_legal: input.recoveryTypeLegal ?? null,
    recovery_type_material: input.recoveryTypeMaterial ?? null,
    recovery_comments: input.recoveryComments || null,
    region_id: input.regionId || null,
    city_id: input.cityId || null,
    commune_id: input.communeId || null,
    policy_id: input.policyId || null,
    type_id: input.typeId || null,
    assigned_adjuster_id: input.assignedAdjusterId || null,
    notes: input.notes || null,
  }, CLAIM_SELECT);

  // No se geocodifica automáticamente — las coordenadas deben venir del
  // selector manual de ubicación (claimLatitude / claimLongitude).

  // 2. Crear participant insured
  const isInsuredLegal = (insured.insuredPersonType || "natural") === "legal";

  await createClaimParticipant({
    claim_id: claim.id,
    type: "insured",
    full_name: isInsuredLegal
      ? insured.insuredName
      : `${insured.insuredName} ${insured.lastName || ""}`.trim(),
    first_name: isInsuredLegal ? null : insured.insuredName,
    last_name: isInsuredLegal ? null : (insured.lastName || null),
    rut: insured.rut || null,
    email: insured.insuredEmail || null,
    phone: insured.insuredPhone || null,
    cell_phone: insured.cellPhone,
    address: insured.insuredAddress || claimAddress.claimAddress,
    country: insured.insuredCountry || claimAddress.claimCountry || null,
    region: insured.insuredRegion || claimAddress.claimRegion || null,
    city: insured.insuredCity || claimAddress.claimCity,
    commune: insured.insuredCommune || claimAddress.claimCommune || null,
    person_type: insured.insuredPersonType || "natural",
  });

  // 3. Crear participant contractor (si existe)
  if (contractor && contractor.contractorName) {
    const isContractorLegal = (contractor.contractorPersonType || "natural") === "legal";
    await createClaimParticipant({
      claim_id: claim.id,
      type: "contractor",
      full_name: isContractorLegal
        ? contractor.contractorName
        : `${contractor.contractorName} ${contractor.contractorLastName || ""}`.trim(),
      first_name: isContractorLegal ? null : contractor.contractorName,
      last_name: isContractorLegal ? null : (contractor.contractorLastName || null),
      rut: contractor.contractorRut || null,
      email: contractor.contractorEmail || null,
      phone: contractor.contractorPhone || null,
      cell_phone: contractor.contractorCellPhone || null,
      address: contractor.contractorAddress || null,
      country: contractor.contractorCountry || null,
      region: contractor.contractorRegion || null,
      city: contractor.contractorCity || null,
      commune: contractor.contractorCommune || null,
      person_type: contractor.contractorPersonType || "natural",
      linked_to_insured: linkParticipants || false,
    });
  }

  // 4. Crear participant beneficiary (si existe)
  if (beneficiary && beneficiary.beneficiaryName) {
    const isBeneficiaryLegal = (beneficiary.beneficiaryPersonType || "natural") === "legal";
    await createClaimParticipant({
      claim_id: claim.id,
      type: "beneficiary",
      full_name: isBeneficiaryLegal
        ? beneficiary.beneficiaryName
        : `${beneficiary.beneficiaryName} ${beneficiary.beneficiaryLastName || ""}`.trim(),
      first_name: isBeneficiaryLegal ? null : beneficiary.beneficiaryName,
      last_name: isBeneficiaryLegal ? null : (beneficiary.beneficiaryLastName || null),
      rut: beneficiary.beneficiaryRut || null,
      email: beneficiary.beneficiaryEmail || null,
      phone: beneficiary.beneficiaryPhone || null,
      cell_phone: beneficiary.beneficiaryCellPhone || null,
      address: beneficiary.beneficiaryAddress || null,
      country: beneficiary.beneficiaryCountry || null,
      region: beneficiary.beneficiaryRegion || null,
      city: beneficiary.beneficiaryCity || null,
      commune: beneficiary.beneficiaryCommune || null,
      person_type: beneficiary.beneficiaryPersonType || "natural",
      linked_to_insured: linkParticipants || false,
    });
  }

  // 5. Crear participant contact (si existe)
  if (contact && (contact.contactName || contact.contactEmail || contact.contactPhone)) {
    const isContactLegal = (contact.contactPersonType || "natural") === "legal";
    const contactFullName = isContactLegal
      ? (contact.contactName || "Contacto")
      : `${contact.contactName || ""} ${contact.contactLastName || ""}`.trim() || "Contacto";
    await createClaimParticipant({
      claim_id: claim.id,
      type: "contact",
      full_name: contactFullName,
      first_name: isContactLegal ? null : (contact.contactName || null),
      last_name: isContactLegal ? null : (contact.contactLastName || null),
      rut: contact.contactRut || null,
      email: contact.contactEmail || null,
      phone: contact.contactPhone || null,
      address: contact.contactAddress || null,
      country: contact.contactCountry || null,
      region: contact.contactRegion || null,
      city: contact.contactCity || null,
      commune: contact.contactCommune || null,
      person_type: contact.contactPersonType || "natural",
      notes: contact.contactRole || null,
      // linkContact es independiente de linkParticipants:
      // si no se pasa, hereda linkParticipants (backward compatible)
      linked_to_insured: linkContact !== undefined ? linkContact : (linkParticipants || false),
    });
  }

  return claim;
}

// ═══════════════════════════════════════════════════════════════
// ALOCLAIM — Creación de claim desde carga AloClaim
// ═══════════════════════════════════════════════════════════════

export interface AloClaimRowData {
  clientReference: string;
  claimNumber: string;
  policyNumber: string;
  insuranceCompanyId: string | null;
  brokerId: string | null;
  insuredName: string;
  lastName: string;
  rut: string;
  insuredAddress: string;
  insuredCountry: string;
  insuredRegion: string;
  insuredCity: string;
  insuredCommune: string;
  insuredPhone: string;
  insuredEmail: string;
  claimAddress: string;
  claimCountry: string;
  claimRegion: string;
  claimCity: string;
  claimCommune: string;
  businessLineId: string | null;
  insuranceProductId: string | null;
  claimTypeId: string | null;
  claimType: string;
  inspectorId: string | null;
  adjusterId: string | null;
  eventId: string | null;
  summary: string;
  currencyId: string | null;
  policyCurrencyId: string | null;
  claimDate: string;
  reportDate: string;
  assignmentDate: string;
  policyPremium: string;
  policyStartDate: string;
  policyEndDate: string;
  claimCauseId: string | null;
  companyId: string;
  destinationHousingId: string | null;
  constructionTypeId: string | null;
  isHabitable: boolean | null;
  ownerSameAsInsured: boolean | null;
  statusId: string | null;
  contractorRut: string;
  contractorName: string;
  contractorLastName: string;
  contractorEmail: string;
  contractorPhone: string;
  contractorCellPhone: string;
  contractorAddress: string;
  contractorCountry: string;
  contractorRegion: string;
  contractorCity: string;
  contractorCommune: string;
  beneficiaryRut: string;
  beneficiaryName: string;
  beneficiaryLastName: string;
  beneficiaryEmail: string;
  beneficiaryPhone: string;
  beneficiaryCellPhone: string;
  beneficiaryAddress: string;
  beneficiaryCountry: string;
  beneficiaryRegion: string;
  beneficiaryCity: string;
  beneficiaryCommune: string;
}



function normalizeRut(rut: string): string {
  return rut.replace(/[.\s-]/g, "").toUpperCase();
}

function sameAsInsured(
  rut: string,
  name: string,
  insuredRut: string,
  insuredName: string,
): boolean {
  const sameRut = normalizeRut(rut) === normalizeRut(insuredRut);
  const sameName = name.trim().toLowerCase() === insuredName.trim().toLowerCase();
  return sameRut && sameName;
}

export async function createClaimFromAloClaim(data: AloClaimRowData): Promise<{ claim: Claim; warnings: string[] }> {
  const { resolveCommuneHierarchy } = await import("@/services/catalogs");

  const insuredLocation = await resolveCommuneHierarchy(data.insuredCommune);
  const claimLocation = await resolveCommuneHierarchy(data.claimCommune);

  const personType = personTypeFromRut(data.rut);
  const isLegal = personType === "legal";
  const razonSocial = isLegal
    ? `${data.insuredName} ${data.lastName || ""}`.trim()
    : "";

  const insuredName = isLegal ? razonSocial : data.insuredName;
  const insuredLastName = isLegal ? null : (data.lastName || null);

  const policyNumber = data.policyNumber || "SIN NUMERO";

  // País: priorizar el de la jerarquía del siniestro, luego el de la compañía
  let countryId = claimLocation.countryId;
  if (!countryId && data.insuranceCompanyId) {
    countryId = await getCountryIdFromInsuranceCompany(data.insuranceCompanyId);
  }

  const assignmentDate = data.assignmentDate || data.reportDate || null;

  const policyResolution = await resolveOrCreatePolicy({
    companyId: data.companyId,
    policyNumber,
    policyItem: null,
    insuranceCompanyId: data.insuranceCompanyId,
    businessLineId: data.businessLineId,
    claimDate: data.claimDate,
    policyStartDate: data.policyStartDate || null,
    policyEndDate: data.policyEndDate || null,
    policyAmount: null,
    policyPremium: data.policyPremium ? Number(data.policyPremium) : null,
    currencyId: data.policyCurrencyId || data.currencyId,
    brokerId: data.brokerId,
  });

  if (!data.companyId) {
    throw new Error("Falta company_id");
  }
  if (!data.claimNumber) {
    throw new Error("Falta número de siniestro");
  }
  if (!data.insuranceCompanyId) {
    throw new Error("Falta compañía de seguros");
  }
  if (!data.insuranceProductId) {
    throw new Error("Falta ramo/producto");
  }
  if (!policyResolution.policyId) {
    const detail = policyResolution.note || "no se pudo crear ni encontrar";
    throw new Error(`Póliza no resuelta (${policyNumber}): ${detail}`);
  }

  const contractorPersonType = data.contractorRut
    ? personTypeFromRut(data.contractorRut)
    : personType;
  const beneficiaryPersonType = data.beneficiaryRut
    ? personTypeFromRut(data.beneficiaryRut)
    : personType;

  const contractorIsLegal = contractorPersonType === "legal";
  const contractorRazon = contractorIsLegal
    ? `${data.contractorName} ${data.contractorLastName || ""}`.trim()
    : "";

  const beneficiaryIsLegal = beneficiaryPersonType === "legal";
  const beneficiaryRazon = beneficiaryIsLegal
    ? `${data.beneficiaryName} ${data.beneficiaryLastName || ""}`.trim()
    : "";

  const contractorLinked = sameAsInsured(
    data.contractorRut || data.rut,
    data.contractorName || data.insuredName,
    data.rut,
    data.insuredName,
  );
  const beneficiaryLinked = sameAsInsured(
    data.beneficiaryRut || data.rut,
    data.beneficiaryName || data.insuredName,
    data.rut,
    data.insuredName,
  );

  const claim = await createClaimMinimal(
    {
      claimNumber: data.claimNumber,
      policyNumber,
      claimDate: data.claimDate,
      clientReference: data.clientReference || null,
      reportDate: data.reportDate || null,
      assignmentDate,
      summary: data.summary || null,
      statusId: data.statusId || null,
      inspectorId: data.inspectorId || null,
      adjusterId: data.adjusterId || null,
      insuranceCompanyId: data.insuranceCompanyId || null,
      claimTypeId: data.claimTypeId || null,
      claimCauseId: data.claimCauseId || null,
      businessLineId: data.businessLineId || null,
      insuranceProductId: data.insuranceProductId || null,
      brokerId: data.brokerId || null,
      eventId: data.eventId || null,
      currencyId: data.currencyId || null,
      policyPremium: data.policyPremium ? Number(data.policyPremium) : null,
      policyStartDate: data.policyStartDate || null,
      policyEndDate: data.policyEndDate || null,
      company_id: data.companyId,
      countryId: countryId || null,
      regionId: claimLocation.regionId || null,
      cityId: claimLocation.cityId || null,
      communeId: claimLocation.communeId || null,
      notes: policyResolution.note || null,
      policyId: policyResolution.policyId,
      destinationHousingId: data.destinationHousingId || null,
      constructionTypeId: null,
      habitabilityId: null,
      ownerSameAsInsured: data.ownerSameAsInsured,
    },
    // insured
    {
      insuredName,
      lastName: insuredLastName,
      rut: data.rut || null,
      insuredEmail: data.insuredEmail || null,
      insuredPhone: data.insuredPhone || null,
      cellPhone: data.insuredPhone || "",
      insuredAddress: data.insuredAddress || null,
      insuredCountry: data.insuredCountry || insuredLocation.countryName || null,
      insuredRegion: data.insuredRegion || insuredLocation.regionName || null,
      insuredCity: data.insuredCity || insuredLocation.cityName || null,
      insuredCommune: data.insuredCommune || insuredLocation.communeName || null,
      insuredPersonType: personType,
    },
    // claimAddress
    {
      claimAddress: data.claimAddress || data.insuredAddress || "",
      claimCountry: data.claimCountry || claimLocation.countryName || null,
      claimRegion: data.claimRegion || claimLocation.regionName || null,
      claimCity: data.claimCity || claimLocation.cityName || null,
      claimCommune: data.claimCommune || claimLocation.communeName || null,
    },
    // contractor
    {
      contractorName: contractorIsLegal ? contractorRazon : data.contractorName,
      contractorLastName: contractorIsLegal ? null : (data.contractorLastName || null),
      contractorRut: data.contractorRut || data.rut || null,
      contractorEmail: data.contractorEmail || null,
      contractorCellPhone: data.contractorCellPhone || data.contractorPhone || null,
      contractorPhone: data.contractorPhone || null,
      contractorAddress: data.contractorAddress || null,
      contractorCountry: data.contractorCountry || null,
      contractorRegion: data.contractorRegion || null,
      contractorCity: data.contractorCity || null,
      contractorCommune: data.contractorCommune || null,
      contractorPersonType: contractorPersonType,
    },
    // beneficiary
    {
      beneficiaryName: beneficiaryIsLegal ? beneficiaryRazon : data.beneficiaryName,
      beneficiaryLastName: beneficiaryIsLegal ? null : (data.beneficiaryLastName || null),
      beneficiaryRut: data.beneficiaryRut || data.rut || null,
      beneficiaryEmail: data.beneficiaryEmail || null,
      beneficiaryCellPhone: data.beneficiaryCellPhone || data.beneficiaryPhone || null,
      beneficiaryPhone: data.beneficiaryPhone || null,
      beneficiaryAddress: data.beneficiaryAddress || null,
      beneficiaryCountry: data.beneficiaryCountry || null,
      beneficiaryRegion: data.beneficiaryRegion || null,
      beneficiaryCity: data.beneficiaryCity || null,
      beneficiaryCommune: data.beneficiaryCommune || null,
      beneficiaryPersonType: beneficiaryPersonType,
    },
    // contact — replica del asegurado
    {
      contactName: isLegal ? razonSocial : data.insuredName,
      contactLastName: isLegal ? null : (data.lastName || null),
      contactRut: data.rut || null,
      contactEmail: data.insuredEmail || null,
      contactPhone: data.insuredPhone || null,
      contactAddress: data.insuredAddress || null,
      contactCountry: data.insuredCountry || insuredLocation.countryName || null,
      contactRegion: data.insuredRegion || insuredLocation.regionName || null,
      contactCity: data.insuredCity || insuredLocation.cityName || null,
      contactCommune: data.insuredCommune || insuredLocation.communeName || null,
      contactPersonType: personType,
    },
    // linkParticipants: true solo si son el mismo RUT+nombre
    contractorLinked && beneficiaryLinked,
    // linkContact: contacto siempre vinculado al asegurado
    true,
  );

  const warnings: string[] = [];
  if (policyResolution.note) warnings.push(policyResolution.note);
  return { claim, warnings };
}

export async function updateClaim(id: string, input: Partial<ClaimInput>) {
  const set: Record<string, unknown> = {};
  const obj = buildClaimObject(input);
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      set[key] = value;
    }
  }

  const updated = await updateRow<Claim>("claims", id, set, CLAIM_SELECT);

  // No se geocodifica automáticamente — si la dirección cambia, el usuario
  // debe usar el selector manual de ubicación para confirmar las coordenadas.

  return updated;
}

/**
 * Actualización genérica de campos del siniestro.
 * Acepta cualquier combinación de columnas de la tabla claims.
 * Los valores null se incluyen en el _set (para limpiar campos).
 * Los valores undefined se omiten (no se modifican).
 * updatedBy: ID del usuario que modifica (para auditoria).
 */
export async function updateClaimFields(id: string, set: Record<string, unknown>, updatedBy?: string) {
  const finalSet = updatedBy ? { ...set, updated_by: updatedBy } : set;
  return updateRow<Claim>("claims", id, finalSet, CLAIM_SELECT);
}

export async function updateClaimStatus(id: string, statusId: string, updatedBy?: string) {
  const set: Record<string, unknown> = { status_id: statusId };
  if (updatedBy) set.updated_by = updatedBy;
  return updateRow<Claim>("claims", id, set, CLAIM_SELECT);
}

export async function deleteClaim(id: string) {
  await deleteRow("claims", id);
}

// ═══════════════════════════════════════════════════════════════
// CLAIMS PARTICIPANTS
// ═══════════════════════════════════════════════════════════════

export async function createClaimParticipant(input: {
  claim_id: string;
  type: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
  person_type?: string | null;
  notes?: string | null;
  linked_to_insured?: boolean;
}) {
  return insertRow<{ id: string }>("claims_participants", input, "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, person_type, notes, linked_to_insured");
}

export async function updateClaimParticipant(id: string, input: Partial<{
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  rut: string | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  commune: string | null;
  person_type: string | null;
  linked_to_insured: boolean;
}>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<{ id: string }>("claims_participants", id, set, "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, person_type");
}

// ═══════════════════════════════════════════════════════════════
// VALIDACIÓN DE DUPLICADOS (Carga Casos)
// ═══════════════════════════════════════════════════════════════

export interface DuplicateCheckResult {
  /** Índice de la fila en el array original (0-based) */
  rowIndex: number;
  /** Número de referencia del cliente */
  clientReference: string;
  /** Número de siniestro */
  claimNumber: string;
  /** Compañía de seguros (nombre) */
  insuranceCompany: string;
  /** Razón de duplicado */
  reason: "reference_exists" | "claim_and_company_exists";
  /** ID del claim existente si se encontró */
  existingClaimId: string | null;
}

/**
 * Verifica duplicados en un conjunto de filas de Casos contra la base de datos.
 * Validación 1: client_reference ya existe en claims
 * Validación 2: claim_number + insurance_company_id ya existen juntos
 *
 * @param companyId ID de la empresa (tenant) para filtrar
 * @param rows Array de datos parseados (con clientReference, claimNumber, insuranceCompany ya resueltos a UUID)
 */
export async function checkCasosDuplicates(
  companyId: string,
  rows: Array<{
    clientReference: string;
    claimNumber: string;
    insuranceCompanyId: string | null;
  }>,
): Promise<DuplicateCheckResult[]> {
  const supabase = (await import("@/lib/supabase/client")).getSupabaseClient();
  const duplicates: DuplicateCheckResult[] = [];

  // 1. Collectar todos los client_references y claim_numbers a verificar
  const references = rows
    .map((r) => r.clientReference)
    .filter((r) => r && r.trim() !== "");
  const claimNumbers = rows
    .map((r) => r.claimNumber)
    .filter((r) => r && r.trim() !== "");

  if (references.length === 0 && claimNumbers.length === 0) {
    return duplicates;
  }

  // 2. Buscar claims existentes por client_reference (en la empresa)
  const existingByRef: Map<string, string> = new Map();
  if (references.length > 0) {
    const { data: refMatches } = await supabase
      .from("claims")
      .select("id, client_reference")
      .eq("company_id", companyId)
      .in("client_reference", references);
    if (refMatches) {
      for (const c of refMatches as Array<{ id: string; client_reference: string }>) {
        existingByRef.set(c.client_reference, c.id);
      }
    }
  }

  // 3. Buscar claims existentes por claim_number + insurance_company_id
  // PostgREST no soporta OR con combinaciones, así que buscamos por claim_number
  // y luego filtramos por insurance_company_id en memoria
  const existingByClaimCompany: Map<string, string> = new Map(); // key = "claimNumber::insuranceCompanyId"
  if (claimNumbers.length > 0) {
    const { data: claimMatches } = await supabase
      .from("claims")
      .select("id, claim_number, insurance_company_id")
      .eq("company_id", companyId)
      .in("claim_number", claimNumbers);
    if (claimMatches) {
      for (const c of claimMatches as Array<{ id: string; claim_number: string; insurance_company_id: string | null }>) {
        const key = `${c.claim_number}::${c.insurance_company_id || ""}`;
        existingByClaimCompany.set(key, c.id);
      }
    }
  }

  // 4. Marcar duplicados
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validación 1: client_reference ya existe
    if (row.clientReference && existingByRef.has(row.clientReference)) {
      duplicates.push({
        rowIndex: i,
        clientReference: row.clientReference,
        claimNumber: row.claimNumber,
        insuranceCompany: row.insuranceCompanyId || "",
        reason: "reference_exists",
        existingClaimId: existingByRef.get(row.clientReference) || null,
      });
      continue; // No agregar dos veces la misma fila
    }

    // Validación 2: claim_number + insurance_company_id ya existen
    if (row.claimNumber && row.insuranceCompanyId) {
      const key = `${row.claimNumber}::${row.insuranceCompanyId}`;
      if (existingByClaimCompany.has(key)) {
        duplicates.push({
          rowIndex: i,
          clientReference: row.clientReference,
          claimNumber: row.claimNumber,
          insuranceCompany: row.insuranceCompanyId,
          reason: "claim_and_company_exists",
          existingClaimId: existingByClaimCompany.get(key) || null,
        });
      }
    }
  }

  return duplicates;
}

export async function checkAloClaimDuplicates(
  companyId: string,
  rows: Array<{
    clientReference: string;
    claimNumber: string;
    insuranceCompanyId: string | null;
  }>,
): Promise<DuplicateCheckResult[]> {
  return checkCasosDuplicates(companyId, rows);
}

// ═══════════════════════════════════════════════════════════════
// STAGING — Carga temporal de siniestros (flujo de 2 fases)
// ═══════════════════════════════════════════════════════════════

export interface ClaimStagingRow {
  id: string;
  company_id: string | null;
  raw_data: Record<string, unknown>;
  status: string;
  error_message: string | null;
  claim_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

const STAGING_SELECT = "id, company_id, raw_data, status, error_message, claim_id, processed_at, created_at, updated_at";

/**
 * Limpia todos los rows de staging de la empresa.
 * Se llama antes de cada carga nueva.
 */
export async function cleanStaging(companyId: string): Promise<void> {
  await deleteWhere("claims_staging", { company_id: companyId });
}

/**
 * Inserta múltiples rows en staging en bulk.
 */
export async function insertStagingRows(
  companyId: string,
  rows: Record<string, unknown>[]
): Promise<ClaimStagingRow[]> {
  const supabase = (await import("@/lib/supabase/client")).getSupabaseClient();
  const payload = rows.map((raw_data) => ({
    company_id: companyId,
    raw_data,
    status: "pending",
  }));
  const { data, error } = await supabase
    .from("claims_staging")
    .insert(payload)
    .select(STAGING_SELECT);
  if (error) throw new Error(error.message);
  return (data as ClaimStagingRow[]) ?? [];
}

/**
 * Obtiene todos los rows de staging de la empresa.
 */
export async function getStagingRows(companyId: string): Promise<ClaimStagingRow[]> {
  return fetchAll<ClaimStagingRow>("claims_staging", {
    select: STAGING_SELECT,
    eq: { company_id: companyId },
    order: { column: "created_at", ascending: true },
  });
}

/**
 * Marca un row de staging con error de validación.
 */
export async function markStagingError(
  stagingId: string,
  errorMessage: string
): Promise<void> {
  await updateRow<ClaimStagingRow>(
    "claims_staging",
    stagingId,
    { status: "error", error_message: errorMessage },
    STAGING_SELECT
  );
}

/**
 * Marca un row de staging como importado (con el claim_id creado).
 */
export async function markStagingImported(
  stagingId: string,
  claimId: string
): Promise<void> {
  await updateRow<ClaimStagingRow>(
    "claims_staging",
    stagingId,
    { status: "imported", claim_id: claimId, processed_at: new Date().toISOString() },
    STAGING_SELECT
  );
}

/**
 * Marca un row de staging como validado (sin errores).
 */
export async function markStagingValid(stagingId: string): Promise<void> {
  await updateRow<ClaimStagingRow>(
    "claims_staging",
    stagingId,
    { status: "valid", error_message: null },
    STAGING_SELECT
  );
}

// ═══════════════════════════════════════════════════════════════
// VINCULACIÓN DE PÓLIZAS (importación masiva)
// Ver docs/CARGA_SINIESTROS.md sección "Vinculación de Pólizas"
// ═══════════════════════════════════════════════════════════════

export interface PolicyResolution {
  policyId: string | null;
  note: string | null;
}

/**
 * Busca o crea una póliza según (company_id, policy_number, insurance_company_id, policy_item).
 * - Si policy_number viene en 0 o blanco → no vincula (policyId = null).
 * - Si existe y vigencias coinciden con claimDate → vincula.
 * - Si existe pero vigencias NO coinciden → no vincula + nota.
 * - Si no existe → crea con todos los datos del Excel + país de la cia.
 * - Si existe pero sin la línea de negocio → la activa en policy_business_lines.
 */
export async function resolveOrCreatePolicy(input: {
  companyId: string;
  policyNumber: string;
  policyItem: string | null;
  insuranceCompanyId: string | null;
  businessLineId: string | null;
  claimDate: string | null;
  policyStartDate: string | null;
  policyEndDate: string | null;
  policyAmount: number | null;
  policyPremium: number | null;
  currencyId: string | null;
  brokerId: string | null;
}): Promise<PolicyResolution> {
  const {
    companyId, policyNumber, policyItem, insuranceCompanyId,
    businessLineId, claimDate, policyStartDate, policyEndDate,
    policyAmount, policyPremium, currencyId, brokerId,
  } = input;

  // No vincular si policy_number es 0 o blanco
  if (!policyNumber || policyNumber.trim() === "" || policyNumber.trim() === "0") {
    return { policyId: null, note: null };
  }
  if (!insuranceCompanyId) {
    return { policyId: null, note: null };
  }

  const item = policyItem && policyItem.trim() !== "" ? policyItem.trim() : "0";
  const supabase = (await import("@/lib/supabase/client")).getSupabaseClient();

  // 1. Buscar póliza existente
  const { data: existing, error: errFind } = await supabase
    .from("policies")
    .select("id, policy_number, start_date, end_date, business_line_id, currency")
    .eq("company_id", companyId)
    .eq("policy_number", policyNumber.trim())
    .eq("insurance_company_id", insuranceCompanyId)
    .eq("policy_item", item)
    .maybeSingle();

  if (errFind) throw new Error(`Error buscando póliza: ${errFind.message}`);

  if (existing) {
    // 2. Notar inconsistencia de vigencias vs claim_date sin bloquear la carga.
    // El siniestro se crea siempre; la inconsistencia se reporta en el note.
    let note: string | null = null;
    if (claimDate && existing.start_date && existing.end_date) {
      const claimDateOnly = claimDate.split("T")[0];
      const startDate = String(existing.start_date).split("T")[0];
      const endDate = String(existing.end_date).split("T")[0];
      if (claimDateOnly < startDate || claimDateOnly > endDate) {
        note = `Póliza ${policyNumber} encontrada pero la fecha del siniestro (${claimDateOnly}) está fuera de la vigencia (${startDate} a ${endDate}).`;
      }
    }

    // 3. Verificar/activar línea de negocio en policy_business_lines
    if (businessLineId) {
      const { data: pbl } = await supabase
        .from("policy_business_lines")
        .select("id")
        .eq("policy_id", existing.id)
        .eq("business_line_id", businessLineId)
        .maybeSingle();
      if (!pbl) {
        await supabase
          .from("policy_business_lines")
          .insert({ policy_id: existing.id, business_line_id: businessLineId, is_primary: false });
      }
    }

    return { policyId: existing.id, note };
  }

  // 4. No existe → crear
  // País de la póliza = país de la cia de seguros
  const { data: cia } = await supabase
    .from("insurance_companies")
    .select("country_id")
    .eq("id", insuranceCompanyId)
    .maybeSingle();
  const policyCountryId = cia?.country_id || null;

  // Moneda: usar currencyId (UUID) → buscar código, o default 'CLP'
  let currencyCode = "CLP";
  if (currencyId) {
    const { data: curr } = await supabase
      .from("currencies")
      .select("code")
      .eq("id", currencyId)
      .maybeSingle();
    if (curr?.code) currencyCode = curr.code;
  }

  // Fechas de vigencia: si no vienen, usar defaults razonables
  const startDate = policyStartDate || claimDate || new Date().toISOString().split("T")[0];
  const endDate = policyEndDate || (() => {
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  })();

  const { data: created, error: errCreate } = await supabase
    .from("policies")
    .insert({
      policy_name: policyNumber.trim(),
      policy_number: policyNumber.trim(),
      policy_item: item,
      policy_type: "individual",
      insurance_company_id: insuranceCompanyId,
      country_id: policyCountryId,
      broker_id: brokerId || null,
      business_line_id: businessLineId || null,
      currency: currencyCode,
      premium_amount: policyPremium ?? null,
      insured_amount: policyAmount ?? null,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      company_id: companyId,
    })
    .select("id")
    .single();

  if (errCreate) {
    // Si falla por duplicate key, buscar por (policy_number + cia) sin item y vincular
    if (errCreate.code === "23505") {
      const { data: fallback } = await supabase
        .from("policies")
        .select("id")
        .eq("company_id", companyId)
        .eq("policy_number", policyNumber.trim())
        .eq("insurance_company_id", insuranceCompanyId)
        .maybeSingle();
      if (fallback) {
        // Activar línea de negocio si no la tiene
        if (businessLineId) {
          const { data: pbl } = await supabase
            .from("policy_business_lines")
            .select("id")
            .eq("policy_id", fallback.id)
            .eq("business_line_id", businessLineId)
            .maybeSingle();
          if (!pbl) {
            await supabase
              .from("policy_business_lines")
              .insert({ policy_id: fallback.id, business_line_id: businessLineId, is_primary: false });
          }
        }
        return { policyId: fallback.id, note: null };
      }
    }
    throw new Error(`Error creando póliza ${policyNumber}: ${errCreate.message}`);
  }

  // 5. Insertar en policy_business_lines
  if (businessLineId && created) {
    await supabase
      .from("policy_business_lines")
      .insert({ policy_id: created.id, business_line_id: businessLineId, is_primary: true });
  }

  return { policyId: created?.id || null, note: null };
}

/**
 * Obtiene el country_id de una cia de seguros.
 * Usado para heredar el país del claim desde la cia.
 */
export async function getCountryIdFromInsuranceCompany(
  insuranceCompanyId: string
): Promise<string | null> {
  const supabase = (await import("@/lib/supabase/client")).getSupabaseClient();
  const { data, error } = await supabase
    .from("insurance_companies")
    .select("country_id")
    .eq("id", insuranceCompanyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.country_id || null;
}

// ═══════════════════════════════════════════════════════════════
// CREACIÓN DESDE CARGA DE CASOS (sistema distinto)
// ═══════════════════════════════════════════════════════════════
// Lógica inteligente:
// - Usa ASEG_NOMBRE + ASEG_APELLIDO (no el campo ASEGURADO completo)
// - Si no hay dirección de asegurado, usa la del siniestro
// - Resuelve jerarquía completa desde la comuna (ciudad, región, país)
// - Si no hay póliza, setea "SIN NUMERO"
// - Replica todos los datos del asegurado a beneficiario, contratante y contacto
// - NOMBRE CONTACTO del Excel va como nombre del contacto

export interface CasoRowData {
  clientReference: string;
  claimNumber: string;
  policyNumber: string;
  insuranceCompanyId: string | null;
  brokerId: string | null;
  insuredName: string;
  lastName: string;
  rut: string;
  insuredAddress: string;
  claimAddress: string;
  commune: string;
  city: string;
  insuredPhone: string;
  insuredEmail: string;
  businessLineId: string | null;
  insuranceProductId: string | null;
  adjusterId: string | null;
  claimTypeId: string | null;
  claimType: string;
  area: string;
  inspectorId: string | null;
  eventId: string | null;
  summary: string;
  currencyId: string | null;
  claimDate: string;
  reportDate: string;
  assignmentDate: string;
  policyPremium: string;
  contactName: string;
  policyStartDate: string;
  policyEndDate: string;
  claimCauseId: string | null;
  companyId: string;
  statusId: string | null;
  destinationHousingId: string | null;
}

/**
 * Determina person_type desde un RUT chileno:
 * - Menor a 60 millones → "natural"
 * - 60 millones o más → "legal"
 * - Sin RUT o no parseable → "natural" (default)
 *
 * Usa el cuerpo del RUT (sin dígito verificador) para la comparación.
 */
function personTypeFromRut(rut: string | null | undefined): string {
  if (!rut) return "natural";
  const body = rutBodyNumber(rut);
  if (body === null) return "natural";
  return body >= 60_000_000 ? "legal" : "natural";
}

export async function createClaimFromCaso(data: CasoRowData) {
  // 1. Resolver jerarquía de ubicación desde la comuna
  const { resolveCommuneHierarchy } = await import("@/services/catalogs");
  const location = await resolveCommuneHierarchy(data.commune);

  // 2. La dirección del siniestro es la que manda
  const insuredAddress = data.claimAddress || data.insuredAddress;

  // 2b. Determinar person_type desde el RUT y preparar nombre/razón social
  const personType = personTypeFromRut(data.rut);
  const isLegal = personType === "legal";
  // Si es jurídica: el nombre completo va como razón social (full_name), sin first_name/last_name
  // Si es natural: first_name = nombre, last_name = apellido
  const razonSocial = isLegal
    ? `${data.insuredName} ${data.lastName || ""}`.trim()
    : "";

  // 3. Póliza: si no hay, "SIN NUMERO"
  const policyNumber = data.policyNumber || "SIN NUMERO";

  // 4. País: priorizar el de la jerarquía, luego el de la compañía
  let countryId = location.countryId;
  if (!countryId && data.insuranceCompanyId) {
    countryId = await getCountryIdFromInsuranceCompany(data.insuranceCompanyId);
  }

  // 5. Fecha de asignación: si no viene, usar la fecha de denuncio
  const assignmentDate = data.assignmentDate || data.reportDate || null;

  // 6. Resolver o crear póliza (vincula policy_id al claim)
  const policyResolution = await resolveOrCreatePolicy({
    companyId: data.companyId,
    policyNumber,
    policyItem: null,
    insuranceCompanyId: data.insuranceCompanyId,
    businessLineId: data.businessLineId,
    claimDate: data.claimDate,
    policyStartDate: data.policyStartDate || null,
    policyEndDate: data.policyEndDate || null,
    policyAmount: null,
    policyPremium: data.policyPremium ? Number(data.policyPremium) : null,
    currencyId: data.currencyId,
    brokerId: data.brokerId,
  });

  // 7. Crear el claim usando createClaimMinimal
  const claim = await createClaimMinimal(
    {
      claimNumber: data.claimNumber,
      policyNumber,
      claimDate: data.claimDate,
      clientReference: data.clientReference || null,
      reportDate: data.reportDate || null,
      assignmentDate,
      summary: data.summary || null,
      statusId: data.statusId || null,
      inspectorId: data.inspectorId || null,
      adjusterId: data.adjusterId || null,
      insuranceCompanyId: data.insuranceCompanyId || null,
      claimTypeId: data.claimTypeId || null,
      claimCauseId: data.claimCauseId || null,
      businessLineId: data.businessLineId || null,
      insuranceProductId: data.insuranceProductId || null,
      brokerId: data.brokerId || null,
      eventId: data.eventId || null,
      currencyId: data.currencyId || null,
      policyPremium: data.policyPremium ? Number(data.policyPremium) : null,
      policyStartDate: data.policyStartDate || null,
      policyEndDate: data.policyEndDate || null,
      company_id: data.companyId,
      countryId: countryId || null,
      regionId: location.regionId || null,
      cityId: location.cityId || null,
      communeId: location.communeId || null,
      notes: data.area || null,
      policyId: policyResolution.policyId,
      destinationHousingId: data.destinationHousingId || null,
    },
    // insured
    {
      insuredName: isLegal ? razonSocial : data.insuredName,
      lastName: isLegal ? null : (data.lastName || null),
      rut: data.rut || null,
      insuredEmail: data.insuredEmail || null,
      insuredPhone: data.insuredPhone || null,
      cellPhone: data.insuredPhone || "",
      insuredAddress: insuredAddress || null,
      insuredCountry: location.countryName || null,
      insuredRegion: location.regionName || null,
      insuredCity: location.cityName || null,
      insuredCommune: location.communeName || null,
      insuredPersonType: personType,
    },
    // claimAddress
    {
      claimAddress: data.claimAddress || insuredAddress || "",
      claimCountry: location.countryName || null,
      claimRegion: location.regionName || null,
      claimCity: location.cityName || null,
      claimCommune: location.communeName || null,
    },
    // contractor (replicado del asegurado)
    {
      contractorName: isLegal ? razonSocial : data.insuredName,
      contractorLastName: isLegal ? null : (data.lastName || null),
      contractorRut: data.rut || null,
      contractorEmail: data.insuredEmail || null,
      contractorCellPhone: data.insuredPhone || null,
      contractorAddress: insuredAddress || null,
      contractorCountry: location.countryName || null,
      contractorRegion: location.regionName || null,
      contractorCity: location.cityName || null,
      contractorCommune: location.communeName || null,
      contractorPersonType: personType,
    },
    // beneficiary (replicado del asegurado)
    {
      beneficiaryName: isLegal ? razonSocial : data.insuredName,
      beneficiaryLastName: isLegal ? null : (data.lastName || null),
      beneficiaryRut: data.rut || null,
      beneficiaryEmail: data.insuredEmail || null,
      beneficiaryCellPhone: data.insuredPhone || null,
      beneficiaryAddress: insuredAddress || null,
      beneficiaryCountry: location.countryName || null,
      beneficiaryRegion: location.regionName || null,
      beneficiaryCity: location.cityName || null,
      beneficiaryCommune: location.communeName || null,
      beneficiaryPersonType: personType,
    },
    // contact (siniestrado) — si viene contactName del Excel, se usa ese nombre.
    // Si NO viene (sin mapear), se replica TODO del asegurado: nombre, apellido, RUT,
    // person_type, email, teléfono, dirección. Y se vincula al asegurado.
    {
      contactName: data.contactName && data.contactName.trim() !== ""
        ? data.contactName
        : (isLegal ? razonSocial : data.insuredName),
      contactLastName: data.contactName && data.contactName.trim() !== ""
        ? null  // si viene contacto del Excel, no copiamos apellido del asegurado
        : (isLegal ? null : (data.lastName || null)),
      contactRut: data.rut || null,
      contactEmail: data.insuredEmail || null,
      contactPhone: data.insuredPhone || null,
      contactAddress: insuredAddress || null,
      contactCountry: location.countryName || null,
      contactRegion: location.regionName || null,
      contactCity: location.cityName || null,
      contactCommune: location.communeName || null,
      contactPersonType: personType,
    },
    // linkParticipants = true: beneficiary, contractor y contact se marcan como ligados al asegurado
    true,
  );

  return claim;
}
