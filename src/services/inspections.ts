import { fetchAll, fetchById, insertRow, updateRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";
import type {
  InspectionSession, PropertyRisk, PropertyMateriality,
  SecurityMeasures, InsuredStatement, ThirdParty, DamageSketch,
  InspectionDamage,
} from "@/types";

const SESSION_SELECT = `
  id, claim_id, action_template_id, scheduled_at, started_at, ended_at,
  magic_link_token, magic_link_expires_at, status, inspection_type,
  inspection_date, inspection_time,
  interviewed_name, interviewed_email, interviewed_relationship,
  police_report_number, police_report_name, police_report_rut,
  firefighters_company, other_insurances, other_insurance_company,
  inspector_observations,
  cancellation_reason_id, cancellation_notes, cancelled_at, cancelled_by,
  active_tab, acta_step,
  property_risk, property_materiality, security_measures, insured_statement, third_parties,
  created_at, updated_at
`;

// ═══════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Genera el número de inspección basándose en la codificación de la gestión vinculada.
 * Formato: {liquidation_number}-{template_code}-{seq:3}
 * Si no hay gestión vinculada, usa "I" como código (compatibilidad hacia atrás).
 */
function buildInspectionNumber(
  liquidation: string | null | undefined,
  templateCode: string | null | undefined,
  seq: number
): string {
  const code = templateCode || "I";
  return `${liquidation || "UNKNOWN"}-${code}-${String(seq).padStart(3, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionWithRelations = InspectionSession & { created_at: string; action_template?: { code: string | null } | null; claim?: any };

export async function getInspectionSessions(claimId?: string) {
  const sessions = await fetchAll<SessionWithRelations>("inspection_sessions", {
    select: `${SESSION_SELECT}, action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, inspector_id, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`,
    ...(claimId ? { eq: { claim_id: claimId } } : {}),
    order: { column: "created_at", ascending: false },
  });

  // Filtrar claims_participants client-side: solo insured, limit 1
  for (const s of sessions) {
    if (s.claim?.claims_participants) {
      s.claim.claims_participants = s.claim.claims_participants.filter((p: { type: string }) => p.type === "insured").slice(0, 1);
    }
  }

  // Calcular inspection_number client-side: {liquidation_number}-{template_code}-{seq:3}
  // La secuencia se calcula contando sesiones del mismo claim con created_at menor o igual.
  const sorted = [...sessions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const seqMap = new Map<string, number>();
  for (const s of sorted) {
    const seq = (seqMap.get(s.claim_id) || 0) + 1;
    seqMap.set(s.claim_id, seq);
    (s as InspectionSession & { inspection_number: string }).inspection_number =
      buildInspectionNumber(s.claim?.liquidation_number, s.action_template?.code, seq);
  }

  return sessions;
}

export async function getInspectionSessionByToken(token: string) {
  const sessions = await fetchAll<SessionWithRelations>("inspection_sessions", {
    select: `${SESSION_SELECT}, action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, first_name, last_name, email, phone, cell_phone), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`,
    eq: { magic_link_token: token },
    limit: 1,
  });
  const session = sessions[0];
  if (!session) return null;

  // Filtrar claims_participants client-side: insured + contact
  if (session.claim?.claims_participants) {
    session.claim.claims_participants = session.claim.claims_participants.filter(
      (p: { type: string }) => p.type === "insured" || p.type === "contact",
    );
  }

  // Calcular inspection_number: {liquidation_number}-{template_code}-{seq:3}
  try {
    const countSessions = await fetchAll<{ id: string }>("inspection_sessions", {
      select: "id",
      eq: { claim_id: session.claim_id },
      lte: { created_at: session.created_at },
    });
    const seq = countSessions.length;
    (session as InspectionSession & { inspection_number: string }).inspection_number =
      buildInspectionNumber((session.claim as any)?.liquidation_number, session.action_template?.code, seq);
  } catch {
    (session as InspectionSession & { inspection_number: string }).inspection_number =
      buildInspectionNumber((session.claim as any)?.liquidation_number, session.action_template?.code, 1);
  }

  return session;
}

/**
 * Query GraphQL para la vista en vivo del magic link.
 * Reutilizada por la API route server-side (con admin secret) para evitar
 * exponer permisos anonymous en Hasura.
 * @deprecated Migrado a Supabase — usar getInspectionSessionLive()
 */
export const INSPECTION_LIVE_QUERY = "";

/**
 * Adjunta el inspection_number ({liquidation_number}-{template_code}-{seq:3}) a la sesión.
 * `seq` se calcula contando sesiones del mismo claim con created_at <= al de esta.
 * Si no hay template_code, usa "I" como código (compatibilidad hacia atrás).
 */
export function attachInspectionNumber(
  session: { claim?: { liquidation_number?: string | null } | null; action_template?: { code: string | null } | null; inspection_number?: string },
  seq: number
): void {
  session.inspection_number = buildInspectionNumber(session.claim?.liquidation_number, session.action_template?.code, seq);
}

/**
 * Obtener la sesión completa con datos relacionados para vista en tiempo real del magic link.
 * Trae evidencias, notas, checklist, daños y mensajes del chat.
 */
export async function getInspectionSessionLive(token: string) {
  const sessions = await fetchAll<any>("inspection_sessions", {
    select: `
      id, claim_id, status, inspection_type, scheduled_at, started_at, ended_at,
      magic_link_token, magic_link_expires_at, created_at,
      inspection_date, inspection_time,
      interviewed_name, interviewed_email, interviewed_relationship,
      police_report_number, police_report_name, police_report_rut,
      firefighters_company, other_insurances, other_insurance_company,
      active_tab, acta_step, inspector_observations,
      property_risk, property_materiality, security_measures, insured_statement, third_parties,
      action_template:action_template!inspection_sessions_action_template_id_fkey(code),
      inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type, description, category, created_at),
      inspection_notes:inspection_notes!inspection_notes_session_id_fkey(id, content, created_at),
      inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey(id, area, item, status, notes, created_at),
      inspection_damages:inspection_damages!inspection_damages_session_id_fkey(id, category, subcategory, description, observations, severity, dependency, sector, materiality_type, unit, quantity, damage_type, product, brand_model, purchase_date, estimated_amount, created_at),
      inspection_chat_messages:inspection_chat_messages!inspection_chat_messages_session_id_fkey(id, content, sender_name, sender_role, created_at),
      inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey(id, role, signature_url, signed_at),
      damage_sketches:damage_sketches!damage_sketches_session_id_fkey(id, sketch_url, label, created_at),
      claim:claims!inspection_sessions_claim_id_fkey(claim_number, client_reference, claim_address, policy_number, claim_date, liquidation_number, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, email, phone, cell_phone), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))
    `,
    eq: { magic_link_token: token },
    limit: 1,
  });
  const session = sessions[0];
  if (!session) return null;

  // Sort nested relations client-side (Supabase no soporta order_by en nested select)
  if (session.inspection_evidences) {
    session.inspection_evidences.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_notes) {
    session.inspection_notes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_checklists) {
    session.inspection_checklists.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_damages) {
    session.inspection_damages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_chat_messages) {
    session.inspection_chat_messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  if (session.inspection_signatures) {
    session.inspection_signatures.sort((a: any, b: any) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime());
  }
  if (session.damage_sketches) {
    session.damage_sketches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // Filtrar claims_participants client-side: insured + contact
  if (session.claim?.claims_participants) {
    session.claim.claims_participants = session.claim.claims_participants.filter(
      (p: { type: string }) => p.type === "insured" || p.type === "contact",
    );
  }

  // Calcular inspection_number
  try {
    const countSessions = await fetchAll<{ id: string }>("inspection_sessions", {
      select: "id",
      eq: { claim_id: session.claim_id },
      lte: { created_at: session.created_at || new Date().toISOString() },
    });
    attachInspectionNumber(session, countSessions.length);
  } catch {
    attachInspectionNumber(session, 1);
  }

  return session;
}

export async function getInspectionSessionById(id: string) {
  const session = await fetchById<any>("inspection_sessions", id, `
    ${SESSION_SELECT}, created_at,
    action_template:action_template!inspection_sessions_action_template_id_fkey(id, name, code, action_features_id),
    claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, broker_executive, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, insurance_company:insurance_companies!claims_insurance_company_id_fkey(name), broker:brokers!claims_broker_id_fkey(name), advisor:advisors!claims_advisor_id_fkey(name), claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, first_name, last_name, email, phone, cell_phone)),
    inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type, description),
    inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey(id, area, item, status),
    inspection_damages:inspection_damages!inspection_damages_session_id_fkey(id, description, severity),
    inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey(id, role),
    damage_sketches:damage_sketches!damage_sketches_session_id_fkey(id)
  `);
  if (!session) return null;

  // Filtrar claims_participants client-side: insured + contact
  if (session.claim?.claims_participants) {
    session.claim.claims_participants = session.claim.claims_participants.filter(
      (p: { type: string }) => p.type === "insured" || p.type === "contact",
    );
  }

  // Calcular inspection_number: contar sesiones del mismo claim con created_at <= esta
  try {
    const countSessions = await fetchAll<{ id: string }>("inspection_sessions", {
      select: "id",
      eq: { claim_id: session.claim_id },
      lte: { created_at: session.created_at },
    });
    const seq = countSessions.length;
    (session as InspectionSession & { inspection_number: string }).inspection_number =
      buildInspectionNumber((session.claim as any)?.liquidation_number, session.action_template?.code, seq);
  } catch {
    (session as InspectionSession & { inspection_number: string }).inspection_number =
      buildInspectionNumber((session.claim as any)?.liquidation_number, session.action_template?.code, 1);
  }

  return session;
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
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspection_sessions")
    .select(`
      id, scheduled_at, inspection_type, status,
      claim!inner(claim_number, claim_address, claims_participants(type, full_name))
    `)
    .gte("scheduled_at", dateStart)
    .lt("scheduled_at", dateEnd)
    .in("status", ["scheduled", "active"])
    .eq("claim.inspector_id", inspectorId)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);

  const sessions = (data ?? []) as {
    id: string;
    scheduled_at: string;
    inspection_type: "onsite" | "remote";
    status: string;
    claim: { claim_number: string; claim_address: string | null; claims_participants: { type: string; full_name: string | null }[] };
  }[];

  // Filtrar claims_participants client-side: solo insured, limit 1
  for (const s of sessions) {
    if (s.claim?.claims_participants) {
      s.claim.claims_participants = s.claim.claims_participants.filter((p) => p.type === "insured").slice(0, 1);
    }
  }

  return sessions;
}

export async function createInspectionSession(claimId: string, options: {
  inspectionType: "onsite" | "remote";
  scheduledAt: string;
  inspectorId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  inspectionLocation?: string;
  schedulingNotes?: string;
  actionTemplateId?: string;
}) {
  // Validar que no exista una inspección activa para este siniestro
  const existing = await fetchAll<{ id: string; status: string }>("inspection_sessions", {
    select: "id, status",
    eq: { claim_id: claimId },
    in: { status: ["scheduled", "active"] },
    limit: 1,
  });
  if (existing.length > 0) {
    throw new Error("Ya existe una inspección activa para este siniestro. Debe cancelar o completar la inspección existente antes de crear una nueva.");
  }

  const object: Record<string, unknown> = {
    claim_id: claimId,
    status: "scheduled",
    inspection_type: options.inspectionType,
    scheduled_at: options.scheduledAt,
  };
  if (options.actionTemplateId) object.action_template_id = options.actionTemplateId;
  // Datos de contacto editables
  if (options.contactName) object.interviewed_name = options.contactName;
  if (options.contactEmail) object.interviewed_email = options.contactEmail;
  // Comentarios del agendamiento + teléfono → inspector_observations
  const obsParts: string[] = [];
  if (options.contactPhone) obsParts.push(`Tel: ${options.contactPhone}`);
  if (options.schedulingNotes) obsParts.push(options.schedulingNotes);
  if (obsParts.length > 0) object.inspector_observations = obsParts.join("\n\n");
  // Si es remota, generar magic link token con expiración de 24h
  if (options.inspectionType === "remote") {
    object.magic_link_token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    object.magic_link_expires_at = expires.toISOString();
  }

  const created = await insertRow<InspectionSession>("inspection_sessions", object, SESSION_SELECT);

  // Si se especificó un inspector, asignarlo al claim
  if (options.inspectorId && created) {
    try {
      const { updateClaimFields } = await import("@/services/claims");
      const fields: Record<string, unknown> = { inspector_id: options.inspectorId };
      // Si se modificó el lugar de inspección, actualizar el claim_address
      if (options.inspectionLocation) {
        fields.claim_address = options.inspectionLocation;
      }
      await updateClaimFields(claimId, fields);
    } catch {
      // No bloquear la creación si no se puede asignar el inspector
    }
  }

  return created;
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
  const set: Record<string, unknown> = {
    status: "cancelled",
    cancellation_reason_id: reasonId,
  };
  if (notes !== undefined) set.cancellation_notes = notes;
  if (cancelledBy !== undefined) set.cancelled_by = cancelledBy;
  // cancelled_at lo setea el trigger automáticamente
  return updateRow<InspectionSession>("inspection_sessions", id, set, SESSION_SELECT);
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
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<InspectionSession>("inspection_sessions", id, set, SESSION_SELECT);
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY RISK
// ═══════════════════════════════════════════════════════════════

const RISK_SELECT = `
  id, session_id, risk_type, risk_class, property_type, apartment_number,
  floor_count, age_years, built_surface, room_count, bathroom_count,
  office_count, warehouse_count, is_habitable, owner_name, branch_count,
  worker_resident_count, business_line, created_at, updated_at
