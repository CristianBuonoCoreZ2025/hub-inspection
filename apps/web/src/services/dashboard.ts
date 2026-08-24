import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Servicio optimizado para el dashboard.
 * En lugar de cargar TODOS los claims y sesiones con todas sus relaciones,
 * hace consultas selectivas con solo las columnas necesarias para los agregados.
 */

// ── Tipos ligeros ──

interface LightClaim {
  id: string;
  status_id: string;
  claim_date: string | null;
  created_at: string;
  updated_at: string;
  liquidation_number: string | null;
  claim_address: string | null;
  insurance_company_id: string | null;
  business_line_id: string | null;
  claim_type_id: string | null;
  region_id: string | null;
  commune_id: string | null;
  assigned_adjuster_id: string | null;
  adjuster_id: string | null;
  dispatcher_id: string | null;
  auditor_id: string | null;
  assistant_id: string | null;
  inspector_id: string | null;
  insurance_company?: { name: string } | null;
  business_line?: { name: string; color: string | null } | null;
  claim_type?: { name: string } | null;
  region?: { name: string; country_id: string } | null;
  commune?: { name: string; city?: { name: string } | null } | null;
  assigned_adjuster?: { full_name: string } | null;
  adjuster?: { full_name: string } | null;
  dispatcher?: { full_name: string } | null;
  auditor?: { full_name: string } | null;
  claims_participants?: { claim_id: string; type: string; full_name: string }[] | null;
}

interface LightSession {
  id: string;
  claim_id: string | null;
  inspector_id: string | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  claim_action?: { code: string | null } | null;
  inspection_number?: string;
}

interface LightProfile {
  id: string;
  full_name: string;
  is_active: boolean;
}

// ── SELECT ligeros ──

const CLAIM_LIGHT_SELECT =
  "id, status_id, claim_date, created_at, updated_at, liquidation_number, claim_address, insurance_company_id, business_line_id, claim_type_id, region_id, commune_id, assigned_adjuster_id, adjuster_id, dispatcher_id, auditor_id, assistant_id, inspector_id, insurance_company:insurance_companies!claims_insurance_company_id_fkey(name), business_line:business_lines!claims_business_line_id_fkey(name, color), claim_type:claim_types!claims_claim_type_id_fkey(name), region:regions!claims_region_id_fkey(name, country_id), commune:communes!claims_commune_id_fkey(name, city:cities!communes_city_id_fkey(name)), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(full_name), adjuster:profiles!claims_adjuster_id_fkey(full_name), dispatcher:profiles!claims_dispatcher_id_fkey(full_name), auditor:profiles!claims_auditor_id_fkey(full_name), claims_participants:claims_participants(claim_id, type, full_name)";

const SESSION_LIGHT_SELECT =
  "id, claim_id, inspector_id, status, scheduled_at, started_at, ended_at, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code)";

const PROFILE_LIGHT_SELECT = "id, full_name, is_active";

// ── Funciones de carga ──

export async function getDashboardClaims(): Promise<LightClaim[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_LIGHT_SELECT)
    .eq("disabled", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LightClaim[]) ?? [];
}

export async function getDashboardSessions(): Promise<LightSession[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inspection_sessions")
    .select(SESSION_LIGHT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const sessions = (data as LightSession[]) ?? [];
  // Setear inspection_number desde claim_action.code (estándar de gestiones)
  for (const s of sessions) {
    if (s.claim_action?.code) {
      s.inspection_number = s.claim_action.code;
    }
  }
  return sessions;
}

export async function getDashboardProfiles(): Promise<LightProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_LIGHT_SELECT)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as LightProfile[]) ?? [];
}

export async function getDashboardCompaniesCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type { LightClaim, LightSession, LightProfile };
