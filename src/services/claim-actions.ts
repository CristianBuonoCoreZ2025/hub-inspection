import { fetchAll, fetchById, insertRow, updateRow, getSupabaseClient } from "@/lib/supabase/db";
import type { ClaimAction, ActionTemplate, ActionFeature } from "@/types";
import { logActionHistory } from "@/services/claim-action-history";
import { getClaimCoveragesByAction } from "@/services/claim-coverages";

// ═══════════════════════════════════════════════════════════════════
// Servicios para el Sistema de Acciones (Claim Actions)
// ═══════════════════════════════════════════════════════════════════

const CHARACTERISTIC_SELECT =
  "id, action_feature_id, name, local_name, screen, control, issue, review, approve, document_template, email_template, document_type, is_active, sort_order, screen_id";

const ACTION_FEATURE_SELECT =
  `id, name, has_specific_screen, has_control, has_issue, has_review, has_approve, is_active, sort_order, screen_id, created_at, updated_at, screen:gestion_screens!action_features_screen_id_fkey(id, code, name, description, icon, form_schema, is_dynamic), characteristics:characteristic!characteristic_action_feature_id_fkey(${CHARACTERISTIC_SELECT})`;

const ACTION_TEMPLATE_SELECT =
  `id, action_type_id, action_features_id, line_business_id, name, description, is_blocker, is_review_applicable, is_approval_applicable, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve, is_active, issuer_roles, default_issuer_role, default_reviewer_role, default_approver_role, code, is_dispatch_applicable, company_id, event_id, sort_order, created_at, updated_at, action_feature:action_features!action_template_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!action_template_action_type_id_fkey(id, category, code, name), claim_statuses:action_template_claim_status!action_template_claim_status_action_template_id_fkey(id, claim_status_id, is_active, claim_status:lookup_catalog!action_template_claim_status_claim_status_id_fkey(id, category, code, name))`;

const CLAIM_ACTION_SELECT =
  `id, claim_id, action_type_id, action_features_id, action_template_id, line_business_id, name, description, code, action_data, action_status_id, created_by, created_on, issued_by, issued_on, issuer_id, issue_rejected_by, issue_rejected_on, issuer_rejection_comment, reviewed_by, reviewed_on, reviewer_id, review_rejected_by, review_rejected_on, reviewer_rejection_comment, approved_by, approved_on, approver_id, approve_rejected_by, approve_rejected_on, approver_rejection_comment, dispatched_by, dispatched_on, dispatcher_id, dispatch_rejected_by, dispatch_rejected_on, dispatcher_rejection_comment, expected_date, is_blocker, is_active, is_automatic, origin, updated_on, updated_by, screen_snapshot, screen_snapshot_at, action_feature:action_features!claim_actions_action_features_id_fkey(${ACTION_FEATURE_SELECT}), action_type:lookup_catalog!claim_actions_action_type_id_fkey(id, category, code, name), action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, category, code, name), action_template:action_template(id, name, code, issuer_roles, reviewer_roles, approver_roles, days_to_issue, days_to_review, days_to_approve), issuer:profiles!claim_actions_issuer_id_fkey(id, full_name, email), reviewer:profiles!claim_actions_reviewer_id_fkey(id, full_name, email), approver:profiles!claim_actions_approver_id_fkey(id, full_name, email)`;

/** Obtiene el nombre completo de un perfil por ID (para logging de historial) */
export async function getProfileName(userId: string): Promise<string | null> {
  try {
    const profile = await fetchById<{ full_name: string }>("profiles", userId, "full_name");
    return profile?.full_name || null;
  } catch {
    return null;
  }
}

// ═══ Obtener plantillas disponibles según el estado del siniestro ═══

export interface TemplateMatchContext {
  claimStatusId: string;
  /** Si se omite (undefined), no se filtra por esta dimensión. Si es null, solo pasa tpl con line_business_id null. */
  businessLineId?: string | null;
  /** Si se omite (undefined), no se filtra por esta dimensión. Si es null, solo pasa tpl con event_id null. */
  eventId?: string | null;
  /** Si se omite (undefined), no se filtra por esta dimensión. Si es null, solo pasa tpl con company_id null. */
  insuranceCompanyId?: string | null;
}

/**
 * Obtiene las plantillas de gestión aplicables a un siniestro según su estado.
 *
 * Lógica de matching (de lo más particular a lo más general):
 * - Una plantilla tiene 3 dimensiones opcionales: evento, línea de negocio, compañía.
 * - "Abierta/libre" = null (sin restricción en esa dimensión).
 * - Una dimensión del contexto que sea `undefined` → no se filtra por ella
 *   (útil para el editor de workflows, que no tiene compañía).
 * - Una plantilla se ofrece si TODAS sus dimensiones restrictivas coinciden con el claim:
 *     • si tpl.event_id != null  → debe == ctx.eventId
 *     • si tpl.line_business_id != null → debe == ctx.businessLineId
 *     • si tpl.company_id != null → debe == ctx.insuranceCompanyId
 *   Las dimensiones null (abiertas) del template siempre pasan.
 * - Las plantillas con restricciones que NO cuadran con el claim se DESCARTAN.
 * - Orden: más específica primero (más dimensiones restrictivas = mayor prioridad).
 */