`;

export async function getPropertyRisk(sessionId: string) {
  const rows = await fetchAll<PropertyRisk>("property_risk", {
    select: RISK_SELECT,
    eq: { session_id: sessionId },
  });
  return rows[0] || null;
}

export async function upsertPropertyRisk(sessionId: string, input: Partial<PropertyRisk>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("property_risk")
    .upsert({ session_id: sessionId, ...input }, { onConflict: "session_id" })
    .select(RISK_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as PropertyRisk;
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY MATERIALITY
// ═══════════════════════════════════════════════════════════════

const MATERIALITY_SELECT = `
  id, session_id, walls, roof, interior_flooring, interior_ceilings,
  interior_finishes, exterior_finishes, perimeter_closure, others,
  created_at, updated_at
`;

export async function getPropertyMateriality(sessionId: string) {
  const rows = await fetchAll<PropertyMateriality>("property_materiality", {
    select: MATERIALITY_SELECT,
    eq: { session_id: sessionId },
  });
  return rows[0] || null;
}

export async function upsertPropertyMateriality(sessionId: string, input: Partial<PropertyMateriality>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("property_materiality")
    .upsert({ session_id: sessionId, ...input }, { onConflict: "session_id" })
    .select(MATERIALITY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as PropertyMateriality;
}

// ═══════════════════════════════════════════════════════════════
// SECURITY MEASURES
// ═══════════════════════════════════════════════════════════════

const SECURITY_SELECT = `
  id, session_id, protections, protections_detail, security_locks,
  security_locks_detail, security_guards, security_guards_detail,
  alarms, alarms_detail, cameras, cameras_detail, other_measures,
  created_at, updated_at
