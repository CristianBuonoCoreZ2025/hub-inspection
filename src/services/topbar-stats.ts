import { getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para la barra superior — 2 agrupaciones:
//
// 1. SINIESTROS: claims no cerrados por rol del usuario
//    - Liquidaciones: soy liquidador (adjuster)
//    - Inspecciones:  soy inspector
//    - Despachos:     soy despachador (dispatcher)
//    - Auditoría:     soy auditor
//
// 2. GESTIONES: claim_actions por rol + estado actual
//    - En curso:   soy emisor, status=todo, no alerta/atraso
//    - Revisiones: soy revisor, status=issued, no alerta/atraso
//    - Aprobación: soy aprobador, status=reviewed, no alerta/atraso
//    - En alarma:  soy responsable actual, en alerta (≤3 dias)
//    - Atrasadas:  soy responsable actual, vencida
// ═══════════════════════════════════════════════════════════════

export interface TopbarStats {
  // Siniestros (claims no cerrados)
  liquidations: number;
  inspections: number;
  dispatches: number;
  audits: number;
  // Gestiones (claim_actions en flujo)
  inProgress: number;
  reviews: number;
  approvals: number;
  alert: number;
  overdue: number;
}

const EMPTY: TopbarStats = {
  liquidations: 0,
  inspections: 0,
  dispatches: 0,
  audits: 0,
  inProgress: 0,
  reviews: 0,
  approvals: 0,
  alert: 0,
  overdue: 0,
};

export async function getTopbarStats(
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined
): Promise<TopbarStats> {
  if (!profile) return EMPTY;

  const supabase = getSupabaseClient();
  const pid = profile.id;

  // ── Helper: obtener status_id por código ──
  async function getStatusId(category: string, code: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("lookup_catalog")
      .select("id")
      .eq("category", category)
      .eq("code", code)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  }

  try {
    const closedStatusId = await getStatusId("claim_status", "closed");

    // ════════════════════════════════════════════════════════════
    // 1. SINIESTROS — claims no cerrados por rol
    // ════════════════════════════════════════════════════════════
    let liquidations = 0;
    let inspections = 0;
    let dispatches = 0;
    let audits = 0;

    // Base query: claims no cerrados, no disabled
    function buildClaimsQuery() {
      let q = supabase
        .from("claims")
        .select("id, assigned_adjuster_id, adjuster_id, inspector_id, dispatcher_id, auditor_id, assistant_id, status_id, disabled, insurance_company_id")
        .eq("disabled", false);
      if (closedStatusId) {
        q = q.neq("status_id", closedStatusId);
      }
      return q;
    }

    if (profile.role === "client_operator" && profile.company_id) {
      // client_operator: claims de su compañía no cerrados
      const { count } = await buildClaimsQuery().eq("insurance_company_id", profile.company_id!);
      // Para client_operator mostramos total en liquidations
      liquidations = count ?? 0;
    } else {
      // Todos los demás roles (incluido internal): filtrar por asignación directa
      const { data: myClaims, error: claimsError } = await buildClaimsQuery()
        .or(`assigned_adjuster_id.eq.${pid},adjuster_id.eq.${pid},inspector_id.eq.${pid},dispatcher_id.eq.${pid},auditor_id.eq.${pid},assistant_id.eq.${pid}`);

      if (!claimsError && myClaims) {
        for (const c of myClaims as Array<{
          id: string;
          assigned_adjuster_id: string | null;
          adjuster_id: string | null;
          inspector_id: string | null;
          dispatcher_id: string | null;
          auditor_id: string | null;
          assistant_id: string | null;
        }>) {
          if (c.assigned_adjuster_id === pid || c.adjuster_id === pid) liquidations++;
          if (c.inspector_id === pid) inspections++;
          if (c.dispatcher_id === pid) dispatches++;
          if (c.auditor_id === pid) audits++;
        }
      }
    }

    // ════════════════════════════════════════════════════════════
    // 2. GESTIONES — claim_actions por rol + estado
    // ════════════════════════════════════════════════════════════
    let inProgress = 0;
    let reviews = 0;
    let approvals = 0;
    let alert = 0;
    let overdue = 0;

    // Query base: claim_actions activas
    let actionsQuery = supabase
      .from("claim_actions")
      .select(
        "id, issuer_id, reviewer_id, approver_id, dispatcher_id, expected_date, action_status_id, is_active, action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, code)"
      )
      .eq("is_active", true);

    // Filtro por rol (igual que antes)
    if (profile.role === "client_operator" && profile.company_id) {
      actionsQuery = supabase
        .from("claim_actions")
        .select(
          "id, issuer_id, reviewer_id, approver_id, dispatcher_id, expected_date, action_status_id, is_active, action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, code), claim:claims!inner(insurance_company_id)"
        )
        .eq("is_active", true)
        .eq("claim.insurance_company_id", profile.company_id!);
    } else {
      // adjuster, internal, inspector, assistant — filtrar por asignación
      if (profile.role === "adjuster" || profile.role === "internal") {
        actionsQuery = actionsQuery.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid},approver_id.eq.${pid},dispatcher_id.eq.${pid}`);
      } else if (profile.role === "inspector") {
        actionsQuery = actionsQuery.eq("issuer_id", pid);
      } else if (profile.role === "assistant") {
        actionsQuery = actionsQuery.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid}`);
      }
    }

    const { data: actions, error: actionsError } = await actionsQuery;

    if (!actionsError && actions) {
      const nowMs = Date.now();

      for (const action of actions as Array<{
        id: string;
        issuer_id: string | null;
        reviewer_id: string | null;
        approver_id: string | null;
        dispatcher_id: string | null;
        expected_date: string | null;
        action_status_id: string | null;
        action_status: { id: string; code: string } | null;
      }>) {
        const statusCode = action.action_status?.code ?? null;
        const expectedMs = action.expected_date ? new Date(action.expected_date).getTime() : null;
        const daysUntilDue = expectedMs !== null ? (expectedMs - nowMs) / 86400000 : null;
        const isAlert = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
        const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

        // Determinar si el usuario es el responsable actual
        // status=todo → issuer, status=issued → reviewer, status=reviewed → approver
        const isCurrentResponsible =
          (statusCode === "todo" && action.issuer_id === pid) ||
          (statusCode === "issued" && action.reviewer_id === pid) ||
          (statusCode === "reviewed" && action.approver_id === pid);

        // En alarma / Atrasadas: soy el responsable actual
        if (isCurrentResponsible && isOverdue) {
          overdue++;
          continue; // no contar también en otro grupo
        }
        if (isCurrentResponsible && isAlert) {
          alert++;
          continue;
        }

        // En curso: soy emisor, status=todo, no alerta/atraso
        if (statusCode === "todo" && action.issuer_id === pid && !isAlert && !isOverdue) {
          inProgress++;
        }

        // Revisiones: soy revisor, status=issued, no alerta/atraso
        if (statusCode === "issued" && action.reviewer_id === pid && !isAlert && !isOverdue) {
          reviews++;
        }

        // Aprobación: soy aprobador, status=reviewed, no alerta/atraso
        if (statusCode === "reviewed" && action.approver_id === pid && !isAlert && !isOverdue) {
          approvals++;
        }
      }
    }

    return {
      liquidations,
      inspections,
      dispatches,
      audits,
      inProgress,
      reviews,
      approvals,
      alert,
      overdue,
    };
  } catch {
    return EMPTY;
  }
}
