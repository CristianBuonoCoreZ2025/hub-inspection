import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllPages } from "@/lib/supabase/db";

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

export interface DashboardStats {
  totalClaims: number;
  openClaims: number;
  closedClaims: number;
  createdClaims: number;
  adjustmentClaims: number;
  dispatchmentClaims: number;
  reopenedClaims: number;
  avgResolutionDays: number;
  closeRate: number;

  totalSessions: number;
  scheduledSessions: number;
  activeSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  inspectionCompletionRate: number;
  unassignedInspections: number;
  completionVsScheduledRate: number;

  inspectionsToday: number;
  scheduledToday: number;
  completedToday: number;
  overdueSessions: number;
  avgInspectionMinutes: number;

  claimsByStatus: Array<{ name: string; value: number; color: string }>;
  topCompanies: Array<{ id: string; name: string; value: number; inspections: number }>;
  topRamos: Array<{ name: string; value: number; color: string | null }>;
  topAdjusters: Array<{ id: string; name: string; count: number }>;
  topDispatchers: Array<{ id: string; name: string; count: number }>;
  topAuditors: Array<{ id: string; name: string; count: number }>;
  topInspectors: Array<{
    id: string;
    name: string;
    total: number;
    completed: number;
    scheduled: number;
    active: number;
    avgMinutes: number;
  }>;
  topCompaniesByInspections: Array<{ id: string; name: string; total: number }>;

  inspectionsByStatus: Array<{ name: string; value: number; color: string }>;
  monthsData: Array<{ name: string; value: number; value2: number }>;
  claimsByDay: Array<{ name: string; value: number }>;
  inspectionsByDay: Array<{ name: string; value: number }>;
  inspectionsByRegion: Array<{ name: string; agendadas: number; enProceso: number; completadas: number; canceladas: number; country_id?: string | null }>;
  inspectionsByCommune: Array<{ name: string; agendadas: number; enProceso: number; completadas: number; canceladas: number }>;
  claimsByRegion: Array<{ name: string; value: number }>;
  avgTimeByInspector: Array<{ name: string; value: number }>;

  totalCompanies: number;
  totalUsers: number;
  activeUsers: number;
  myTotalSessions: number;
  myActiveSessions: number;
  myScheduledSessions: number;
  myCompletedSessions: number;

  inspectionsByLocation: DashboardLocationInspection[];
  claimsByLocation: DashboardLocationClaim[];
  countries: Array<{ id: string; name: string }>;
  recentSessions: DashboardDetailItem[];
}

export interface DashboardLocationInspection {
  countryId: string;
  country: string;
  region: string;
  city: string;
  commune: string;
  agendadas: number;
  enProceso: number;
  completadas: number;
  canceladas: number;
}

export interface DashboardLocationClaim {
  countryId: string;
  country: string;
  region: string;
  city: string;
  commune: string;
  businessLine: string;
  color: string | null;
  count: number;
}

export interface DashboardDetailItem {
  id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  inspector_id: string | null;
  claim_id: string | null;
  liquidation_number: string | null;
  claim_address: string | null;
  inspection_number: string | null;
  insured_name: string | null;
  inspector_name: string | null;
  duration_minutes?: number | null;
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
  return fetchAllPages<LightClaim>((from, to) =>
    supabase
      .from("claims")
      .select(CLAIM_LIGHT_SELECT)
      .eq("disabled", false)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
}

export async function getDashboardSessions(): Promise<LightSession[]> {
  const supabase = getSupabaseClient();
  const allSessions = await fetchAllPages<LightSession>((from, to) =>
    supabase
      .from("inspection_sessions")
      .select(SESSION_LIGHT_SELECT)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
  // Setear inspection_number desde claim_action.code (estándar de gestiones)
  for (const s of allSessions) {
    if (s.claim_action?.code) {
      s.inspection_number = s.claim_action.code;
    }
  }
  return allSessions;
}

export async function getDashboardProfiles(): Promise<LightProfile[]> {
  const supabase = getSupabaseClient();
  return fetchAllPages<LightProfile>((from, to) =>
    supabase
      .from("profiles")
      .select(PROFILE_LIGHT_SELECT)
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .range(from, to)
  );
}

export async function getDashboardCompaniesCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDashboardSummary(): Promise<DashboardStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw new Error(error.message);
  return (data ?? {}) as DashboardStats;
}

export async function getDashboardDetail(
  key: string,
  limit = 10
): Promise<DashboardDetailItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_dashboard_detail", {
    p_key: key,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardDetailItem[];
}

export type { LightClaim, LightSession, LightProfile };