`;

export async function getSecurityMeasures(sessionId: string) {
  const rows = await fetchAll<SecurityMeasures>("security_measures", {
    select: SECURITY_SELECT,
    eq: { session_id: sessionId },
  });
  return rows[0] || null;
}

export async function upsertSecurityMeasures(sessionId: string, input: Partial<SecurityMeasures>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("security_measures")
    .upsert({ session_id: sessionId, ...input }, { onConflict: "session_id" })
    .select(SECURITY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as SecurityMeasures;
}

// ═══════════════════════════════════════════════════════════════
// INSURED STATEMENT
// ═══════════════════════════════════════════════════════════════

const STATEMENT_SELECT = `
  id, session_id, statement, entry_exit_point, alarm_activation,
  stolen_items_estimate, vehicle_use, incident_duration,
  created_at, updated_at
`;

export async function getInsuredStatement(sessionId: string) {
  const rows = await fetchAll<InsuredStatement>("insured_statement", {
    select: STATEMENT_SELECT,
    eq: { session_id: sessionId },
  });
  return rows[0] || null;
}

export async function upsertInsuredStatement(sessionId: string, input: Partial<InsuredStatement>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("insured_statement")
    .upsert({ session_id: sessionId, ...input }, { onConflict: "session_id" })
    .select(STATEMENT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as InsuredStatement;
}

// ═══════════════════════════════════════════════════════════════
// THIRD PARTIES
// ═══════════════════════════════════════════════════════════════

const THIRD_PARTY_SELECT = `
  id, session_id, party_type, full_name, rut, address, commune, phone, email,
  created_at, updated_at
