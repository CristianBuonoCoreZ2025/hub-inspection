import { graphqlRequest } from "@/lib/nhost/graphql";
import type {
  InspectionSession, PropertyRisk, PropertyMateriality,
  SecurityMeasures, InsuredStatement, ThirdParty, DamageSketch,
  InspectionDamage,
} from "@/types";

const SESSION_FIELDS = `
  id claim_id scheduled_at started_at ended_at
  magic_link_token magic_link_expires_at status inspection_type
  inspection_date inspection_time
  interviewed_name interviewed_email interviewed_relationship
  police_report_number police_report_name police_report_rut
  firefighters_company other_insurances other_insurance_company
  inspector_observations
  cancellation_reason_id cancellation_notes cancelled_at cancelled_by
  property_risk
  property_materiality
  security_measures
  insured_statement
  third_parties
  created_at updated_at
`;

// ═══════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════

export async function getInspectionSessions(claimId?: string) {
  const where = claimId ? `{ claim_id: { _eq: "${claimId}" } }` : `{}`;
  const query = `
    query GetInspectionSessions {
      inspection_sessions(where: ${where}, order_by: { created_at: desc }) {
        ${SESSION_FIELDS}
        claim {
          claim_number policy_number claim_date client_reference claim_address
          inspector_id
          claims_participants(where: { type: { _eq: "insured" } }, limit: 1) {
            full_name
          }
          insurance_company { name }
        }
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_sessions: (InspectionSession & { claim?: { claim_number: string; policy_number: string; claim_date: string | null; client_reference: string | null; claim_address: string | null; inspector_id: string | null; claims_participants: { full_name: string | null }[]; insurance_company: { name: string } | null } })[] }>(query);
  return data.inspection_sessions;
}

export async function getInspectionSessionById(id: string) {
  const query = `
    query GetInspectionSessionById($id: uuid!) {
      inspection_sessions_by_pk(id: $id) {
        ${SESSION_FIELDS}
        claim {
          claim_number policy_number claim_date client_reference claim_address
          liquidation_number broker_executive
          inspector_id adjuster_id auditor_id dispatcher_id assistant_id
          insurance_company_id broker_id advisor_id
          insurance_company { name }
          broker { name }
          advisor { name }
          claims_participants(where: { type: { _in: ["insured", "contact"] } }) {
            type full_name first_name last_name email phone cell_phone
          }
        }
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_sessions_by_pk: InspectionSession & { claim?: any } }>(query, { id });
  return data.inspection_sessions_by_pk;
}

/**
 * Obtener las sesiones agendadas de un inspector en un rango de fechas.
 * El inspector se identifica via claim.inspector_id.
 * Solo retorna sesiones con status scheduled o active.
 */
export async function getInspectorSchedule(
  inspectorId: string,
  dateStart: string,
  dateEnd: string,
) {
  const query = `
    query GetInspectorSchedule($inspectorId: uuid!, $dateStart: timestamptz!, $dateEnd: timestamptz!) {
      inspection_sessions(
        where: {
          scheduled_at: { _gte: $dateStart, _lt: $dateEnd }
          status: { _in: ["scheduled", "active"] }
          claim: { inspector_id: { _eq: $inspectorId } }
        }
        order_by: { scheduled_at: asc }
      ) {
        id
        scheduled_at
        inspection_type
        status
        claim {
          claim_number
          claim_address
          claims_participants(where: { type: { _eq: "insured" } }, limit: 1) {
            full_name
          }
        }
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_sessions: {
    id: string;
    scheduled_at: string;
    inspection_type: "onsite" | "remote";
    status: string;
    claim: { claim_number: string; claim_address: string | null; claims_participants: { full_name: string | null }[] };
  }[] }>(query, { inspectorId, dateStart, dateEnd });
  return data.inspection_sessions;
}

export async function createInspectionSession(claimId: string, options: {
  inspectionType: "onsite" | "remote";
  scheduledAt: string;
  inspectorId?: string;
}) {
  // Validar que no exista una inspección activa para este siniestro
  const checkQuery = `
    query CheckActiveInspection($claimId: uuid!) {
      inspection_sessions(
        where: { claim_id: { _eq: $claimId }, status: { _in: ["scheduled", "active"] } }
        limit: 1
      ) { id status }
    }
  `;
  const checkData = await graphqlRequest<{ inspection_sessions: { id: string; status: string }[] }>(checkQuery, { claimId });
  if (checkData.inspection_sessions.length > 0) {
    throw new Error("Ya existe una inspección activa para este siniestro. Debe cancelar o completar la inspección existente antes de crear una nueva.");
  }

  const object: Record<string, unknown> = {
    claim_id: claimId,
    status: "scheduled",
    inspection_type: options.inspectionType,
    scheduled_at: options.scheduledAt,
  };
  // Si es remota, generar magic link token con expiración de 24h
  if (options.inspectionType === "remote") {
    object.magic_link_token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    object.magic_link_expires_at = expires.toISOString();
  }
  const mutation = `
    mutation CreateInspectionSession($object: inspection_sessions_insert_input!) {
      insert_inspection_sessions_one(object: $object) {
        ${SESSION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_sessions_one: InspectionSession }>(mutation, {
    object,
  });

  // Si se especificó un inspector, asignarlo al claim
  if (options.inspectorId && data.insert_inspection_sessions_one) {
    try {
      const { updateClaimFields } = await import("@/services/claims");
      await updateClaimFields(claimId, { inspector_id: options.inspectorId });
    } catch {
      // No bloquear la creación si no se puede asignar el inspector
    }
  }

  return data.insert_inspection_sessions_one;
}

/**
 * Cancelar una inspección con motivo.
 * Registra el motivo de cancelación y marca cancelled_at (via trigger).
 */
export async function cancelInspectionSession(
  id: string,
  reasonId: string,
  notes?: string,
  cancelledBy?: string,
) {
  const mutation = `
    mutation CancelInspection($id: uuid!, $set: inspection_sessions_set_input!) {
      update_inspection_sessions_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${SESSION_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {
    status: "cancelled",
    cancellation_reason_id: reasonId,
  };
  if (notes !== undefined) set.cancellation_notes = notes;
  if (cancelledBy !== undefined) set.cancelled_by = cancelledBy;
  // cancelled_at lo setea el trigger automáticamente
  const data = await graphqlRequest<{ update_inspection_sessions_by_pk: InspectionSession }>(mutation, { id, set });
  return data.update_inspection_sessions_by_pk;
}

/**
 * Reagendar una inspección: cancela la actual y crea una nueva
 * con la nueva fecha/hora y tipo.
 * Retorna la nueva inspección creada.
 */
export async function rescheduleInspectionSession(
  currentSessionId: string,
  claimId: string,
  reasonId: string,
  notes: string | undefined,
  newOptions: {
    inspectionType: "onsite" | "remote";
    scheduledAt: string;
    inspectorId?: string;
  },
  cancelledBy?: string,
) {
  // 1. Cancelar la inspección actual
  await cancelInspectionSession(currentSessionId, reasonId, notes, cancelledBy);

  // 2. Crear nueva inspección agendada con la nueva fecha
  const newSession = await createInspectionSession(claimId, newOptions);
  return newSession;
}

export async function updateInspectionSession(id: string, input: Partial<InspectionSession>) {
  const mutation = `
    mutation UpdateInspectionSession($id: uuid!, $set: inspection_sessions_set_input!) {
      update_inspection_sessions_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${SESSION_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_inspection_sessions_by_pk: InspectionSession }>(mutation, { id, set });
  return data.update_inspection_sessions_by_pk;
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY RISK
// ═══════════════════════════════════════════════════════════════

const RISK_FIELDS = `
  id session_id risk_type risk_class property_type apartment_number
  floor_count age_years built_surface room_count bathroom_count
  office_count warehouse_count is_habitable owner_name branch_count
  worker_resident_count business_line created_at updated_at
`;

export async function getPropertyRisk(sessionId: string) {
  const query = `
    query GetPropertyRisk($sessionId: uuid!) {
      property_risk(where: { session_id: { _eq: $sessionId } }) {
        ${RISK_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ property_risk: PropertyRisk[] }>(query, { sessionId });
  return data.property_risk[0] || null;
}

export async function upsertPropertyRisk(sessionId: string, input: Partial<PropertyRisk>) {
  const mutation = `
    mutation UpsertPropertyRisk($object: property_risk_insert_input!, $sessionId: uuid!) {
      insert_property_risk_one(object: $object, on_conflict: { constraint: property_risk_pkey, update_columns: [
        risk_type, risk_class, property_type, apartment_number, floor_count,
        age_years, built_surface, room_count, bathroom_count, office_count,
        warehouse_count, is_habitable, owner_name, branch_count,
        worker_resident_count, business_line
      ]}) {
        ${RISK_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_property_risk_one: PropertyRisk }>(mutation, {
    object: { session_id: sessionId, ...input },
    sessionId,
  });
  return data.insert_property_risk_one;
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY MATERIALITY
// ═══════════════════════════════════════════════════════════════

const MATERIALITY_FIELDS = `
  id session_id walls roof interior_flooring interior_ceilings
  interior_finishes exterior_finishes perimeter_closure others
  created_at updated_at
`;

export async function getPropertyMateriality(sessionId: string) {
  const query = `
    query GetPropertyMateriality($sessionId: uuid!) {
      property_materiality(where: { session_id: { _eq: $sessionId } }) {
        ${MATERIALITY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ property_materiality: PropertyMateriality[] }>(query, { sessionId });
  return data.property_materiality[0] || null;
}

export async function upsertPropertyMateriality(sessionId: string, input: Partial<PropertyMateriality>) {
  const mutation = `
    mutation UpsertPropertyMateriality($object: property_materiality_insert_input!) {
      insert_property_materiality_one(object: $object, on_conflict: { constraint: property_materiality_pkey, update_columns: [
        walls, roof, interior_flooring, interior_ceilings,
        interior_finishes, exterior_finishes, perimeter_closure, others
      ]}) {
        ${MATERIALITY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_property_materiality_one: PropertyMateriality }>(mutation, {
    object: { session_id: sessionId, ...input },
  });
  return data.insert_property_materiality_one;
}

// ═══════════════════════════════════════════════════════════════
// SECURITY MEASURES
// ═══════════════════════════════════════════════════════════════

const SECURITY_FIELDS = `
  id session_id protections protections_detail security_locks
  security_locks_detail security_guards security_guards_detail
  alarms alarms_detail cameras cameras_detail other_measures
  created_at updated_at
`;

export async function getSecurityMeasures(sessionId: string) {
  const query = `
    query GetSecurityMeasures($sessionId: uuid!) {
      security_measures(where: { session_id: { _eq: $sessionId } }) {
        ${SECURITY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ security_measures: SecurityMeasures[] }>(query, { sessionId });
  return data.security_measures[0] || null;
}

export async function upsertSecurityMeasures(sessionId: string, input: Partial<SecurityMeasures>) {
  const mutation = `
    mutation UpsertSecurityMeasures($object: security_measures_insert_input!) {
      insert_security_measures_one(object: $object, on_conflict: { constraint: security_measures_pkey, update_columns: [
        protections, protections_detail, security_locks, security_locks_detail,
        security_guards, security_guards_detail, alarms, alarms_detail,
        cameras, cameras_detail, other_measures
      ]}) {
        ${SECURITY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_security_measures_one: SecurityMeasures }>(mutation, {
    object: { session_id: sessionId, ...input },
  });
  return data.insert_security_measures_one;
}

// ═══════════════════════════════════════════════════════════════
// INSURED STATEMENT
// ═══════════════════════════════════════════════════════════════

const STATEMENT_FIELDS = `
  id session_id statement entry_exit_point alarm_activation
  stolen_items_estimate vehicle_use incident_duration
  created_at updated_at
`;

export async function getInsuredStatement(sessionId: string) {
  const query = `
    query GetInsuredStatement($sessionId: uuid!) {
      insured_statement(where: { session_id: { _eq: $sessionId } }) {
        ${STATEMENT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insured_statement: InsuredStatement[] }>(query, { sessionId });
  return data.insured_statement[0] || null;
}

export async function upsertInsuredStatement(sessionId: string, input: Partial<InsuredStatement>) {
  const mutation = `
    mutation UpsertInsuredStatement($object: insured_statement_insert_input!) {
      insert_insured_statement_one(object: $object, on_conflict: { constraint: insured_statement_pkey, update_columns: [
        statement, entry_exit_point, alarm_activation,
        stolen_items_estimate, vehicle_use, incident_duration
      ]}) {
        ${STATEMENT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_insured_statement_one: InsuredStatement }>(mutation, {
    object: { session_id: sessionId, ...input },
  });
  return data.insert_insured_statement_one;
}

// ═══════════════════════════════════════════════════════════════
// THIRD PARTIES
// ═══════════════════════════════════════════════════════════════

const THIRD_PARTY_FIELDS = `
  id session_id party_type full_name rut address commune phone email
  created_at updated_at
`;

export async function getThirdParties(sessionId: string) {
  const query = `
    query GetThirdParties($sessionId: uuid!) {
      third_parties(where: { session_id: { _eq: $sessionId } }) {
        ${THIRD_PARTY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ third_parties: ThirdParty[] }>(query, { sessionId });
  return data.third_parties;
}

export async function createThirdParty(input: Omit<ThirdParty, "id" | "created_at" | "updated_at">) {
  const mutation = `
    mutation CreateThirdParty($object: third_parties_insert_input!) {
      insert_third_parties_one(object: $object) {
        ${THIRD_PARTY_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_third_parties_one: ThirdParty }>(mutation, { object: input });
  return data.insert_third_parties_one;
}

export async function updateThirdParty(id: string, input: Partial<ThirdParty>) {
  const mutation = `
    mutation UpdateThirdParty($id: uuid!, $set: third_parties_set_input!) {
      update_third_parties_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${THIRD_PARTY_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_third_parties_by_pk: ThirdParty }>(mutation, { id, set });
  return data.update_third_parties_by_pk;
}

export async function deleteThirdParty(id: string) {
  const mutation = `
    mutation DeleteThirdParty($id: uuid!) {
      delete_third_parties_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE SKETCHES
// ═══════════════════════════════════════════════════════════════

const SKETCH_FIELDS = `
  id session_id sketch_url label created_at
`;

export async function getDamageSketches(sessionId: string) {
  const query = `
    query GetDamageSketches($sessionId: uuid!) {
      damage_sketches(where: { session_id: { _eq: $sessionId } }) {
        ${SKETCH_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ damage_sketches: DamageSketch[] }>(query, { sessionId });
  return data.damage_sketches;
}

export async function createDamageSketch(input: Omit<DamageSketch, "id" | "created_at">) {
  const mutation = `
    mutation CreateDamageSketch($object: damage_sketches_insert_input!) {
      insert_damage_sketches_one(object: $object) {
        ${SKETCH_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_damage_sketches_one: DamageSketch }>(mutation, { object: input });
  return data.insert_damage_sketches_one;
}

export async function updateDamageSketch(id: string, input: Partial<Pick<DamageSketch, "label" | "sketch_url">>) {
  const mutation = `
    mutation UpdateDamageSketch($id: uuid!, $set: damage_sketches_set_input!) {
      update_damage_sketches_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${SKETCH_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  if (input.label !== undefined) set.label = input.label;
  if (input.sketch_url !== undefined) set.sketch_url = input.sketch_url;
  const data = await graphqlRequest<{ update_damage_sketches_by_pk: DamageSketch }>(mutation, { id, set });
  return data.update_damage_sketches_by_pk;
}

export async function deleteDamageSketch(id: string) {
  const mutation = `
    mutation DeleteDamageSketch($id: uuid!) {
      delete_damage_sketches_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
// DAMAGES (extended)
// ═══════════════════════════════════════════════════════════════

const DAMAGE_FIELDS = `
  id session_id category subcategory description observations severity
  dependency sector materiality_type unit quantity damage_type
  product brand_model purchase_date estimated_amount
  created_at updated_at
`;

export async function getDamages(sessionId: string) {
  const query = `
    query GetDamages($sessionId: uuid!) {
      inspection_damages(where: { session_id: { _eq: $sessionId } }) {
        ${DAMAGE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_damages: InspectionDamage[] }>(query, { sessionId });
  return data.inspection_damages;
}

export async function createDamage(input: Omit<InspectionDamage, "id" | "created_at" | "updated_at">) {
  const mutation = `
    mutation CreateDamage($object: inspection_damages_insert_input!) {
      insert_inspection_damages_one(object: $object) {
        ${DAMAGE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_damages_one: InspectionDamage }>(mutation, { object: input });
  return data.insert_inspection_damages_one;
}

export async function updateDamage(id: string, input: Partial<InspectionDamage>) {
  const mutation = `
    mutation UpdateDamage($id: uuid!, $set: inspection_damages_set_input!) {
      update_inspection_damages_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${DAMAGE_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_inspection_damages_by_pk: InspectionDamage }>(mutation, { id, set });
  return data.update_inspection_damages_by_pk;
}

export async function deleteDamage(id: string) {
  const mutation = `
    mutation DeleteDamage($id: uuid!) {
      delete_inspection_damages_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
//  CHECKLIST
// ═══════════════════════════════════════════════════════════════

const CHECKLIST_FIELDS = `
  id session_id area item status notes created_at updated_at
`;

export async function getChecklists(sessionId: string) {
  const query = `
    query GetChecklists($sessionId: uuid!) {
      inspection_checklists(where: { session_id: { _eq: $sessionId } }) {
        ${CHECKLIST_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_checklists: import("@/types").InspectionChecklist[] }>(query, { sessionId });
  return data.inspection_checklists;
}

export async function createChecklistItem(input: Omit<import("@/types").InspectionChecklist, "id" | "created_at" | "updated_at">) {
  const mutation = `
    mutation CreateChecklistItem($object: inspection_checklists_insert_input!) {
      insert_inspection_checklists_one(object: $object) {
        ${CHECKLIST_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_checklists_one: import("@/types").InspectionChecklist }>(mutation, { object: input });
  return data.insert_inspection_checklists_one;
}

export async function updateChecklistItem(id: string, input: Partial<import("@/types").InspectionChecklist>) {
  const mutation = `
    mutation UpdateChecklistItem($id: uuid!, $set: inspection_checklists_set_input!) {
      update_inspection_checklists_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${CHECKLIST_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_inspection_checklists_by_pk: import("@/types").InspectionChecklist }>(mutation, { id, set });
  return data.update_inspection_checklists_by_pk;
}

export async function deleteChecklistItem(id: string) {
  const mutation = `
    mutation DeleteChecklistItem($id: uuid!) {
      delete_inspection_checklists_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
//  EVIDENCES
// ═══════════════════════════════════════════════════════════════

const EVIDENCE_FIELDS = `
  id session_id type url description created_at
`;

export async function getEvidences(sessionId: string) {
  const query = `
    query GetEvidences($sessionId: uuid!) {
      inspection_evidences(where: { session_id: { _eq: $sessionId } }) {
        ${EVIDENCE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_evidences: import("@/types").InspectionEvidence[] }>(query, { sessionId });
  return data.inspection_evidences;
}

export async function createEvidence(input: Omit<import("@/types").InspectionEvidence, "id" | "created_at">) {
  const mutation = `
    mutation CreateEvidence($object: inspection_evidences_insert_input!) {
      insert_inspection_evidences_one(object: $object) {
        ${EVIDENCE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_evidences_one: import("@/types").InspectionEvidence }>(mutation, { object: input });
  return data.insert_inspection_evidences_one;
}

export async function deleteEvidence(id: string) {
  const mutation = `
    mutation DeleteEvidence($id: uuid!) {
      delete_inspection_evidences_by_pk(id: $id) { id }
    }
  `;
  await graphqlRequest(mutation, { id });
}

// ═══════════════════════════════════════════════════════════════
//  SIGNATURES
// ═══════════════════════════════════════════════════════════════

const SIGNATURE_FIELDS = `
  id session_id role signature_url signed_at ip_address user_agent
`;

export async function getSignatures(sessionId: string) {
  const query = `
    query GetSignatures($sessionId: uuid!) {
      inspection_signatures(where: { session_id: { _eq: $sessionId } }) {
        ${SIGNATURE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_signatures: import("@/types").InspectionSignature[] }>(query, { sessionId });
  return data.inspection_signatures;
}

export async function createSignature(input: Omit<import("@/types").InspectionSignature, "id">) {
  const mutation = `
    mutation CreateSignature($object: inspection_signatures_insert_input!) {
      insert_inspection_signatures_one(object: $object) {
        ${SIGNATURE_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_signatures_one: import("@/types").InspectionSignature }>(mutation, { object: input });
  return data.insert_inspection_signatures_one;
}

// ═══════════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════════

const REPORT_FIELDS = `
  id session_id report_url generated_at status
  report_type cancellation_reason_id cancellation_notes
`;

export async function getReport(sessionId: string) {
  const query = `
    query GetReport($sessionId: uuid!) {
      inspection_reports(where: { session_id: { _eq: $sessionId } }) {
        ${REPORT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_reports: import("@/types").InspectionReport[] }>(query, { sessionId });
  return data.inspection_reports[0] || null;
}

export async function createReport(input: Omit<import("@/types").InspectionReport, "id">) {
  const mutation = `
    mutation CreateReport($object: inspection_reports_insert_input!) {
      insert_inspection_reports_one(object: $object) {
        ${REPORT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_reports_one: import("@/types").InspectionReport }>(mutation, { object: input });
  return data.insert_inspection_reports_one;
}

export async function updateReport(id: string, input: Partial<import("@/types").InspectionReport>) {
  const mutation = `
    mutation UpdateReport($id: uuid!, $set: inspection_reports_set_input!) {
      update_inspection_reports_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${REPORT_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_inspection_reports_by_pk: import("@/types").InspectionReport }>(mutation, { id, set });
  return data.update_inspection_reports_by_pk;
}