export async function getActionTemplatesByClaimStatus(ctx: TemplateMatchContext): Promise<ActionTemplate[]> {
  const { claimStatusId, businessLineId, eventId, insuranceCompanyId } = ctx;
  const supabase = getSupabaseClient();

  // 1. Obtener template_ids para este estado
  const { data: atcsRows, error: atcsError } = await supabase
    .from("action_template_claim_status")
    .select("action_template_id")
    .eq("claim_status_id", claimStatusId)
    .eq("is_active", true);

  if (atcsError) throw new Error(atcsError.message);
  const templateIds = ((atcsRows as { action_template_id: string }[]) || []).map(r => r.action_template_id).filter(Boolean);
  if (templateIds.length === 0) return [];

  // 2. Obtener TODOS los templates activos para este estado (sin filtrar por línea en BD)
  const { data, error } = await supabase
    .from("action_template")
    .select(ACTION_TEMPLATE_SELECT)
    .in("id", templateIds)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const rows = ((data as ActionTemplate[]) ?? []);

  // 3. Filtrar por matching de dimensiones.
  //    - Dimensión undefined en ctx → no se filtra (pasa todo).
  //    - Dimensión proporcionada (incluso null) → tpl.dimensión debe ser null OR == ctx.
  const matches = rows.filter((tpl) => {
    if (businessLineId !== undefined && tpl.line_business_id !== null && tpl.line_business_id !== businessLineId) return false;
    if (eventId !== undefined && tpl.event_id !== null && tpl.event_id !== eventId) return false;
    if (insuranceCompanyId !== undefined && tpl.company_id !== null && tpl.company_id !== insuranceCompanyId) return false;
    return true;
  });

  // 4. Ordenar por especificidad (más restricciones = más particular = primero)
  //    Peso: línea (4) > evento (2) > compañía (1) — la línea es la más discriminante.
  //    Empate: por sort_order y luego name.
  const specificity = (tpl: ActionTemplate): number => {
    let score = 0;
    if (tpl.line_business_id) score += 4;
    if (tpl.event_id) score += 2;
    if (tpl.company_id) score += 1;
    return score;
  };

  matches.sort((a, b) => {
    const sa = specificity(a);
    const sb = specificity(b);
    if (sa !== sb) return sb - sa; // mayor especificidad primero
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });

  // Filtrar characteristics activas
  return matches.map((tpl) => {
    if (tpl.action_feature?.characteristics) {
      tpl.action_feature.characteristics = tpl.action_feature.characteristics.filter((c) => c.is_active);
    }
    return tpl;
  });
}

// ═══ Obtener todas las plantillas (activas e inactivas para grilla de configuración) ═══

export async function getActionTemplates(includeInactive = false): Promise<ActionTemplate[]> {
  const options: Parameters<typeof fetchAll>[1] = {
    select: ACTION_TEMPLATE_SELECT,
    order: { column: "name", ascending: true },
  };
  if (!includeInactive) {
    options.eq = { is_active: true };
  }
  const rows = await fetchAll<ActionTemplate>("action_template", options);
  // Filtrar characteristics activas (el filtro original era where: { is_active: { _eq: true } })
  return rows.map((tpl) => {
    if (tpl.action_feature?.characteristics) {
      tpl.action_feature.characteristics = tpl.action_feature.characteristics.filter((c) => c.is_active);
    }
    return tpl;
  });
}

// ═══ Obtener todas las features activas ═══

export async function getActionFeatures(): Promise<ActionFeature[]> {
  const rows = await fetchAll<ActionFeature>("action_features", {
    select: ACTION_FEATURE_SELECT,
    eq: { is_active: true },
    order: { column: "name", ascending: true },
  });
  // Filtrar characteristics activas (el filtro original era where: { is_active: { _eq: true } })
  return rows.map((f) => {
    if (f.characteristics) {
      f.characteristics = f.characteristics.filter((c) => c.is_active);
    }
    return f;
  });
}

// ═══ Listar acciones de un siniestro ═══
// Por defecto excluye las rechazadas desde emisión (action_status.code = "rejected")
// use includeRejected=true para incluir las rechazadas

export async function getClaimActions(claimId: string, includeRejected = false): Promise<ClaimAction[]> {
  // Si includeRejected=true, traer también las inactivas (deshabilitadas) y rechazadas.
  // Si includeRejected=false, solo activas y no rechazadas.
  const options: Parameters<typeof fetchAll>[1] = {
    select: CLAIM_ACTION_SELECT,
    order: { column: "created_on", ascending: false },
  };
  if (includeRejected) {
    options.eq = { claim_id: claimId };
  } else {
    options.eq = { claim_id: claimId, is_active: true };
  }
  const all = await fetchAll<ClaimAction>("claim_actions", options);

  // Filtrar rechazadas desde emisión si no se piden explícitamente
  if (!includeRejected) {
    return all.filter((a) => a.action_status?.code !== "rejected");
  }
  return all;
}

// ═══ Validación de cadenas de gestión ═══
// Verifica si existe una gestión del siniestro con el código de template dado
// en un estado "cerrado" (issued, reviewed, approved, dispatched).
// "closed" significa que la gestión anterior completó su flujo de emisión/revisión/aprobación.

async function checkPrerequisiteGestion(claimId: string, templateCode: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  // 1. Obtener TODOS los template_ids con ese codigo (puede haber duplicados)
  const { data: templateRows, error: templateError } = await supabase
    .from("action_template")
    .select("id")
    .eq("code", templateCode);
  if (templateError) throw new Error(templateError.message);
  const templateIds = ((templateRows as { id: string }[]) || []).map(r => r.id);
  if (templateIds.length === 0) return false;

  // 2. Buscar claim_actions de esos templates (todas, para verificar si alguna está cerrada)
  const { data, error } = await supabase
    .from("claim_actions")
    .select("id, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code)")
    .eq("claim_id", claimId)
    .eq("is_active", true)
    .in("action_template_id", templateIds);
  if (error) throw new Error(error.message);

  const rows = (data as { action_status?: { code: string } }[]) || [];
  return rows.some(r => {
    const statusCode = r.action_status?.code;
    return ["issued", "reviewed", "approved", "dispatched"].includes(statusCode ?? "");
  });
}

