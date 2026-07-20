import { fetchAll, fetchById, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";
import type { Claim, ClaimInput } from "@/types";

const CLAIM_SELECT =
  "id, claim_number, policy_number, policy_id, claim_date, status_id, report_date, assignment_date, client_reference, company_report_number, liquidation_number, is_special_claim, summary, event_id, internal_number, notes, company_id, assigned_adjuster_id, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, claim_cause_id, claim_type_id, business_line_id, insurance_product_id, country_id, region_id, city_id, commune_id, construction_type_id, destination_housing_id, damage_classification_id, habitability_id, type_id, currency_id, service_type_id, billing_type_id, claim_address, owner_same_as_insured, policy_item, policy_start_date, policy_end_date, policy_amount, policy_premium, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, updated_at, updated_by, disabled, disabled_reason, disabled_at, disabled_by, reopened_at, reopened_by, reopened_reason, inspection_sessions:inspection_sessions(id, claim_action_id, status, inspection_number, inspection_type, scheduled_at, started_at, ended_at, created_at), status:lookup_catalog!claims_status_id_fkey(id, category, code, name), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name, email), adjuster:profiles!claims_adjuster_id_fkey(id, full_name, email), inspector:profiles!claims_inspector_id_fkey(id, full_name, email), auditor:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant:profiles!claims_assistant_id_fkey(id, full_name, email), broker:brokers!claims_broker_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), policy:policies!claims_policy_id_fkey(id, policy_number, policy_name, status, currency), currency:currencies!claims_currency_id_fkey(id, code, name, symbol, decimals)";

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
  return fetchById<Claim>("claims", id, CLAIM_SELECT);
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

export async function getClaimParticipants(id: string) {
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
    linked_to_insured: boolean;
  };
  return fetchAll<Participant>("claims_participants", {
    select: "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, linked_to_insured",
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
  return insertRow<Claim>("claims", { ...buildClaimObject(input) }, CLAIM_SELECT);
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
    claimCity: string;
    claimCommune?: string | null;
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
  }, CLAIM_SELECT);

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

  return updateRow<Claim>("claims", id, set, CLAIM_SELECT);
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
  linked_to_insured?: boolean;
}) {
  return insertRow<{ id: string }>("claims_participants", input, "id, claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, country, region, city, commune, linked_to_insured");
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
