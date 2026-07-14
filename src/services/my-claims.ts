import { getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Servicio para listar siniestros asignados al usuario por rol.
// Solo claims no cerrados, no disabled.
// ═══════════════════════════════════════════════════════════════

export type ClaimRole = "liquidador" | "inspector" | "despachador" | "auditor";

export interface MyClaim {
  id: string;
  claim_number: string | null;
  liquidation_number: string | null;
  client_reference: string | null;
  internal_number: string | null;
  claim_date: string | null;
  status_id: string | null;
  status_code: string | null;
  status_name: string | null;
  insured_name: string | null;
  insured_address: string | null;
  insured_city: string | null;
  insurance_company_name: string | null;
  assigned_adjuster_name: string | null;
  inspector_name: string | null;
  auditor_name: string | null;
  dispatcher_name: string | null;
  inspection_count: number;
  inspection_active_count: number;
}

const ROLE_FIELD_MAP: Record<ClaimRole, string[]> = {
  liquidador: ["assigned_adjuster_id", "adjuster_id"],
  inspector: ["inspector_id"],
  despachador: ["dispatcher_id"],
  auditor: ["auditor_id"],
};

const ROLE_TITLE: Record<ClaimRole, string> = {
  liquidador: "Mis Liquidaciones",
  inspector: "Mis Inspecciones",
  despachador: "Mis Despachos",
  auditor: "Mi Auditoría",
};

const ROLE_ICON_NAME: Record<ClaimRole, string> = {
  liquidador: "FileText",
  inspector: "ClipboardCheck",
  despachador: "Send",
  auditor: "ShieldCheck",
};

/**
 * Obtiene los claims asignados al usuario según el rol especificado.
 * Excluye claims cerrados y disabled.
 */
export async function getMyClaims(
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined,
  claimRole: ClaimRole
): Promise<MyClaim[]> {
  if (!profile) return [];

  const supabase = getSupabaseClient();
  const pid = profile.id;

  // Obtener status_id de "closed"
  const { data: closedStatus } = await supabase
    .from("lookup_catalog")
    .select("id")
    .eq("category", "claim_status")
    .eq("code", "closed")
    .maybeSingle();

  const closedId = (closedStatus as { id: string } | null)?.id;

  // Construir query
  const select = `
    id, claim_number, liquidation_number, client_reference, internal_number,
    claim_date, status_id, disabled, insurance_company_id,
    assigned_adjuster_id, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id,
    status:lookup_catalog!claims_status_id_fkey(id, code, name),
    assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name),
    inspector:profiles!claims_inspector_id_fkey(id, full_name),
    auditor:profiles!claims_auditor_id_fkey(id, full_name),
    dispatcher:profiles!claims_dispatcher_id_fkey(id, full_name),
    insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name),
    insured:claim_participants!claims_insured_participant_id_fkey(full_name, address, city),
    inspection_sessions:inspection_sessions(id, status)
  `;

  let query = supabase
    .from("claims")
    .select(select)
    .eq("disabled", false);

  if (closedId) {
    query = query.neq("status_id", closedId);
  }

  // Filtro por rol del claim
  const fields = ROLE_FIELD_MAP[claimRole];
  if (fields.length === 1) {
    query = query.eq(fields[0], pid);
  } else {
    query = query.or(fields.map((f) => `${f}.eq.${pid}`).join(","));
  }

  const { data, error } = await query.order("claim_date", { ascending: false });

  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    claim_number: string | null;
    liquidation_number: string | null;
    client_reference: string | null;
    internal_number: string | null;
    claim_date: string | null;
    status_id: string | null;
    disabled: boolean;
    status: { id: string; code: string; name: string } | null;
    assigned_adjuster: { id: string; full_name: string | null } | null;
    inspector: { id: string; full_name: string | null } | null;
    auditor: { id: string; full_name: string | null } | null;
    dispatcher: { id: string; full_name: string | null } | null;
    insurance_company: { id: string; name: string | null } | null;
    insured: { full_name: string | null; address: string | null; city: string | null } | null;
    inspection_sessions: Array<{ id: string; status: string }> | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    claim_number: r.claim_number,
    liquidation_number: r.liquidation_number,
    client_reference: r.client_reference,
    internal_number: r.internal_number,
    claim_date: r.claim_date,
    status_id: r.status_id,
    status_code: r.status?.code ?? null,
    status_name: r.status?.name ?? null,
    insured_name: r.insured?.full_name ?? null,
    insured_address: r.insured?.address ?? null,
    insured_city: r.insured?.city ?? null,
    insurance_company_name: r.insurance_company?.name ?? null,
    assigned_adjuster_name: r.assigned_adjuster?.full_name ?? null,
    inspector_name: r.inspector?.full_name ?? null,
    auditor_name: r.auditor?.full_name ?? null,
    dispatcher_name: r.dispatcher?.full_name ?? null,
    inspection_count: r.inspection_sessions?.length ?? 0,
    inspection_active_count: r.inspection_sessions?.filter((s) => s.status === "scheduled" || s.status === "active").length ?? 0,
  }));
}

export { ROLE_TITLE, ROLE_ICON_NAME };