// Verifica si existe al menos una gestión con el código de template dado (en cualquier estado activo)
async function checkGestionExists(claimId: string, templateCode: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  // 1. Obtener TODOS los template_ids con ese codigo (puede haber duplicados)
  const { data: templateRows, error: templateError } = await supabase
    .from("action_template")
    .select("id")
    .eq("code", templateCode);
  if (templateError) throw new Error(templateError.message);
  const templateIds = ((templateRows as { id: string }[]) || []).map(r => r.id);
  if (templateIds.length === 0) return false;

  // 2. Buscar claim_actions de esos templates
  const { data, error } = await supabase
    .from("claim_actions")
    .select("id")
    .eq("claim_id", claimId)
    .eq("is_active", true)
    .in("action_template_id", templateIds)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

// Verifica si existe una gestión PENDIENTE (status "todo") del mismo código de template.
// Solo bloquea la creación de una nueva si hay una activa en estado "todo".
// Las rechazadas (status "rejected") NO bloquean — se pueden recrear.
// Las cerradas (issued/reviewed/approved/dispatched) NO bloquean — ya terminaron.
// Retorna la acción pendiente encontrada (con su código) o null.
async function findPendingGestion(
  claimId: string,
  templateCode: string
): Promise<{ id: string; code: string } | null> {
  const supabase = getSupabaseClient();

  // 1. Obtener TODOS los template_ids con ese código
  const { data: templateRows, error: templateError } = await supabase
    .from("action_template")
    .select("id")
    .eq("code", templateCode);
  if (templateError) throw new Error(templateError.message);
  const templateIds = ((templateRows as { id: string }[]) || []).map(r => r.id);
  if (templateIds.length === 0) return null;

  // 2. Obtener el status_id de "todo"
  const { data: statusRow, error: statusError } = await supabase
    .from("lookup_catalog")
    .select("id")
    .eq("category", "action_status")
    .eq("code", "todo")
    .limit(1);
  if (statusError) throw new Error(statusError.message);
  const todoStatusId = (statusRow as { id: string }[] | null)?.[0]?.id;
  if (!todoStatusId) return null;

  // 3. Buscar claim_actions pendientes de esos templates
  const { data, error } = await supabase
    .from("claim_actions")
    .select("id, code")
    .eq("claim_id", claimId)
    .eq("is_active", true)
    .eq("action_status_id", todoStatusId)
    .in("action_template_id", templateIds)
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data as { id: string; code: string }[] | null)?.[0];
  return row ? { id: row.id, code: row.code } : null;
}

// Mapa de dependencias de cadena:
// Código de template → { código prerequisito, requiereCerrada, mensaje }
const CHAIN_DEPENDENCIES: Record<string, { prereqCode: string; requireClosed: boolean; message: string }> = {
  "RES": { prereqCode: "COB", requireClosed: true, message: "No se puede crear una Reserva sin un Ingreso de Coberturas cerrado." },
  "AJU": { prereqCode: "RES", requireClosed: true, message: "No se puede crear un Ajuste sin una Reserva cerrada." },
  "RTA": { prereqCode: "SOL", requireClosed: true, message: "No se puede crear una Recepción Total de Antecedentes sin una Solicitud de Antecedentes cerrada." },
};

// ═══ Crear una acción en un siniestro ═══

