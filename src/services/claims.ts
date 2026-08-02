import { fetchAll, fetchById, insertRow, updateRow, deleteRow, deleteWhere } from "@/lib/supabase/db";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Claim, ClaimInput, ClaimsParticipant } from "@/types";

const LIGHT_CLAIM_SELECT =
  "id, claim_number, policy_number, policy_id, claim_date, status_id, report_date, assignment_date, client_reference, company_report_number, liquidation_number, is_special_claim, summary, event_id, internal_number, notes, company_id, assigned_adjuster_id, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, claim_cause_id, claim_type_id, business_line_id, insurance_product_id, country_id, region_id, city_id, commune_id, construction_type_id, destination_housing_id, damage_classification_id, habitability_id, type_id, currency_id, service_type_id, billing_type_id, claim_address, claim_latitude, claim_longitude, owner_same_as_insured, policy_item, policy_start_date, policy_end_date, policy_amount, policy_premium, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, updated_at, updated_by, disabled, disabled_reason, disabled_at, disabled_by, reopened_at, reopened_by, reopened_reason";

const DETAIL_CLAIM_SELECT =
  `${LIGHT_CLAIM_SELECT}, inspection_sessions:inspection_sessions(id, inspector_id, claim_action_id, status, inspection_number, inspection_type, scheduled_at, started_at, ended_at, lock_overridden_by, lock_overridden_at, created_at)`;

const DYNAMIC_CLAIM_SELECT =
  `${LIGHT_CLAIM_SELECT}, status:lookup_catalog!claims_status_id_fkey(id, category, code, name), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name, email), adjuster:profiles!claims_adjuster_id_fkey(id, full_name, email), broker:brokers!claims_broker_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), policy:policies!claims_policy_id_fkey(id, policy_number, policy_name, status, currency), currency:currencies!claims_currency_id_fkey(id, code, name, symbol, decimals), country:countries!claims_country_id_fkey(id, name), region:regions!claims_region_id_fkey(id, name), city:cities!claims_city_id_fkey(id, name), commune:communes!claims_commune_id_fkey(id, name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(id, name)`;

const CLAIM_SELECT =
  `${DYNAMIC_CLAIM_SELECT}, inspector:profiles!claims_inspector_id_fkey(id, full_name, email), auditor:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant:profiles!claims_assistant_id_fkey(id, full_name, email)`;

export async function getClaims(companyId?: string) {
  const eq: Record<string, unknown> = { disabled: false };
  if (companyId) eq.company_id = companyId;

  return fetchAll<Claim>("claims", {
    select: CLAIM_SELECT,
    eq,
    order: { column: "created_at", ascending: false },
  });
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
    select: "id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune",
    ilike: { rut, country },
    limit: 1,
    order: { column: "created_at", ascending: false },
  });
  return rows[0] || null;
}

export type ParticipantMatch = {
  id: string;
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
  return fetchAll<Participant>("claims_participants", {
    select: "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune",
    in: { claim_id: claimIds },
  });
}

export async function getClaimById(id: string) {
  return fetchById<Claim>("claims", id, DYNAMIC_CLAIM_SELECT);
}

export async function getClaimsLight(
  companyId?: string,
  options?: {
    page?: number;
    pageSize?: number;
    statusIds?: string[];
    insuranceCompanyIds?: string[];
    liquidation?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? 50, 100));
  const page = Math.max(1, options?.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const eq: Record<string, unknown> = { disabled: false };
  if (companyId) eq.company_id = companyId;

  const filters: {
    eq?: Record<string, unknown>;
    in?: Record<string, unknown[]>;
    ilike?: Record<string, string>;
    gte?: Record<string, unknown>;
    lte?: Record<string, unknown>;
  } = { eq };

  if (options?.statusIds?.length) filters.in = { ...filters.in, status_id: options.statusIds };
  if (options?.insuranceCompanyIds?.length) filters.in = { ...filters.in, insurance_company_id: options.insuranceCompanyIds };
  if (options?.liquidation) filters.ilike = { ...filters.ilike, liquidation_number: `%${options.liquidation}%` };
  if (options?.dateFrom) filters.gte = { ...filters.gte, claim_date: options.dateFrom };
  if (options?.dateTo) filters.lte = { ...filters.lte, claim_date: options.dateTo };

  return fetchAll<Claim>("claims", {
    select: LIGHT_CLAIM_SELECT,
    ...filters,
    order: { column: "created_at", ascending: false },
    limit: pageSize,
    range: { from, to },
  });
}

