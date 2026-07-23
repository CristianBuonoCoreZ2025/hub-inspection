import { getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para listar gestiones (claim_actions) asignadas al usuario
// Filtra por rol + estado actual de la acción.
// ═══════════════════════════════════════════════════════════════

export interface MyGestion {
  id: string;
  claim_id: string;
  name: string;
  code: string | null;
  expected_date: string | null;
  action_status_id: string | null;
  action_status_code: string | null;
  action_status_name: string | null;
  issuer_id: string | null;
  reviewer_id: string | null;
  approver_id: string | null;
  dispatcher_id: string | null;
  claim_number: string | null;
  liquidation_number: string | null;
  client_reference: string | null;
  insured_name: string | null;
  created_on: string | null;
}

export type GestionFilter =
  | "all"
  | "in-progress"
  | "reviews"
  | "approvals"
  | "alert"
  | "overdue";

/**
 * Obtiene las gestiones asignadas al usuario, opcionalmente filtradas.
 *
 * - all: todas las asignadas en flujo activo
 * - in-progress: soy emisor, status=todo, no alerta/atraso
 * - reviews: soy revisor, status=issued, no alerta/atraso
 * - approvals: soy aprobador, status=reviewed, no alerta/atraso
 * - alert: soy responsable actual, en alerta (≤3 dias)
 * - overdue: soy responsable actual, vencida
 */
export async function getMyGestiones(
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined,
  filter: GestionFilter = "all"
): Promise<MyGestion[]> {
  if (!profile) return [];

  const supabase = getSupabaseClient();
  const pid = profile.id;
  const nowMs = Date.now();

  const select = `
    id, claim_id, name, code, expected_date, action_status_id, is_active, created_on,
    issuer_id, reviewer_id, approver_id, dispatcher_id,
    action_status:lookup_catalog!claim_actions_action_status_id_fkey(id, category, code, name),
    claim:claims!claim_actions_claim_id_fkey(
      id, claim_number, liquidation_number, client_reference,
      insured:claim_participants!claims_insured_participant_id_fkey(full_name)
    )
  `;

  let query = supabase
    .from("claim_actions")
    .select(select)
    .eq("is_active", true);

  // Filtro por rol
  if (profile.role === "adjuster" || profile.role === "internal") {
    query = query.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid},approver_id.eq.${pid},dispatcher_id.eq.${pid}`);
  } else if (profile.role === "inspector") {
    query = query.eq("issuer_id", pid);
  } else if (profile.role === "assistant") {
    query = query.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid}`);
  } else {
    return [];
  }

  const { data, error } = await query.order("created_on", { ascending: true });
  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    claim_id: string;
    name: string;
    code: string | null;
    expected_date: string | null;
    action_status_id: string | null;
    is_active: boolean;
    created_on: string | null;
    issuer_id: string | null;
    reviewer_id: string | null;
    approver_id: string | null;
    dispatcher_id: string | null;
    action_status: { id: string; code: string; name: string } | null;
    claim: {
      id: string;
      claim_number: string | null;
      liquidation_number: string | null;
      client_reference: string | null;
      insured: { full_name: string | null } | null;
    } | null;
  }>;

  // Mapear
  let gestiones: MyGestion[] = rows.map((r) => ({
    id: r.id,
    claim_id: r.claim_id,
    name: r.name,
    code: r.code,
    expected_date: r.expected_date,
    action_status_id: r.action_status_id,
    action_status_code: r.action_status?.code ?? null,
    action_status_name: r.action_status?.name ?? null,
    issuer_id: r.issuer_id,
    reviewer_id: r.reviewer_id,
    approver_id: r.approver_id,
    dispatcher_id: r.dispatcher_id,
    claim_number: r.claim?.claim_number ?? null,
    liquidation_number: r.claim?.liquidation_number ?? null,
    client_reference: r.claim?.client_reference ?? null,
    insured_name: r.claim?.insured?.full_name ?? null,
    created_on: r.created_on,
  }));

  // Helper: determinar si el usuario es el responsable actual
  function isCurrentResponsible(g: MyGestion): boolean {
    const sc = g.action_status_code;
    if (sc === "todo" && g.issuer_id === pid) return true;
    if (sc === "issued" && g.reviewer_id === pid) return true;
    if (sc === "reviewed" && g.approver_id === pid) return true;
    return false;
  }

  // Helper: calcular alerta/atraso
  function getDaysUntilDue(g: MyGestion): number | null {
    if (!g.expected_date) return null;
    return (new Date(g.expected_date).getTime() - nowMs) / 86400000;
  }

  // Aplicar filtro
  switch (filter) {
    case "in-progress":
      gestiones = gestiones.filter((g) => {
        if (g.action_status_code !== "todo" || g.issuer_id !== pid) return false;
        const d = getDaysUntilDue(g);
        return d === null || (d >= 0 && d > 3);
      });
      break;

    case "reviews":
      gestiones = gestiones.filter((g) => {
        if (g.action_status_code !== "issued" || g.reviewer_id !== pid) return false;
        const d = getDaysUntilDue(g);
        return d === null || (d >= 0 && d > 3);
      });
      break;

    case "approvals":
      gestiones = gestiones.filter((g) => {
        if (g.action_status_code !== "reviewed" || g.approver_id !== pid) return false;
        const d = getDaysUntilDue(g);
        return d === null || (d >= 0 && d > 3);
      });
      break;

    case "alert":
      gestiones = gestiones.filter((g) => {
        if (!isCurrentResponsible(g)) return false;
        const d = getDaysUntilDue(g);
        return d !== null && d >= 0 && d <= 3;
      });
      break;

    case "overdue":
      gestiones = gestiones.filter((g) => {
        if (!isCurrentResponsible(g)) return false;
        const d = getDaysUntilDue(g);
        return d !== null && d < 0;
      });
      break;

    case "all":
    default:
      // Excluir completadas/despachadas/rechazadas (solo en flujo)
      gestiones = gestiones.filter(
        (g) =>
          g.action_status_code !== "completed" &&
          g.action_status_code !== "dispatched" &&
          g.action_status_code !== "rejected" &&
          g.action_status_code !== "cancelled"
      );
      break;
  }

  return gestiones;
}