export async function createClaimAction(input: {
  claim_id: string;
  action_template_id?: string;
  action_features_id: string;
  action_type_id?: string;
  name: string;
  description?: string;
  code?: string;
  action_data?: Record<string, unknown>;
  created_by?: string;
  is_blocker?: boolean;
  line_business_id?: string;
  issuer_id?: string;
  reviewer_id?: string;
  approver_id?: string;
  expected_date?: string;
  is_automatic?: boolean;
}): Promise<ClaimAction> {
  // Obtener el status_id de "todo" (pendiente)
  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "action_status", code: "todo" },
    limit: 1,
  });
  const todoStatusId = statusRows[0]?.id;
  if (!todoStatusId) throw new Error("No se encontró el estado de acción 'todo'");

  // Si se pasó template, copiar datos de la plantilla
  let templateData: Record<string, unknown> = {};
  let issuerRoles: string[] = [];
  let reviewerRoles: string[] = [];
  let approverRoles: string[] = [];
  if (input.action_template_id) {
    const tpl = await fetchById<ActionTemplate>("action_template", input.action_template_id, ACTION_TEMPLATE_SELECT);
    if (tpl) {
      templateData = {
        action_type_id: tpl.action_type_id,
        line_business_id: tpl.line_business_id,
        is_blocker: tpl.is_blocker,
        code: tpl.code,
        description: tpl.description,
        default_issuer_role: tpl.default_issuer_role,
        default_reviewer_role: tpl.default_reviewer_role,
        default_approver_role: tpl.default_approver_role,
      };
      issuerRoles = tpl.issuer_roles || [];
      reviewerRoles = tpl.reviewer_roles || [];
      approverRoles = tpl.approver_roles || [];
    }
  }

  // ── Validar dependencias de cadena ──
  const templateCode = (templateData as Record<string, unknown>).code as string | null;
  if (templateCode && CHAIN_DEPENDENCIES[templateCode]) {
    const dep = CHAIN_DEPENDENCIES[templateCode];
    if (dep.requireClosed) {
      const hasPrereq = await checkPrerequisiteGestion(input.claim_id, dep.prereqCode);
      if (!hasPrereq) {
        throw new Error(dep.message);
      }
    } else {
      const hasPrereq = await checkGestionExists(input.claim_id, dep.prereqCode);
      if (!hasPrereq) {
        throw new Error(dep.message);
      }
    }
  }

  // ── Validar que no exista ya una gestión pendiente del mismo tipo ──
  // Solo puede haber una gestión activa en estado "todo" por código de template.
  // Las rechazadas no bloquean (se pueden recrear); las cerradas tampoco (ya terminaron).
  if (templateCode) {
    const pending = await findPendingGestion(input.claim_id, templateCode);
    if (pending) {
      throw new Error(
        `Ya existe una gestión "${input.name}" pendiente (${pending.code}) en este siniestro. ` +
        `Debe emitir, cerrar o finalizar la gestión existente antes de crear una nueva del mismo tipo.`
      );
    }
  }

  // ── Auto-asignación de responsables ──
  // Si no se pasó issuer_id explícito, asignar automáticamente:
  // 1. Leer el siniestro para obtener assigned_adjuster_id, inspector_id, assistant_id
  // 2. Mapear issuer_roles → usuarios del siniestro
  // 3. Priorizar el default_role si está configurado
  // 4. De los candidatos restantes, elegir el que tenga menos gestiones pendientes
  let autoIssuerId = input.issuer_id || null;
  let autoReviewerId = input.reviewer_id || null;
  let autoApproverId = input.approver_id || null;

  const defaultIssuerRole = (templateData as Record<string, unknown>).default_issuer_role as string | null || null;
  const defaultReviewerRole = (templateData as Record<string, unknown>).default_reviewer_role as string | null || null;
  const defaultApproverRole = (templateData as Record<string, unknown>).default_approver_role as string | null || null;

  if (!autoIssuerId || !autoReviewerId || !autoApproverId) {
    const autoAssigned = await autoAssignResponsibles(
      input.claim_id,
      todoStatusId,
      { issuer: issuerRoles, reviewer: reviewerRoles, approver: approverRoles },
      { issuer: autoIssuerId, reviewer: autoReviewerId, approver: autoApproverId },
      { issuer: defaultIssuerRole, reviewer: defaultReviewerRole, approver: defaultApproverRole }
    );
    autoIssuerId = autoAssigned.issuer;
    autoReviewerId = autoAssigned.reviewer;
    autoApproverId = autoAssigned.approver;
  }

  // ── Snapshot del form_schema del gestion_screen asociado al action_feature ──
  // Congela la estructura de la pantalla al momento de crear la acción, para
  // que la gestión siga funcionando aunque alguien después edite la pantalla.
  let screenSnapshot: Record<string, unknown> | null = null;
  try {
    const feature = await fetchById<{ screen_id: string | null; screen?: { form_schema: Record<string, unknown> | null } | null }>(
      "action_features",
      input.action_features_id,
      "id, screen_id, screen:gestion_screens!action_features_screen_id_fkey(id, code, name, form_schema)"
    );
    if (feature?.screen?.form_schema) {
      screenSnapshot = feature.screen.form_schema;
    }
  } catch (err) {
    // Si falla la obtención del snapshot, no bloqueamos la creación de la acción.
    console.warn("[createClaimAction] No se pudo obtener screen_snapshot:", err);
  }

  const insertData = {
    claim_id: input.claim_id,
    action_template_id: input.action_template_id || null,
    action_features_id: input.action_features_id,
    action_type_id: input.action_type_id || templateData.action_type_id || null,
    line_business_id: input.line_business_id || templateData.line_business_id || null,
    name: input.name,
    description: input.description || templateData.description || null,
    code: null, // Se genera automáticamente via trigger set_claim_action_code()
    action_data: input.action_data || {},
    action_status_id: todoStatusId,
    created_by: input.created_by || null,
    is_blocker: input.is_blocker ?? templateData.is_blocker ?? false,
    issuer_id: autoIssuerId,
    reviewer_id: autoReviewerId,
    approver_id: autoApproverId,
    expected_date: input.expected_date || null,
    is_automatic: input.is_automatic ?? false,
    screen_snapshot: screenSnapshot,
    screen_snapshot_at: screenSnapshot ? new Date().toISOString() : null,
  };

  const result = await insertRow<ClaimAction>("claim_actions", insertData, CLAIM_ACTION_SELECT);

  // ── Registrar creación en historial ──
  await logActionHistory({
    claim_action_id: result.id,
    event_type: "created",
    to_status_code: "todo",
    performed_by: input.created_by || null,
    performed_by_name: input.created_by ? await getProfileName(input.created_by) : null,
  });

  return result;
}

/**
 * Auto-asigna responsables a una claim_action basándose en:
 * 1. Los roles configurados en el template (issuer_roles, reviewer_roles, approver_roles)
 * 2. Los usuarios asignados al siniestro (liquidador, inspector, asistente)
 * 3. El usuario con menos gestiones pendientes entre los candidatos
 *
 * Mapeo roles → campo del siniestro:
 *   "adjuster"   → claim.assigned_adjuster_id
 *   "inspector"  → claim.inspector_id
 *   "assistant"  → claim.assistant_id
 *   "internal"   → claim.assigned_adjuster_id (fallback)
 */