export async function getClaimsCount(
  companyId?: string,
  options?: {
    statusIds?: string[];
    insuranceCompanyIds?: string[];
    liquidation?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const supabase = getSupabaseClient();
  const eq: Record<string, unknown> = { disabled: false };
  if (companyId) eq.company_id = companyId;

  let query = supabase.from("claims").select("id", { count: "exact", head: true }).match(eq);

  if (options?.statusIds?.length) query = query.in("status_id", options.statusIds);
  if (options?.insuranceCompanyIds?.length) query = query.in("insurance_company_id", options.insuranceCompanyIds);
  if (options?.liquidation) query = query.ilike("liquidation_number", `%${options.liquidation}%`);
  if (options?.dateFrom) query = query.gte("claim_date", options.dateFrom);
  if (options?.dateTo) query = query.lte("claim_date", options.dateTo);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getClaimByIdLight(id: string) {
  return fetchById<Claim>("claims", id, DETAIL_CLAIM_SELECT);
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
  } | null,
  contact?: {
    contactName?: string | null;
    contactRole?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  } | null
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
  await createClaimParticipant({
    claim_id: claim.id,
    type: "insured",
    full_name: `${insured.insuredName} ${insured.lastName || ""}`.trim(),
    first_name: insured.insuredName,
    last_name: insured.lastName || null,
    rut: insured.rut || null,
    email: insured.insuredEmail || null,
    phone: insured.insuredPhone || null,
    cell_phone: insured.cellPhone,
    address: insured.insuredAddress || claimAddress.claimAddress,
    country: insured.insuredCountry || claimAddress.claimCountry || null,
    region: insured.insuredRegion || claimAddress.claimRegion || null,
    city: insured.insuredCity || claimAddress.claimCity,
    commune: insured.insuredCommune || claimAddress.claimCommune || null,
  });

  // 3. Crear participant contractor (si existe)
  if (contractor && contractor.contractorName) {
    await createClaimParticipant({
      claim_id: claim.id,
      type: "contractor",
      full_name: `${contractor.contractorName} ${contractor.contractorLastName || ""}`.trim(),
      first_name: contractor.contractorName,
      last_name: contractor.contractorLastName || null,
      rut: contractor.contractorRut || null,
      email: contractor.contractorEmail || null,
      phone: contractor.contractorPhone || null,
      cell_phone: contractor.contractorCellPhone || null,
      address: contractor.contractorAddress || null,
      country: contractor.contractorCountry || null,
      region: contractor.contractorRegion || null,
      city: contractor.contractorCity || null,
      commune: contractor.contractorCommune || null,
    });
  }

  // 4. Crear participant beneficiary (si existe)
  if (beneficiary && beneficiary.beneficiaryName) {
    await createClaimParticipant({
      claim_id: claim.id,
      type: "beneficiary",
      full_name: `${beneficiary.beneficiaryName} ${beneficiary.beneficiaryLastName || ""}`.trim(),
      first_name: beneficiary.beneficiaryName,
      last_name: beneficiary.beneficiaryLastName || null,
      rut: beneficiary.beneficiaryRut || null,
      email: beneficiary.beneficiaryEmail || null,
      phone: beneficiary.beneficiaryPhone || null,
      cell_phone: beneficiary.beneficiaryCellPhone || null,
      address: beneficiary.beneficiaryAddress || null,
      country: beneficiary.beneficiaryCountry || null,
      region: beneficiary.beneficiaryRegion || null,
      city: beneficiary.beneficiaryCity || null,
      commune: beneficiary.beneficiaryCommune || null,
    });
  }

  // 5. Crear participant contact (si existe)
  if (contact && (contact.contactName || contact.contactEmail || contact.contactPhone)) {
    await createClaimParticipant({
      claim_id: claim.id,
      type: "contact",
      full_name: contact.contactName || "Contacto",
      email: contact.contactEmail || null,
      phone: contact.contactPhone || null,
      notes: contact.contactRole || null,
    });
  }

  return claim;
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
  notes?: string | null;
  linked_to_insured?: boolean;
}) {
  return insertRow<{ id: string }>("claims_participants", input, "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, notes, linked_to_insured");
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
  linked_to_insured: boolean;
}>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<{ id: string }>("claims_participants", id, set, "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune");
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
    // 2. Verificar vigencias vs claim_date
    if (claimDate && existing.start_date && existing.end_date) {
      const claimDateOnly = claimDate.split("T")[0];
      const startDate = String(existing.start_date).split("T")[0];
      const endDate = String(existing.end_date).split("T")[0];
      if (claimDateOnly < startDate || claimDateOnly > endDate) {
        return {
          policyId: null,
          note: `Póliza ${policyNumber} (item ${item}) encontrada para la cia pero vigencias no coinciden (vigencia: ${startDate} a ${endDate}, siniestro: ${claimDateOnly}).`,
        };
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

    return { policyId: existing.id, note: null };
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
