import { graphqlRequest } from "@/lib/nhost/graphql";
import type {
  InspectionSession, PropertyRisk, PropertyMateriality,
  SecurityMeasures, InsuredStatement, ThirdParty, DamageSketch,
  InspectionDamage,
} from "@/types";

const SESSION_FIELDS = `
  id claim_id scheduled_at started_at ended_at
  magic_link_token magic_link_expires_at status
  inspection_date inspection_time
  interviewed_name interviewed_email interviewed_relationship
  police_report_number police_report_name police_report_rut
  firefighters_company other_insurances other_insurance_company
  inspector_observations
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
        claim { claim_number insured_name address }
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_sessions: (InspectionSession & { claim?: { claim_number: string; insured_name: string; address: string } })[] }>(query);
  return data.inspection_sessions;
}

export async function getInspectionSessionById(id: string) {
  const query = `
    query GetInspectionSessionById($id: uuid!) {
      inspection_sessions_by_pk(id: $id) {
        ${SESSION_FIELDS}
        claim { claim_number insured_name address city claim_date claim_time contact_name contact_role contact_email
          insurance_company policy_number liquidation_number internal_number
          broker_name broker_executive broker_number builder_name advisor
          inspector_id adjuster_id auditor_id dispatcher_id assistant_id
        }
      }
    }
  `;
  const data = await graphqlRequest<{ inspection_sessions_by_pk: InspectionSession & { claim?: Record<string, unknown> } }>(query, { id });
  return data.inspection_sessions_by_pk;
}

export async function createInspectionSession(claimId: string) {
  const mutation = `
    mutation CreateInspectionSession($object: inspection_sessions_insert_input!) {
      insert_inspection_sessions_one(object: $object) {
        ${SESSION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_inspection_sessions_one: InspectionSession }>(mutation, {
    object: { claim_id: claimId, status: "pending" },
  });
  return data.insert_inspection_sessions_one;
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