async function autoAssignResponsibles(
  claimId: string,
  todoStatusId: string,
  roles: { issuer: string[]; reviewer: string[]; approver: string[] },
  existing: { issuer: string | null; reviewer: string | null; approver: string | null },
  defaults: { issuer: string | null; reviewer: string | null; approver: string | null }
): Promise<{ issuer: string | null; reviewer: string | null; approver: string | null }> {
  // Si ya están todos asignados, no hacer nada
  if (existing.issuer && existing.reviewer && existing.approver) {
    return existing;
  }

  // 1. Leer el siniestro para obtener los usuarios asignados
  const claim = await fetchById<{
    assigned_adjuster_id: string | null;
    inspector_id: string | null;
    assistant_id: string | null;
  }>("claims", claimId, "assigned_adjuster_id, inspector_id, assistant_id");

  if (!claim) return existing;

  // Mapear rol → profile_id del siniestro
  const roleToUser: Record<string, string | null> = {
    adjuster: claim.assigned_adjuster_id,
    inspector: claim.inspector_id,
    assistant: claim.assistant_id,
    internal: claim.assigned_adjuster_id, // fallback
  };

  // 2. Para cada nivel, si no está asignado, buscar candidatos
  async function assignLevel(
    levelRoles: string[],
    current: string | null,
    defaultRole: string | null
  ): Promise<string | null> {
    if (current) return current;
    if (levelRoles.length === 0) return null;

    // 2a. Si hay un rol por defecto y ese rol está en levelRoles, usar esa persona directamente
    if (defaultRole && levelRoles.includes(defaultRole)) {
      const defaultUser = roleToUser[defaultRole];
      if (defaultUser) return defaultUser;
    }

    // 2b. Si no hay default o la persona del default no existe, buscar entre todos los candidatos
    const candidateIds = levelRoles
      .map((r) => roleToUser[r])
      .filter((id): id is string => !!id);

    if (candidateIds.length === 0) return null;
    if (candidateIds.length === 1) return candidateIds[0];

    // 3. De los candidatos, elegir el que tenga menos gestiones pendientes
    const supabase = getSupabaseClient();
    const orFilter = candidateIds
      .map((id) => `issuer_id.eq.${id},reviewer_id.eq.${id},approver_id.eq.${id}`)
      .join(",");
    const { data: countData, error } = await supabase
      .from("claim_actions")
      .select("issuer_id, reviewer_id, approver_id")
      .eq("action_status_id", todoStatusId)
      .eq("is_active", true)
      .or(orFilter);
    if (error) throw new Error(error.message);

    const actions = (countData as { issuer_id: string | null; reviewer_id: string | null; approver_id: string | null }[]) ?? [];

    // Contar gestiones pendientes por usuario
    const counts: Record<string, number> = {};
    for (const id of candidateIds) counts[id] = 0;
    for (const action of actions) {
      if (action.issuer_id && counts[action.issuer_id] !== undefined) counts[action.issuer_id]++;
      if (action.reviewer_id && counts[action.reviewer_id] !== undefined) counts[action.reviewer_id]++;
      if (action.approver_id && counts[action.approver_id] !== undefined) counts[action.approver_id]++;
    }

    // Elegir el de menos gestiones
    return candidateIds.reduce((min, id) => (counts[id] < counts[min] ? id : min), candidateIds[0]);
  }

  return {
    issuer: await assignLevel(roles.issuer, existing.issuer, defaults.issuer),
    reviewer: await assignLevel(roles.reviewer, existing.reviewer, defaults.reviewer),
    approver: await assignLevel(roles.approver, existing.approver, defaults.approver),
  };
}

// ═══ Emitir una acción (cambiar estado a "issued") ═══

