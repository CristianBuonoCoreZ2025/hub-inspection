import { fetchAll, fetchById, insertRow, updateRow, deleteRow, getSupabaseClient } from "@/lib/supabase/db";
import type {
  InspectionSession, PropertyRisk, PropertyMateriality,
  SecurityMeasures, InsuredStatement, ThirdParty, DamageSketch,
  InspectionDamage, InspectionEvidence, InspectionSignature,
} from "@/types";

const SESSION_SELECT = "id, claim_id, claim_action_id, action_template_id, inspector_id, inspection_number, scheduled_at, started_at, ended_at, magic_link_token, magic_link_expires_at, status, inspection_type, inspection_date, inspection_time, interviewed_name, interviewed_email, interviewed_relationship, police_report_number, police_report_name, police_report_rut, firefighters_company, other_insurances, other_insurance_company, inspector_observations, cancellation_reason_id, cancellation_notes, cancelled_at, cancelled_by, active_tab, acta_step, property_risk, property_materiality, security_measures, insured_statement, third_parties, created_at, updated_at";

// ═══════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════

export interface SessionClaim {
  claim_number?: string;
  policy_number?: string;
  claim_date?: string;
  client_reference?: string;
  claim_address?: string;
  liquidation_number?: string;
  inspector_id?: string;
  broker_executive?: string;
  adjuster_id?: string;
  auditor_id?: string;
  dispatcher_id?: string;
  assistant_id?: string;
  insurance_company_id?: string;
  broker_id?: string;
  advisor_id?: string;
  country_id?: string;
  claim_cause_id?: string;
  commune_id?: string;
  claims_participants?: { type: string; full_name?: string; first_name?: string; last_name?: string; email?: string; phone?: string; cell_phone?: string; rut?: string; address?: string | null; person_type?: string | null; country?: string | null; region?: string | null; city?: string | null; commune?: string | null }[];
  insurance_company?: { name: string } | null;
  broker?: { name: string } | null;
  advisor?: { name: string } | null;
  claim_cause?: { name: string } | null;
  commune?: { name: string } | null;
  country?: { name: string } | null;
  region?: { name: string } | null;
  city?: { name: string } | null;
  destination_housing?: { name: string } | null;
}

export type SessionWithRelations = InspectionSession & { created_at: string; claim_action?: { code: string | null } | null; action_template?: { code: string | null } | null; claim?: SessionClaim };

interface LiveSession {
  id: string;
  claim_id: string;
  status: string;
  inspection_type: string;
  scheduled_at: string;
  started_at: string;
  ended_at: string;
  magic_link_token: string;
  magic_link_expires_at: string;
  created_at: string;
  inspection_date: string;
  inspection_time: string;
  interviewed_name: string;
  interviewed_email: string;
  interviewed_relationship: string;
  police_report_number: string;
  police_report_name: string;
  police_report_rut: string;
  firefighters_company: string;
  other_insurances: string;
  other_insurance_company: string;
  active_tab: string;
  acta_step: string;
  inspector_observations: string;
  property_risk: PropertyRisk;
  property_materiality: PropertyMateriality;
  security_measures: SecurityMeasures;
  insured_statement: InsuredStatement;
  third_parties: ThirdParty[];
  action_template?: { code: string } | null;
  claim_action?: { code: string } | null;
  inspection_evidences?: { id: string; url: string; type: string; description: string; category: string; metadata: { originalName?: string; fileSize?: number; mimeType?: string; pdfSummary?: string; pdfPageCount?: number } | null; created_at: string }[];
  inspection_notes?: { id: string; content: string; created_at: string }[];
  inspection_checklists?: { id: string; area: string; item: string; status: string; notes: string; created_at: string }[];
  inspection_damages?: { id: string; category: string; subcategory: string; description: string; observations: string; severity: string; dependency: string; sector: string; materiality_type: string; unit: string; quantity: string; damage_type: string; product: string; brand_model: string; purchase_date: string; estimated_amount: string; created_at: string }[];
  inspection_chat_messages?: { id: string; content: string; sender_name: string; sender_role: string; created_at: string }[];
  inspection_signatures?: { id: string; role: string; signature_url: string; signed_at: string }[];
  damage_sketches?: { id: string; sketch_url: string; label: string; created_at: string }[];
  claim?: SessionClaim;
  inspection_number?: string;
}

export interface SessionDetail extends Omit<InspectionSession, 'inspection_evidences' | 'inspection_checklists' | 'inspection_damages' | 'inspection_signatures' | 'damage_sketches'> {
  inspection_evidences?: InspectionEvidence[];
  inspection_checklists?: { id: string; area: string; item: string; status: string }[];
  inspection_damages?: InspectionDamage[];
  inspection_signatures?: InspectionSignature[];
  damage_sketches?: DamageSketch[];
  claim_action?: { id: string; code: string; action_status_id: string | null; issuer_id: string | null; issued_on: string | null; issued_by: string | null } | null;
  claim?: SessionClaim;
}