`;

export async function getThirdParties(sessionId: string) {
  return fetchAll<ThirdParty>("third_parties", {
    select: THIRD_PARTY_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createThirdParty(input: Omit<ThirdParty, "id" | "created_at" | "updated_at">) {
  return insertRow<ThirdParty>("third_parties", input, THIRD_PARTY_SELECT);
}

export async function updateThirdParty(id: string, input: Partial<ThirdParty>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<ThirdParty>("third_parties", id, set, THIRD_PARTY_SELECT);
}

export async function deleteThirdParty(id: string) {
  await deleteRow("third_parties", id);
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE SKETCHES
// ═══════════════════════════════════════════════════════════════

const SKETCH_SELECT = `id, session_id, sketch_url, label, created_at`;

export async function getDamageSketches(sessionId: string) {
  return fetchAll<DamageSketch>("damage_sketches", {
    select: SKETCH_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createDamageSketch(input: Omit<DamageSketch, "id" | "created_at">) {
  return insertRow<DamageSketch>("damage_sketches", input, SKETCH_SELECT);
}

export async function updateDamageSketch(id: string, input: Partial<Pick<DamageSketch, "label" | "sketch_url">>) {
  const set: Record<string, unknown> = {};
  if (input.label !== undefined) set.label = input.label;
  if (input.sketch_url !== undefined) set.sketch_url = input.sketch_url;
  return updateRow<DamageSketch>("damage_sketches", id, set, SKETCH_SELECT);
}

export async function deleteDamageSketch(id: string) {
  await deleteRow("damage_sketches", id);
}

// ═══════════════════════════════════════════════════════════════
// DAMAGES (extended)
// ═══════════════════════════════════════════════════════════════

const DAMAGE_SELECT = `
  id, session_id, category, subcategory, description, observations, severity,
  dependency, sector, materiality_type, unit, quantity, damage_type,
  product, brand_model, purchase_date, estimated_amount,
  created_at, updated_at