export async function issueClaimAction(actionId: string, userId?: string, actionData?: Record<string, unknown>): Promise<ClaimAction> {
  if (!userId) {
    throw new Error("Debe iniciar sesión para completar esta acción.");
  }

  // ── Validar que el COB tenga al menos 1 cobertura ──
  const action = await fetchById<ClaimAction>("claim_actions", actionId, "id, action_template_id, claim_id, action_data, screen_snapshot, action_template:action_template!claim_actions_action_template_id_fkey(code)");
  if (action?.action_template?.code === "COB") {
    const coverages = await getClaimCoveragesByAction(action.claim_id!, actionId);
    if (!coverages || coverages.length === 0) {
      throw new Error("Debe seleccionar al menos una cobertura antes de emitir el Ingreso de Coberturas.");
    }
  }

  // ── Validar campos obligatorios (genérico, aplica a TODAS las gestiones) ──
  // Usa los campos marcados como required: true (o con requiredRule) en el
  // screen_snapshot de la gestión. Respeta visibilityRule y requiredRule.
  if (action?.screen_snapshot) {
    const data = actionData || action.action_data || {};
    const errors: string[] = [];

    type SnapshotField = {
      id: string;
      type: string;
      category: string;
      required?: boolean;
      label?: string;
      visibilityRule?: { field: string; operator: "equals" | "not_equals" | "in" | "not_in"; value: string | string[] };
      requiredRule?: { field: string; operator: "equals" | "not_equals" | "in" | "not_in"; value: string | string[] };
    };
    const snapshotFields = (action.screen_snapshot as { fields?: SnapshotField[] } | null)?.fields || [];
    const ownFields = snapshotFields.filter((f) => f.category === "own");

    const evalRule = (rule: { field: string; operator: string; value: string | string[] }, values: Record<string, unknown>): boolean => {
      const ctrlValue = String(values[rule.field] ?? "").toLowerCase();
      const ruleValue = rule.value;
      switch (rule.operator) {
        case "equals": return ctrlValue === String(ruleValue).toLowerCase();
        case "not_equals": return ctrlValue !== String(ruleValue).toLowerCase();
        case "in": return Array.isArray(ruleValue) && ruleValue.some(v => ctrlValue === String(v).toLowerCase());
        case "not_in": return Array.isArray(ruleValue) && !ruleValue.some(v => ctrlValue === String(v).toLowerCase());
        default: return true;
      }
    };

    for (const f of ownFields) {
      // Si el campo no es visible según visibilityRule, no se valida
      if (f.visibilityRule && !evalRule(f.visibilityRule, data)) continue;
      // Determinar si es obligatorio (requiredRule tiene prioridad sobre required)
      const isRequired = f.requiredRule ? evalRule(f.requiredRule, data) : !!f.required;
      if (!isRequired) continue;

      const v = data[f.id] ?? data[f.type];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        errors.push(f.label || f.type);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Faltan campos obligatorios: ${errors.join(", ")}.`);
    }
  }

  const statusRows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "action_status", code: "issued" },
    limit: 1,
  });
  const issuedStatusId = statusRows[0]?.id;
  if (!issuedStatusId) throw new Error("No se encontró el estado de acción 'issued'");

  // El usuario que emite pasa a ser el issuer_id (siempre, para todas las gestiones)
  // Validar que el userId exista en profiles (FK constraint)
  let validUserId: string | null = userId || null;
  if (userId) {
    const profile = await fetchById<{ id: string }>("profiles", userId, "id");
    if (!profile) {
      // El usuario de auth no tiene profile — usar issued_by sin issuer_id
      validUserId = null;
    }
  }

  const now = new Date();
  const issuedOnIso = now.toISOString();
  const issuedOnDate = issuedOnIso.slice(0, 10); // yyyy-MM-dd

  const setFields: Record<string, unknown> = {
    action_status_id: issuedStatusId,
    issued_on: issuedOnIso,
    issued_by: userId,
    updated_on: issuedOnIso,
    updated_by: userId,
  };
  // Solo asignar issuer_id si el usuario existe en profiles
  if (validUserId) {
    setFields.issuer_id = validUserId;
  }
  if (actionData) {
    // Auto-completar inf_fecha_entrega con la fecha de emisión real
    setFields.action_data = { ...actionData, inf_fecha_entrega: issuedOnDate };
  }

  const result = await updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);

  // ── Registrar en historial ──
  await logActionHistory({
    claim_action_id: actionId,
    event_type: "issued",
    from_status_code: "todo",
    to_status_code: "issued",
    performed_by: userId || null,
    performed_by_name: userId ? await getProfileName(userId) : null,
    level: "issue",
  });

  // ── Si es CIN (Coordinación de Inspección), ramificar según coord_result ──
  // coordinada → crea inspection_session
  // fallida    → crea una nueva gestión CIN para re-coordinar (con fecha tentativa)
  // desistida  → no hace nada (rompe el flujo)
  if (action?.action_template?.code === "CIN") {
    const data = actionData || action.action_data || {};
    const coordResult = String(data.coord_result || "coordinada").toLowerCase(); // default para gestiones viejas

    if (coordResult === "coordinada") {
      const fechaStr = String(data.coord_fecha || "");
      if (fechaStr) {
        try {
          const scheduledAt = new Date(fechaStr).toISOString();
          const { createInspectionSession } = await import("@/services/inspections");
          await createInspectionSession(action.claim_id!, {
            inspectionType: String(data.coord_inspection_type || "onsite") as "onsite" | "remote",
            scheduledAt,
            inspectorId: String(data.coord_inspector || "") || undefined,
            schedulingNotes: [
              data.coord_ubicacion && `Aclaración dirección: ${data.coord_ubicacion}`,
              data.coord_contacto && `Otros contactos: ${data.coord_contacto}`,
              data.coord_comentarios && `Comentarios: ${data.coord_comentarios}`,
            ].filter(Boolean).join("\n\n") || undefined,
            actionTemplateId: action.action_template_id || undefined,
          });
        } catch (err) {
          console.warn("[issueClaimAction] No se pudo crear inspection_session:", err);
        }
      }
    } else if (coordResult === "fallida") {
      // Crear una nueva gestión CIN para re-coordinar
      try {
        const fechaRecoord = String(data.coord_fecha_recoord || "");
        const expectedDate = fechaRecoord ? new Date(fechaRecoord).toISOString() : undefined;
        // Obtener action_features_id del template original
        const tpl = await fetchById<{ action_features_id: string }>(
          "action_template",
          action.action_template_id || "",
          "action_features_id"
        );
        if (tpl?.action_features_id) {
          await createClaimAction({
            claim_id: action.claim_id!,
            action_template_id: action.action_template_id || undefined,
            action_features_id: tpl.action_features_id,
            name: "Coordinación de Inspección (re-coordinación)",
            description: `Re-coordinación generada por intento fallido. Motivo: ${data.coord_motivo || "no especificado"}`,
            expected_date: expectedDate,
          });
        }
      } catch (err) {
        console.warn("[issueClaimAction] No se pudo crear re-coordinación CIN:", err);
      }
    }
    // desistida: no hace nada
  }

  // ── Generar y subir documento desde template (fire-and-forget) ──
  // Si la gestión tiene un document_template asociado, se renderiza el .docx
  // con los datos del siniestro y se sube a R2 con el path del plan:
  // claims/{L}/actions/{code}/{code}.docx
  // No bloquea la emisión — si falla, el documento se puede generar después.
  if (action?.action_template_id) {
    fetch(`/api/claims/actions/${actionId}/generate-document`, {
      method: "POST",
    }).catch((e) => {
      // Fire-and-forget: solo log, no bloquea
      console.warn(`[issueClaimAction] generate-document falló para ${actionId}:`, e);
    });
  }

  return result;
}
/**
 * Valida que el usuario actual sea el responsable del nivel correspondiente.
 *
 * Reglas:
 * - Para "issuer": no valida (cualquiera puede emitir, pasa a ser el emisor)
 * - Para "reviewer"/"approver": valida que el usuario sea el responsable asignado
 * - Si no hay userId → error "debe iniciar sesión"
 */
async function validateResponsible(
  actionId: string,
  level: "issuer" | "reviewer" | "approver",
  userId?: string
): Promise<void> {
  if (!userId) {
    throw new Error("Debe iniciar sesión para completar esta acción.");
  }

  // El nivel "issuer" no valida responsable: cualquiera que emita pasa a ser el emisor
  if (level === "issuer") return;

  const fieldMap = {
    issuer: "issuer_id",
    reviewer: "reviewer_id",
    approver: "approver_id",
  } as const;

  const action = await fetchById<Record<string, string | null>>("claim_actions", actionId, fieldMap[level]);
  if (!action) throw new Error("La gestión no existe.");

  const responsibleId = action[fieldMap[level]];
  if (!responsibleId) {
    throw new Error(`No hay responsable asignado para ${level === "reviewer" ? "revisión" : "aprobación"}. Asigne un responsable primero.`);
  }

  if (responsibleId !== userId) {
    throw new Error(`Solo el responsable de ${level === "reviewer" ? "revisión" : "aprobación"} puede completar esta acción. Si usted es el responsable, asígnese primero en el combo de responsables.`);
  }
}

// ═══ Actualizar datos de una acción ═══

export async function updateClaimAction(actionId: string, updates: Record<string, unknown>, userId?: string): Promise<ClaimAction> {
  const setFields = {
    ...updates,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };

  return updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);
}

// ═══ Hook helper: resolver código de estado de acción desde ID ═══

export async function getActionStatusByCode(code: string): Promise<string | null> {
  const rows = await fetchAll<{ id: string }>("lookup_catalog", {
    select: "id",
    eq: { category: "action_status", code },
    limit: 1,
  });
  return rows[0]?.id ?? null;
}

// ═══ Obtener una acción por ID (con relaciones completas) ═══

export async function getClaimActionById(actionId: string): Promise<ClaimAction | null> {
  return fetchById<ClaimAction>("claim_actions", actionId, CLAIM_ACTION_SELECT);
}

// ═══ Revisar una acción (cambiar estado a "reviewed") ═══

export async function reviewClaimAction(actionId: string, userId?: string, comment?: string): Promise<ClaimAction> {
  // ── Validar que el usuario sea el responsable de revisión ──
  await validateResponsible(actionId, "reviewer", userId);

  const statusId = await getActionStatusByCode("reviewed");
  if (!statusId) throw new Error("No se encontró el estado de acción 'reviewed'");

  const setFields: Record<string, unknown> = {
    action_status_id: statusId,
    reviewed_on: new Date().toISOString(),
    reviewed_by: userId || null,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };
  if (comment) setFields.reviewer_rejection_comment = null;

  const result = await updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);

  // ── Registrar en historial ──
  await logActionHistory({
    claim_action_id: actionId,
    event_type: "reviewed",
    from_status_code: "issued",
    to_status_code: "reviewed",
    performed_by: userId || null,
    performed_by_name: userId ? await getProfileName(userId) : null,
    level: "review",
  });

  return result;
}

// ═══ Aprobar una acción (cambiar estado a "approved") ═══

export async function approveClaimAction(actionId: string, userId?: string): Promise<ClaimAction> {
  // ── Validar que el usuario sea el responsable de aprobación ──
  await validateResponsible(actionId, "approver", userId);

  const statusId = await getActionStatusByCode("approved");
  if (!statusId) throw new Error("No se encontró el estado de acción 'approved'");

  const setFields: Record<string, unknown> = {
    action_status_id: statusId,
    approved_on: new Date().toISOString(),
    approved_by: userId || null,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };

  const result = await updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);

  // ── Registrar en historial ──
  await logActionHistory({
    claim_action_id: actionId,
    event_type: "approved",
    from_status_code: "reviewed",
    to_status_code: "approved",
    performed_by: userId || null,
    performed_by_name: userId ? await getProfileName(userId) : null,
    level: "approve",
  });

  return result;
}

// ═══ Despachar una acción (cambiar estado a "dispatched") ═══

export async function dispatchClaimAction(actionId: string, userId?: string): Promise<ClaimAction> {
  const statusId = await getActionStatusByCode("dispatched");
  if (!statusId) throw new Error("No se encontró el estado de acción 'dispatched'");

  const setFields: Record<string, unknown> = {
    action_status_id: statusId,
    dispatched_on: new Date().toISOString(),
    dispatched_by: userId || null,
    updated_on: new Date().toISOString(),
    updated_by: userId || null,
  };

  return updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);
}

// ═══ Rechazar una acción ═══
// Reglas:
//   - Rechazar emisión → estado "rejected" (acción rechazada permanentemente)
//   - Rechazar revisión → vuelve a "todo" (emisión)
//   - Rechazar aprobación → vuelve a "issued" (revisión)
//   - Rechazar despacho → vuelve a "approved"

export async function rejectClaimAction(
  actionId: string,
  stage: "issue" | "review" | "approve" | "dispatch",
  userId?: string,
  comment?: string
): Promise<ClaimAction> {
  const now = new Date().toISOString();
  const setFields: Record<string, unknown> = {
    updated_on: now,
    updated_by: userId || null,
  };

  if (stage === "issue") {
    // Rechazar emisión → acción queda rechazada
    const statusId = await getActionStatusByCode("rejected");
    if (!statusId) throw new Error("No se encontró el estado de acción 'rejected'");
    setFields.action_status_id = statusId;
    setFields.issued_on = null;
    setFields.issued_by = null;
    if (comment) setFields.issuer_rejection_comment = comment;
  } else if (stage === "review") {
    // Rechazar revisión → vuelve a emisión (todo)
    const statusId = await getActionStatusByCode("todo");
    if (!statusId) throw new Error("No se encontró el estado de acción 'todo'");
    setFields.action_status_id = statusId;
    setFields.reviewed_on = null;
    setFields.reviewed_by = null;
    setFields.review_rejected_on = now;
    setFields.review_rejected_by = userId || null;
    if (comment) setFields.reviewer_rejection_comment = comment;
  } else if (stage === "approve") {
    // Rechazar aprobación → vuelve a revisión (issued)
    const statusId = await getActionStatusByCode("issued");
    if (!statusId) throw new Error("No se encontró el estado de acción 'issued'");
    setFields.action_status_id = statusId;
    setFields.approved_on = null;
    setFields.approved_by = null;
    setFields.approve_rejected_on = now;
    setFields.approve_rejected_by = userId || null;
    if (comment) setFields.approver_rejection_comment = comment;
  } else if (stage === "dispatch") {
    // Rechazar despacho → vuelve a aprobación (approved)
    const statusId = await getActionStatusByCode("approved");
    if (!statusId) throw new Error("No se encontró el estado de acción 'approved'");
    setFields.action_status_id = statusId;
    setFields.dispatched_on = null;
    setFields.dispatched_by = null;
    setFields.dispatch_rejected_on = now;
    setFields.dispatch_rejected_by = userId || null;
    if (comment) setFields.dispatcher_rejection_comment = comment;
  }

  const result = await updateRow<ClaimAction>("claim_actions", actionId, setFields, CLAIM_ACTION_SELECT);

  // ── Registrar en historial ──
  const eventTypeMap: Record<string, string> = {
    issue: "rejected_issue",
    review: "rejected_review",
    approve: "rejected_approve",
    dispatch: "rejected_dispatch",
  };
  const fromToMap: Record<string, { from: string; to: string }> = {
    issue: { from: "todo", to: "rejected" },
    review: { from: "issued", to: "todo" },
    approve: { from: "reviewed", to: "issued" },
    dispatch: { from: "approved", to: "approved" },
  };
  const ft = fromToMap[stage];
  await logActionHistory({
    claim_action_id: actionId,
    event_type: eventTypeMap[stage] || "rejected_review",
    from_status_code: ft.from,
    to_status_code: ft.to,
    performed_by: userId || null,
    performed_by_name: userId ? await getProfileName(userId) : null,
    level: stage,
    comment: comment || null,
  });

  return result;
}

// ═══ Rechazar (eliminar) una acción pendiente ═══
// Reglas:
//   - Solo gestiones manuales (is_automatic = false) se pueden rechazar
//   - Solo si están pendientes (action_status.code = "todo")
//   - Marca como rechazada desde emisión (action_status = "rejected")
//   - La gestión queda oculta del listado por defecto (switch para verla)

export async function deleteClaimAction(actionId: string, userId?: string, comment?: string): Promise<void> {
  // 1. Obtener la acción con su estado
  const action = await fetchById<{
    id: string;
    is_automatic: boolean;
    is_active: boolean;
    action_status: { code: string } | null;
  }>("claim_actions", actionId, "id, is_automatic, is_active, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code)");

  if (!action) {
    throw new Error("La gestión no existe");
  }

  // 2. Validar reglas de negocio
  if (action.is_automatic) {
    throw new Error("Las gestiones automáticas no se pueden rechazar");
  }
  const statusCode = action.action_status?.code;
  if (statusCode && statusCode !== "todo") {
    throw new Error("Solo se pueden rechazar gestiones pendientes");
  }

  // 3. Rechazar desde emisión (no soft delete)
  await rejectClaimAction(actionId, "issue", userId, comment || "Gestión rechazada desde el listado");
}

// ═══ Obtener usuarios que pueden ser responsables según los roles configurados ═══

export async function getUsersByRoles(roles: string[]): Promise<{ id: string; full_name: string; email: string; role: string }[]> {
  if (roles.length === 0) return [];
  return fetchAll<{ id: string; full_name: string; email: string; role: string }>("profiles", {
    select: "id, full_name, email, role",
    in: { role: roles },
    eq: { is_active: true },
    order: { column: "full_name", ascending: true },
  });
}

// ═══ Actualizar responsable de un nivel de la acción ═══

export async function updateActionResponsible(
  actionId: string,
  level: "issuer" | "reviewer" | "approver",
  userId: string | null
): Promise<ClaimAction> {
  const fieldMap: Record<typeof level, string> = {
    issuer: "issuer_id",
    reviewer: "reviewer_id",
    approver: "approver_id",
  };

  // Obtener el responsable anterior para el historial
  const prevAction = await fetchById<Record<string, string | null>>("claim_actions", actionId, fieldMap[level]);
  const prevResponsible = prevAction?.[fieldMap[level]] || null;
  const prevName = prevResponsible ? await getProfileName(prevResponsible) : null;
  const newName = userId ? await getProfileName(userId) : null;

  const result = await updateClaimAction(actionId, { [fieldMap[level]]: userId });

  // ── Registrar en historial ──
  const eventTypeMap = {
    issuer: "reassigned_issuer",
    reviewer: "reassigned_reviewer",
    approver: "reassigned_approver",
  } as const;
  await logActionHistory({
    claim_action_id: actionId,
    event_type: eventTypeMap[level],
    performed_by: userId || null,
    performed_by_name: newName,
    level,
    previous_responsible: prevResponsible,
    previous_responsible_name: prevName,
    new_responsible: userId || null,
    new_responsible_name: newName,
  });

  return result;
}