export async function getInspectionSessions(claimId?: string) {
  const sessions = await fetchAll<SessionWithRelations>("inspection_sessions", {
    select: `${SESSION_SELECT}, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code), action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, inspector_id, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`,
    ...(claimId ? { eq: { claim_id: claimId } } : {}),
    order: { column: "created_at", ascending: false },
  });

  // Filtrar claims_participants client-side: solo insured, limit 1
  for (const s of sessions) {
    if (s.claim?.claims_participants) {
      s.claim.claims_participants = s.claim.claims_participants.filter((p: { type: string }) => p.type === "insured").slice(0, 1);
    }
  }

  // Usar el code del claim_action como inspection_number (estándar de gestiones)
  for (const s of sessions) {
    const ca = s as InspectionSession & { claim_action?: { code: string | null } | null; inspection_number: string };
    if (ca.claim_action?.code) {
      ca.inspection_number = ca.claim_action.code;
    }
  }

  return sessions;
}

export async function getInspectionSessionByToken(token: string) {
  const sessions = await fetchAll<SessionWithRelations>("inspection_sessions", {
    select: `${SESSION_SELECT}, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code), action_template:action_template!inspection_sessions_action_template_id_fkey(code), claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, first_name, last_name, email, phone, cell_phone), insurance_company:insurance_companies!claims_insurance_company_id_fkey(name))`,
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

  // Usar el code del claim_action como inspection_number (estándar de gestiones)
  const ca = session as InspectionSession & { claim_action?: { code: string | null } | null; inspection_number: string };
  if (ca.claim_action?.code) {
    ca.inspection_number = ca.claim_action.code;
  }

  return session;
}

/**
 * Obtener la sesión completa con datos relacionados para vista en tiempo real del magic link.
 * Trae evidencias, notas, checklist, daños y mensajes del chat.
 */
export async function getInspectionSessionLive(token: string) {
  const sessions = await fetchAll<LiveSession>("inspection_sessions", {
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
      claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code),
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
    session.inspection_evidences.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_notes) {
    session.inspection_notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_checklists) {
    session.inspection_checklists.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_damages) {
    session.inspection_damages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (session.inspection_chat_messages) {
    session.inspection_chat_messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  if (session.inspection_signatures) {
    session.inspection_signatures.sort((a, b) => new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime());
  }
  if (session.damage_sketches) {
    session.damage_sketches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // Filtrar claims_participants client-side: insured + contact
  if (session.claim?.claims_participants) {
    session.claim.claims_participants = session.claim.claims_participants.filter(
      (p: { type: string }) => p.type === "insured" || p.type === "contact",
    );
  }

  // Usar el code del claim_action como inspection_number (estándar de gestiones)
  const ca = session;
  if (ca.claim_action?.code) {
    ca.inspection_number = ca.claim_action.code;
  }

  return session;
}

export async function getInspectionSessionById(id: string) {
  const session = await fetchById<SessionDetail>("inspection_sessions", id, `
    ${SESSION_SELECT}, created_at,
    claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(id, code, action_status_id, issuer_id, issued_on, issued_by),
    action_template:action_template!inspection_sessions_action_template_id_fkey(id, name, code, action_features_id),
    claim:claims!inspection_sessions_claim_id_fkey(claim_number, policy_number, claim_date, client_reference, claim_address, liquidation_number, broker_executive, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, country_id, region_id, city_id, commune_id, claim_cause_id, destination_housing_id, insurance_company:insurance_companies!claims_insurance_company_id_fkey(name), broker:brokers!claims_broker_id_fkey(name), advisor:advisors!claims_advisor_id_fkey(name), claim_cause:claim_causes!claims_claim_cause_id_fkey(name), country:countries!claims_country_id_fkey(name), region:regions!claims_region_id_fkey(name), city:cities!claims_city_id_fkey(name), commune:communes!claims_commune_id_fkey(name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(name), claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name, first_name, last_name, email, phone, cell_phone, rut, address, person_type, country, region, city, commune)),
    inspection_evidences:inspection_evidences!inspection_evidences_session_id_fkey(id, url, type, description, category, metadata, created_at),
    inspection_checklists:inspection_checklists!inspection_checklists_session_id_fkey(id, area, item, status),
    inspection_damages:inspection_damages!inspection_damages_session_id_fkey(id, description, severity, damage_type, dependency, sector, unit, quantity, estimated_amount, currency, observations, product, brand_model, created_at),
    inspection_signatures:inspection_signatures!inspection_signatures_session_id_fkey(id, role, signature_url, signed_at),
    damage_sketches:damage_sketches!damage_sketches_session_id_fkey(id, sketch_url, label, created_at)
  `);
  if (!session) return null;

  // Filtrar claims_participants client-side: insured + contact
  if (session.claim?.claims_participants) {
    session.claim.claims_participants = session.claim.claims_participants.filter(
      (p: { type: string }) => p.type === "insured" || p.type === "contact",
    );
  }

  // Usar el code del claim_action como inspection_number (estándar de gestiones)
  if (session.claim_action?.code) {
    session.inspection_number = session.claim_action.code;
  }

  return session;
}

/**
 * Obtener las sesiones agendadas de un inspector en un rango de fechas.
 * Busca por inspector_id de la sesión Y por claim.inspector_id (compatibilidad).
 * Solo retorna sesiones con status scheduled o active.
 */
export async function getInspectorSchedule(
  inspectorId: string,
  dateStart: string,
  dateEnd: string,
) {
  const supabase = getSupabaseClient();

  // 1. Buscar sesiones directamente por inspector_id
  const { data: directData, error: directError } = await supabase
    .from("inspection_sessions")
    .select(`
      id, scheduled_at, inspection_type, status, claim_id,
      claim:claims!inspection_sessions_claim_id_fkey(claim_number, claim_address, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name))
    `)
    .eq("inspector_id", inspectorId)
    .gte("scheduled_at", dateStart)
    .lt("scheduled_at", dateEnd)
    .in("status", ["scheduled", "active"])
    .order("scheduled_at", { ascending: true });

  if (directError) throw new Error(directError.message);

  // 2. Buscar también por claims.inspector_id (sesiones sin inspector_id propio)
  const { data: claimsData, error: claimsError } = await supabase
    .from("claims")
    .select("id, claim_number, claim_address")
    .eq("inspector_id", inspectorId);

  if (claimsError) throw new Error(claimsError.message);
  const claims = (claimsData as { id: string; claim_number: string; claim_address: string }[]) || [];
  const claimIds = claims.map(c => c.id);

  let legacySessions: typeof directData = [];
  if (claimIds.length > 0) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("inspection_sessions")
      .select(`
        id, scheduled_at, inspection_type, status, claim_id,
        claim:claims!inspection_sessions_claim_id_fkey(claim_number, claim_address, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name))
      `)
      .in("claim_id", claimIds)
      .is("inspector_id", null)
      .gte("scheduled_at", dateStart)
      .lt("scheduled_at", dateEnd)
      .in("status", ["scheduled", "active"])
      .order("scheduled_at", { ascending: true });

    if (legacyError) throw new Error(legacyError.message);
    legacySessions = legacyData ?? [];
  }

  // Combinar y deduplicar
  const allSessions = [...(directData ?? []), ...legacySessions];
  const seen = new Set<string>();
  const sessions = allSessions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }) as {
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

  // ── 1. Crear claim_action (gestión estándar) ──
  const { createClaimAction } = await import("@/services/claim-actions");
  const INSPECTION_FEATURE_ID = "a1000001-0000-0000-0000-000000000001"; // Inspección
  const inspectionName = options.inspectionType === "remote" ? "Inspección Remota" : "Inspección Presencial";

  const claimAction = await createClaimAction({
    claim_id: claimId,
    action_features_id: INSPECTION_FEATURE_ID,
    action_template_id: options.actionTemplateId,
    name: inspectionName,
    description: `Inspección ${options.inspectionType === "remote" ? "remota" : "presencial"} programada para ${new Date(options.scheduledAt).toLocaleString("es-CL")}`,
    issuer_id: options.inspectorId,
    expected_date: options.scheduledAt,
  });

  // ── 2. Crear inspection_session vinculada al claim_action ──
  const object: Record<string, unknown> = {
    claim_id: claimId,
    claim_action_id: claimAction.id,
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
  company_name, has_insurance, insurance_company, claim_number, notes,
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
  const res = await fetch(`/api/inspection/sketch/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al borrar croquis");
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// DAMAGES (extended)
// ═══════════════════════════════════════════════════════════════

const DAMAGE_SELECT = `
  id, session_id, category, subcategory, description, observations, severity,
  dependency, sector, materiality_type, unit, quantity, damage_type,
  product, brand_model, purchase_date, estimated_amount, currency,
  third_party_id, space_id, content_good_type_id, building_damage_category_id,
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
  const res = await fetch(`/api/inspection/evidences/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al borrar evidencia");
  }
  return res.json();
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

const REPORT_SELECT = `id, session_id, claim_id, report_url, generated_at, status, report_type, cancellation_reason_id, cancellation_notes`;

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