`;

export async function getDamages(sessionId: string) {
  return fetchAll<InspectionDamage>("inspection_damages", {
    select: DAMAGE_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createDamage(input: Omit<InspectionDamage, "id" | "created_at" | "updated_at">) {
  return insertRow<InspectionDamage>("inspection_damages", input, DAMAGE_SELECT);
}

export async function updateDamage(id: string, input: Partial<InspectionDamage>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<InspectionDamage>("inspection_damages", id, set, DAMAGE_SELECT);
}

export async function deleteDamage(id: string) {
  await deleteRow("inspection_damages", id);
}

// ═══════════════════════════════════════════════════════════════
//  CHECKLIST
// ═══════════════════════════════════════════════════════════════

const CHECKLIST_SELECT = `id, session_id, area, item, status, notes, created_at, updated_at`;

export async function getChecklists(sessionId: string) {
  return fetchAll<import("@/types").InspectionChecklist>("inspection_checklists", {
    select: CHECKLIST_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createChecklistItem(input: Omit<import("@/types").InspectionChecklist, "id" | "created_at" | "updated_at">) {
  return insertRow<import("@/types").InspectionChecklist>("inspection_checklists", input, CHECKLIST_SELECT);
}

export async function updateChecklistItem(id: string, input: Partial<import("@/types").InspectionChecklist>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<import("@/types").InspectionChecklist>("inspection_checklists", id, set, CHECKLIST_SELECT);
}

export async function deleteChecklistItem(id: string) {
  await deleteRow("inspection_checklists", id);
}

// ═══════════════════════════════════════════════════════════════
//  EVIDENCES
// ═══════════════════════════════════════════════════════════════

const EVIDENCE_SELECT = `id, session_id, type, url, description, created_at`;

export async function getEvidences(sessionId: string) {
  return fetchAll<import("@/types").InspectionEvidence>("inspection_evidences", {
    select: EVIDENCE_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createEvidence(input: Omit<import("@/types").InspectionEvidence, "id" | "created_at">) {
  return insertRow<import("@/types").InspectionEvidence>("inspection_evidences", input, EVIDENCE_SELECT);
}

export async function deleteEvidence(id: string) {
  await deleteRow("inspection_evidences", id);
}

// ═══════════════════════════════════════════════════════════════
//  SIGNATURES
// ═══════════════════════════════════════════════════════════════

const SIGNATURE_SELECT = `id, session_id, role, signature_url, signed_at, ip_address, user_agent`;

export async function getSignatures(sessionId: string) {
  return fetchAll<import("@/types").InspectionSignature>("inspection_signatures", {
    select: SIGNATURE_SELECT,
    eq: { session_id: sessionId },
  });
}

export async function createSignature(input: Omit<import("@/types").InspectionSignature, "id">) {
  return insertRow<import("@/types").InspectionSignature>("inspection_signatures", input, SIGNATURE_SELECT);
}

// ═══════════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════════

const REPORT_SELECT = `id, session_id, report_url, generated_at, status, report_type, cancellation_reason_id, cancellation_notes`;

export async function getReport(sessionId: string) {
  const rows = await fetchAll<import("@/types").InspectionReport>("inspection_reports", {
    select: REPORT_SELECT,
    eq: { session_id: sessionId },
  });
  return rows[0] || null;
}

export async function createReport(input: Omit<import("@/types").InspectionReport, "id">) {
  return insertRow<import("@/types").InspectionReport>("inspection_reports", input, REPORT_SELECT);
}

export async function updateReport(id: string, input: Partial<import("@/types").InspectionReport>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<import("@/types").InspectionReport>("inspection_reports", id, set, REPORT_SELECT);
}
