import { getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para listar gestiones (claim_actions) asignadas al usuario
// SIEMPRE filtra por asignacion directa, igual que topbar-stats.
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

export type GestionFilter = "all" | "pending" | "reviews" | "dispatches" | "alert" | "overdue";

/**
 * Obtiene las gestiones asignadas al usuario, opcionalmente filtradas.
 * - all: todas las asignadas (activas, no completadas)
 * - pending: status = todo
 * - reviews: status = issued y reviewer_id = pid
 * - dispatches: status = issued y dispatcher_id = pid
 * - alert: expected_date dentro de 3 días, no vencida, status = todo
 * - overdue: expected_date vencida, status = todo
 */
export async function getMyGestiones(
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined,
  filter: GestionFilter = "all"
): Promise<MyGestion[]> {
  if (!profile) return [];

  const supabase = getSupabaseClient();
  const pid = profile.id;
  const now = new Date().toISOString();
  const useCompanyFilter = profile.role === "client_operator" && profile.company_id;

  // Construir query base
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

  // Filtro por rol — igual que topbar-stats
  if (profile.role === "adjuster" || profile.role === "internal") {
    query = query.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid},approver_id.eq.${pid},dispatcher_id.eq.${pid}`);
  } else if (profile.role === "inspector") {
    query = query.eq("issuer_id", pid);
  } else if (profile.role === "assistant") {
    query = query.or(`issuer_id.eq.${pid},reviewer_id.eq.${pid}`);
  } else if (useCompanyFilter) {
    query = query.eq("claim.insurance_company_id", profile.company_id!);
  } else {
    return [];
  }

  const { data, error } = await query.order("created_on", { ascending: false });

  if (error || !data) return [];

  // Mapear y aplanar
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

  // Aplicar filtro
  const nowMs = new Date(now).getTime();

  switch (filter) {
    case "pending":
      gestiones = gestiones.filter((g) => g.action_status_code === "todo");
      break;
    case "reviews":
      gestiones = gestiones.filter(
        (g) => g.action_status_code === "issued" && g.reviewer_id === pid
      );
      break;
    case "dispatches":
      gestiones = gestiones.filter(
        (g) => g.action_status_code === "issued" && g.dispatcher_id === pid
      );
      break;
    case "alert":
      gestiones = gestiones.filter((g) => {
        if (g.action_status_code !== "todo" || !g.expected_date) return false;
        const daysUntilDue = (new Date(g.expected_date).getTime() - nowMs) / 86400000;
        return daysUntilDue >= 0 && daysUntilDue <= 3;
      });
      break;
    case "overdue":
      gestiones = gestiones.filter((g) => {
        if (g.action_status_code !== "todo" || !g.expected_date) return false;
        return new Date(g.expected_date).getTime() < nowMs;
      });
      break;
    case "all":
    default:
      // Excluir completadas/despachadas (solo lo en flujo)
      gestiones = gestiones.filter(
        (g) => g.action_status_code !== "completed" && g.action_status_code !== "dispatched"
      );
      break;
  }

  return gestiones;
}
