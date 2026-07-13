import { getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para la barra superior — conteos rápidos por usuario
// ═══════════════════════════════════════════════════════════════

export interface TopbarStats {
  /** Inspecciones asignadas y activas (scheduled + active) */
  inspectionsActive: number;
  /** Liquidaciones asignadas y activas (claims en adjustment) */
  liquidationsActive: number;
  /** Gestiones pendientes de revisión */
  reviewsPending: number;
  /** Gestiones pendientes de despacho */
  dispatchesPending: number;
  /** Total de gestiones asignadas al usuario */
  gestionsAssigned: number;
  /** Gestiones en alerta (dentro del período de alerta pero no vencidas) */
  gestionsAlert: number;
  /** Gestiones vencidas (past expected_date, no completadas) */
  gestionsOverdue: number;
}

const EMPTY: TopbarStats = {
  inspectionsActive: 0,
  liquidationsActive: 0,
  reviewsPending: 0,
  dispatchesPending: 0,
  gestionsAssigned: 0,
  gestionsAlert: 0,
  gestionsOverdue: 0,
};

/**
 * Obtiene todos los conteos para la barra superior en una sola pasada.
 * Filtra según el rol del usuario:
 * - internal: ve todo (globales)
 * - adjuster: claims donde es assigned_adjuster / adjuster / auditor / dispatcher
 * - inspector: claims donde es inspector
 * - assistant: claims donde es assistant
 * - client_operator: claims de su compañía
 */
export async function getTopbarStats(
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined
): Promise<TopbarStats> {
  if (!profile) return EMPTY;

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const pid = profile.id;

  // ── Construir filtro de claims según el rol ──
  let claimFilter: Record<string, string> | null = null;
  let useCompanyFilter = false;

  if (profile.role === "internal") {
    // Ve todo — sin filtro
  } else if (profile.role === "client_operator") {
    if (!profile.company_id) return EMPTY;
    useCompanyFilter = true;
  } else {
    // adjuster, inspector, assistant — filtrar por asignación
    claimFilter = {};
  }

  // ── Helper: obtener claim_ids del usuario ──
  async function getMyClaimIds(): Promise<string[]> {
    if (profile!.role === "internal") return [];
    if (useCompanyFilter) return [];

    let query = supabase.from("claims").select("id");
    if (profile!.role === "adjuster") {
      query = query.or(
        `assigned_adjuster_id.eq.${pid},adjuster_id.eq.${pid},auditor_id.eq.${pid},dispatcher_id.eq.${pid}`
      );
    } else if (profile!.role === "inspector") {
      query = query.eq("inspector_id", pid);
    } else if (profile!.role === "assistant") {
      query = query.eq("assistant_id", pid);
    }
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []).map((r: { id: string }) => r.id);
  }

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
    const [adjustmentStatusId, todoStatusId, issuedStatusId] = await Promise.all([
      getStatusId("claim_status", "adjustment"),
      getStatusId("action_status", "todo"),
      getStatusId("action_status", "issued"),
    ]);

    // ── 1. Inspecciones activas ──
    let inspectionsActive = 0;
    if (profile.role === "internal") {
      const { count } = await supabase
        .from("inspection_sessions")
        .select("*", { count: "exact", head: true })
        .in("status", ["scheduled", "active"]);
      inspectionsActive = count ?? 0;
    } else if (profile.role === "inspector") {
      // Inspector: sessions donde claim.inspector_id = pid
      const { count } = await supabase
        .from("inspection_sessions")
        .select("claim:claims!inner(inspector_id)", { count: "exact", head: true })
        .eq("claim.inspector_id", pid)
        .in("status", ["scheduled", "active"]);
      inspectionsActive = count ?? 0;
    } else if (useCompanyFilter) {
      const { count } = await supabase
        .from("inspection_sessions")
        .select("claim:claims!inner(insurance_company_id)", { count: "exact", head: true })
        .eq("claim.insurance_company_id", profile.company_id!)
        .in("status", ["scheduled", "active"]);
      inspectionsActive = count ?? 0;
    } else {
      // adjuster, assistant: filtrar por claim_ids
      const myClaimIds = await getMyClaimIds();
      if (myClaimIds.length > 0) {
        const { count } = await supabase
          .from("inspection_sessions")
          .select("*", { count: "exact", head: true })
          .in("claim_id", myClaimIds)
          .in("status", ["scheduled", "active"]);
        inspectionsActive = count ?? 0;
      }
    }

    // ── 2. Liquidaciones activas (claims en status adjustment) ──
    let liquidationsActive = 0;
    if (adjustmentStatusId) {
      if (profile.role === "internal") {
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status_id", adjustmentStatusId)
          .eq("disabled", false);
        liquidationsActive = count ?? 0;
      } else if (profile.role === "adjuster") {
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status_id", adjustmentStatusId)
          .eq("disabled", false)
          .or(`assigned_adjuster_id.eq.${pid},adjuster_id.eq.${pid},auditor_id.eq.${pid}`);
        liquidationsActive = count ?? 0;
      } else if (profile.role === "inspector") {
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status_id", adjustmentStatusId)
          .eq("disabled", false)
          .eq("inspector_id", pid);
        liquidationsActive = count ?? 0;
      } else if (profile.role === "assistant") {
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status_id", adjustmentStatusId)
          .eq("disabled", false)
          .eq("assistant_id", pid);
        liquidationsActive = count ?? 0;
      } else if (useCompanyFilter) {
        const { count } = await supabase
          .from("claims")
          .select("*", { count: "exact", head: true })
          .eq("status_id", adjustmentStatusId)
          .eq("disabled", false)
          .eq("insurance_company_id", profile.company_id!);
        liquidationsActive = count ?? 0;
      }
    }

    // ── 3-7. Gestiones (claim_actions) ──
    let reviewsPending = 0;
    let dispatchesPending = 0;
    let gestionsAssigned = 0;
    let gestionsAlert = 0;
    let gestionsOverdue = 0;

    // Construir query base para claim_actions
    function buildActionsQuery() {
      let q = supabase
        .from("claim_actions")
        .select(
          "id, issuer_id, reviewer_id, approver_id, dispatcher_id, expected_date, action_status_id, is_active, action_template:action_template(days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve)"
        )
        .eq("is_active", true);

      if (profile!.role === "internal") {
        // Sin filtro adicional
      } else if (profile!.role === "adjuster") {
        q = q.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid},approver_id.eq.${pid},dispatcher_id.eq.${pid}`);
      } else if (profile!.role === "inspector") {
        q = q.eq("issuer_id", pid);
      } else if (profile!.role === "assistant") {
        q = q.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid}`);
      } else if (useCompanyFilter) {
        // client_operator: filtrar por company_id del claim
        q = q.select(
          "id, issuer_id, reviewer_id, approver_id, dispatcher_id, expected_date, action_status_id, is_active, claim:claims!inner(insurance_company_id), action_template:action_template(days_to_issue, days_to_review, days_to_approve, days_to_alert_to_issue, days_to_alert_to_review, days_to_alert_to_approve)"
        )
          .eq("is_active", true)
          .eq("claim.insurance_company_id", profile!.company_id!);
      }
      return q;
    }

    const { data: actions, error: actionsError } = await buildActionsQuery();

    if (!actionsError && actions) {
      const allActions = actions as Array<{
        id: string;
        issuer_id: string | null;
        reviewer_id: string | null;
        approver_id: string | null;
        dispatcher_id: string | null;
        expected_date: string | null;
        action_status_id: string | null;
        action_template: Array<{
          days_to_issue: number | null;
          days_to_review: number | null;
          days_to_approve: number | null;
          days_to_alert_to_issue: number | null;
          days_to_alert_to_review: number | null;
          days_to_alert_to_approve: number | null;
        }> | { days_to_issue: number | null; days_to_review: number | null; days_to_approve: number | null; days_to_alert_to_issue: number | null; days_to_alert_to_review: number | null; days_to_alert_to_approve: number | null } | null;
      }>;

      gestionsAssigned = allActions.length;

      for (const action of allActions) {
        const statusId = action.action_status_id;
        const isPending = statusId === todoStatusId;
        const isIssued = statusId === issuedStatusId;

        // Revisión pendiente: status = issued y reviewer_id = pid
        if (isIssued && action.reviewer_id === pid) {
          reviewsPending++;
        }

        // Despacho pendiente: status = issued (o reviewed/approved) y dispatcher_id = pid
        if (isIssued && action.dispatcher_id === pid) {
          dispatchesPending++;
        }

        // Alerta y vencimiento basado en expected_date
        if (action.expected_date && isPending) {
          const expected = new Date(action.expected_date);
          const expectedMs = expected.getTime();
          const nowMs = new Date(now).getTime();
          const daysUntilDue = (expectedMs - nowMs) / 86400000;

          if (daysUntilDue < 0) {
            gestionsOverdue++;
          } else if (daysUntilDue <= 3) {
            gestionsAlert++;
          }
        }
      }
    }

    return {
      inspectionsActive,
      liquidationsActive,
      reviewsPending,
      dispatchesPending,
      gestionsAssigned,
      gestionsAlert,
      gestionsOverdue,
    };
  } catch {
    return EMPTY;
  }
}
