"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { getDashboardClaims, getDashboardSessions, getDashboardProfiles, getDashboardCompaniesCount } from "@/services/dashboard";
import { getCountries } from "@/services/catalogs";
import { userTypeLabels } from "@/services/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { KpiGridSkeleton } from "@/components/ui/skeletons";
import {
  FileText,
  AlertCircle,
  Calendar,
  Timer,
  Activity,
  ClipboardCheck,
  Building2,
  Zap,
  UserCheck,
  Briefcase,
  Layers,
  FilePen,
  MapPin,
} from "lucide-react";
import { KpiTodayIcon, KpiActiveIcon, KpiScheduledIcon, KpiCompletedIcon, KpiOverdueIcon, KpiTimeIcon } from "@/components/dashboard/kpi-icons";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { useUiThemeId } from "@/hooks/use-ui-theme-id";
import type { UserRole } from "@/types";
import type { LightClaim, LightSession } from "@/services/dashboard";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChartGlass } from "@/components/dashboard/bar-chart";
import { BarChartQuad } from "@/components/dashboard/bar-chart-quad";
import { NestedDonutChart } from "@/components/dashboard/nested-donut-chart";
import { SplineAreaChart } from "@/components/dashboard/spline-area-chart";

const STATUS_LABELS: Record<string, string> = {
  created: "Creado",
  adjustment: "Liquidación",
  dispatchment: "Despacho",
  closed: "Cerrado",
  reopened: "Reabierto",
};

/* ── Paletas de colores por tema ──
 * Aurora usa tonos neon (brillantes, saturados) */
const STATUS_COLORS_NORDIC: Record<string, string> = {
  created: "#3b82f6",
  adjustment: "#f59e0b",
  dispatchment: "#8b5cf6",
  closed: "#10b981",
  reopened: "#ef4444",
};

const STATUS_COLORS_AURORA: Record<string, string> = {
  created: "#00f2ff",
  adjustment: "#f59e0b",
  dispatchment: "#a855f7",
  closed: "#10b981",
  reopened: "#ef4444",
};

const LOCATION_COLORS_NORDIC = ["#0095DA", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#ec4899", "#6366f1"];
const LOCATION_COLORS_AURORA = ["#00f2ff", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#38bdf8", "#ec4899", "#6366f1"];

/* Mapeo de colores corporativos a neon para Aurora */
const BUSINESS_COLOR_MAP_AURORA: Record<string, string> = {
  "#0095DA": "#00f2ff",
  "#0ea5e9": "#00f2ff",
  "#3b82f6": "#38bdf8",
  "#8b5cf6": "#a855f7",
  "#f59e0b": "#f59e0b",
  "#10b981": "#10b981",
  "#ef4444": "#ef4444",
  "#ec4899": "#ec4899",
  "#06b6d4": "#00f2ff",
  "#6366f1": "#6366f1",
  "#f97316": "#f97316",
  "#22c55e": "#10b981",
};

function mapBusinessColor(color: string | null, fallback: string, isAurora: boolean): string {
  if (!color) return fallback;
  if (!isAurora) return color;
  return BUSINESS_COLOR_MAP_AURORA[color.toLowerCase()] || color;
}

/* Colores de estados de inspección (inner donut) */
const INSPECTION_STATUS_NORDIC = { scheduled: "#3b82f6", inProgress: "#f59e0b", completed: "#10b981", cancelled: "#ef4444" };
const INSPECTION_STATUS_AURORA = { scheduled: "#38bdf8", inProgress: "#f97316", completed: "#10b981", cancelled: "#f43f5e" };

type KpiDetailRow = {
  id: string;
  inspectionCode: string;
  liquidation: string;
  insured: string;
  address: string;
  inspector: string;
  status: string;
  date: string;
  time: string;
  scheduled?: string | null;
  started?: string | null;
  ended?: string | null;
  duration?: number;
};

function isToday(d: string) {
  const date = new Date(d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return date >= start && date <= end;
}

function formatDuration(minutes: number): string {
  const roundedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return hours > 0 ? `${hours}H${remainder}M` : `${remainder}M`;
}

/**
 * Filtra los claims según el rol del usuario:
 * - internal: ve todo
 * - otros roles: solo claims donde participa en alguno de los roles asignados
 */
function filterClaimsForUser(
  allClaims: LightClaim[],
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined
): LightClaim[] {
  if (!profile) return [];
  if (profile.role === "internal") return allClaims;
  return allClaims.filter((c) =>
    c.assigned_adjuster_id === profile.id ||
    c.adjuster_id === profile.id ||
    c.inspector_id === profile.id ||
    c.auditor_id === profile.id ||
    c.dispatcher_id === profile.id ||
    c.assistant_id === profile.id
  );
}

// Paleta de colores para los donuts de ubicación (constante del módulo)
// Se selecciona según tema en runtime

export default function DashboardPage() {
  const { profile } = useAuth();
  const { statusCode } = useClaimStatuses();
  const themeId = useUiThemeId();
  const isAurora = themeId === "fluid-aurora";
  const STATUS_COLORS = isAurora ? STATUS_COLORS_AURORA : STATUS_COLORS_NORDIC;
  const LOCATION_COLORS = isAurora ? LOCATION_COLORS_AURORA : LOCATION_COLORS_NORDIC;
  const INSPECTION_STATUS = isAurora ? INSPECTION_STATUS_AURORA : INSPECTION_STATUS_NORDIC;

  const isGlobalUser = profile?.role === "internal";
  const roleLabel = profile ? userTypeLabels[profile.role] : "";

  // Realtime: solo claims y sessions (audit_logs se quitó por performance)
  useRealtime("claims", [["dashboard-claims"]]);
  useRealtime("inspection_sessions", [["dashboard-sessions"]]);

  const { data: claims, isLoading: claimsLoading } = useQuery({
    queryKey: ["dashboard-claims"],
    queryFn: () => getDashboardClaims(),
    enabled: !!profile,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["dashboard-sessions"],
    queryFn: () => getDashboardSessions(),
    enabled: !!profile,
  });

  const { data: companiesCount } = useQuery({
    queryKey: ["dashboard-companies-count"],
    queryFn: () => getDashboardCompaniesCount(),
    enabled: !!profile,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    enabled: !!profile,
  });

  // Filtros para el dashboard de inspecciones por ubicación (3 nested donuts)
  const [selectedCountryId, setSelectedCountryId] = useState<string>("__all");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);

  // Filtro para el dashboard de siniestros (3 nested donuts: región > ciudad > comuna)
  const [selectedSiniestroCountryId, setSelectedSiniestroCountryId] = useState<string | null>(null);
  const [selectedSiniestroRegion, setSelectedSiniestroRegion] = useState<string | null>(null);
  const [selectedSiniestroCity, setSelectedSiniestroCity] = useState<string | null>(null);
  const [selectedSiniestroCommune, setSelectedSiniestroCommune] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: () => getDashboardProfiles(),
    enabled: !!profile,
  });

  // Filtrar claims según el rol del usuario
  const myClaims = useMemo(
    () => filterClaimsForUser((claims as LightClaim[]) ?? [], profile),
    [claims, profile]
  );

  // Las sesiones ya vienen filtradas por RLS (is_session_accessible).
  // No se recortan por claims para que un inspector asignado a una inspección
  // la vea aunque no tenga acceso al siniestro asociado.
  const sessionList = useMemo(() => (sessions as LightSession[]) ?? [], [sessions]);

  const stats = useMemo(() => {
    const allClaims = myClaims;
    const allSessions = sessionList;

    const closedClaims = allClaims.filter(
      (c: LightClaim) => statusCode(c.status_id) === "closed"
    );
    const openClaims = allClaims.filter(
      (c: LightClaim) => statusCode(c.status_id) !== "closed"
    );
    const createdClaims = allClaims.filter(
      (c: LightClaim) => statusCode(c.status_id) === "created"
    );
    const adjustmentClaims = allClaims.filter(
      (c: LightClaim) => statusCode(c.status_id) === "adjustment"
    );

    // Tiempo promedio de resolución
    let avgResolutionDays = 0;
    if (closedClaims.length > 0) {
      const totalDays = closedClaims.reduce((sum: number, c: LightClaim) => {
        const created = new Date(c.created_at).getTime();
        const updated = new Date(c.updated_at).getTime();
        return sum + (updated - created) / 86400000;
      }, 0);
      avgResolutionDays = totalDays / closedClaims.length;
    }

    // Tasa de cierre
    const closeRate =
      allClaims.length > 0
        ? (closedClaims.length / allClaims.length) * 100
        : 0;

    // Inspecciones
    const scheduledSessions = allSessions.filter(
      (s: LightSession) =>
        s.status === "scheduled" &&
        s.scheduled_at &&
        new Date(s.scheduled_at) >= new Date()
    );
    const activeSessions = allSessions.filter(
      (s: LightSession) => s.status === "active"
    );
    const completedSessions = allSessions.filter(
      (s: LightSession) => s.status === "completed"
    );
    const cancelledSessions = allSessions.filter(
      (s: LightSession) => s.status === "cancelled"
    );

    // Tasa de completitud de inspecciones
    const inspectionCompletionRate =
      allSessions.length > 0
        ? (completedSessions.length / allSessions.length) * 100
        : 0;

    // Claims por estado (para donut)
    const claimsByStatus: Array<{ name: string; value: number; color: string }> = [];
    const statusCounts: Record<string, number> = {};
    allClaims.forEach((c: LightClaim) => {
      const code = statusCode(c.status_id) ?? "unknown";
      statusCounts[code] = (statusCounts[code] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([code, count]) => {
      claimsByStatus.push({
        name: STATUS_LABELS[code] || code,
        value: count,
        color: STATUS_COLORS[code] || "#64748b",
      });
    });

    // Claims por compañía (top 5, para barras horizontales con casos + inspecciones)
    const claimsByCompany: Record<string, { claims: number; inspections: number }> = {};
    allClaims.forEach((c: LightClaim) => {
      const name = c.insurance_company?.name || "Sin compañía";
      if (!claimsByCompany[name]) claimsByCompany[name] = { claims: 0, inspections: 0 };
      claimsByCompany[name].claims++;
    });
    const claimMapForCompany = new Map(allClaims.map((c) => [c.id, c]));
    allSessions.forEach((s) => {
      const claim = s.claim_id ? claimMapForCompany.get(s.claim_id) : undefined;
      const name = claim?.insurance_company?.name || "Sin compañía";
      if (!claimsByCompany[name]) claimsByCompany[name] = { claims: 0, inspections: 0 };
      claimsByCompany[name].inspections++;
    });
    const topCompanies = Object.entries(claimsByCompany)
      .sort((a, b) => b[1].claims - a[1].claims)
      .slice(0, 6)
      .map(([name, v]) => ({ name, value: v.claims, inspections: v.inspections }));

    // Claims por ramo / línea de negocio
    const claimsByRamo: Record<string, { count: number; color: string | null }> = {};
    allClaims.forEach((c: LightClaim) => {
      const name = c.business_line?.name || c.claim_type?.name || "Sin línea de negocio";
      const color = c.business_line?.color || null;
      if (!claimsByRamo[name]) claimsByRamo[name] = { count: 0, color };
      claimsByRamo[name].count++;
      if (!claimsByRamo[name].color && color) claimsByRamo[name].color = color;
    });
    const ramoFallbackColors = LOCATION_COLORS;
    const topRamos = Object.entries(claimsByRamo)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, v], i) => ({ name, value: v.count, color: mapBusinessColor(v.color, ramoFallbackColors[i % ramoFallbackColors.length], isAurora) }));

    // Top responsables (liquidador, despachador, revisor)
    const buildTopUsers = (field: "assigned_adjuster_id" | "adjuster_id" | "dispatcher_id" | "auditor_id") => {
      const map: Record<string, { id: string; name: string; count: number }> = {};
      allClaims.forEach((c: LightClaim) => {
        const id = c[field];
        if (!id) return;
        const name =
          field === "assigned_adjuster_id" ? (c.assigned_adjuster?.full_name || users?.find((u) => u.id === id)?.full_name || "Sin nombre") :
          field === "adjuster_id" ? (c.adjuster?.full_name || users?.find((u) => u.id === id)?.full_name || "Sin nombre") :
          field === "dispatcher_id" ? (c.dispatcher?.full_name || users?.find((u) => u.id === id)?.full_name || "Sin nombre") :
          field === "auditor_id" ? (c.auditor?.full_name || users?.find((u) => u.id === id)?.full_name || "Sin nombre") :
          "Sin nombre";
        if (!map[id]) map[id] = { id, name, count: 0 };
        map[id].count++;
      });
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6);
    };
    const topAdjusters = buildTopUsers("adjuster_id");
    const topDispatchers = buildTopUsers("dispatcher_id");
    const topAuditors = buildTopUsers("auditor_id");

    // Inspecciones por estado (para barras)
    const inspectionsByStatus = [
      { name: "Agendada", value: scheduledSessions.length, color: "#3b82f6" },
      { name: "En curso", value: activeSessions.length, color: "#f59e0b" },
      { name: "Completada", value: completedSessions.length, color: "#10b981" },
      { name: "Cancelada", value: cancelledSessions.length, color: "#ef4444" },
    ];

    // Metricas de inspecciones (foco del dashboard)
    const nowTime = new Date();
    const todayStart = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate());
    const todayEnd = new Date(nowTime.getFullYear(), nowTime.getMonth(), todayStart.getDate(), 23, 59, 59, 999);
    const isToday = (d: string) => {
      const date = new Date(d);
      return date >= todayStart && date <= todayEnd;
    };

    const todaySessionIds = new Set<string>();
    allSessions.forEach((s) => {
      if (s.scheduled_at && isToday(s.scheduled_at)) todaySessionIds.add(s.id);
      if (s.started_at && isToday(s.started_at)) todaySessionIds.add(s.id);
      if (s.ended_at && isToday(s.ended_at)) todaySessionIds.add(s.id);
    });
    const inspectionsToday = todaySessionIds.size;

    const scheduledToday = allSessions.filter(
      (s) => s.status === "scheduled" && s.scheduled_at && isToday(s.scheduled_at)
    ).length;
    const completedToday = allSessions.filter(
      (s) => s.status === "completed" && s.ended_at && isToday(s.ended_at)
    ).length;
    const overdueSessions = allSessions.filter(
      (s) =>
        (s.status === "scheduled" || s.status === "active") &&
        s.scheduled_at &&
        new Date(s.scheduled_at) < nowTime
    ).length;

    const completedTimes = allSessions
      .filter((s) => s.status === "completed" && s.started_at && s.ended_at)
      .map((s) =>
        Math.max(0, (new Date(s.ended_at!).getTime() - new Date(s.started_at!).getTime()) / 60000)
      );
    const avgInspectionMinutes = completedTimes.length
      ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length
      : 0;

    // Ranking de inspectores
    const inspectorMap: Record<string, { id: string; name: string; total: number; completed: number; scheduled: number; active: number; avgMinutes: number }> = {};
    const inspectorTimes: Record<string, number[]> = {};
    allSessions.forEach((s) => {
      const id = s.inspector_id;
      if (!id) return;
      const name = users?.find((u) => u.id === id)?.full_name || "Sin nombre";
      if (!inspectorMap[id]) {
        inspectorMap[id] = { id, name, total: 0, completed: 0, scheduled: 0, active: 0, avgMinutes: 0 };
        inspectorTimes[id] = [];
      }
      inspectorMap[id].total++;
      if (s.status === "completed") {
        inspectorMap[id].completed++;
        if (s.started_at && s.ended_at) {
          const mins = Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
          inspectorTimes[id].push(mins);
        }
      }
      if (s.status === "scheduled") inspectorMap[id].scheduled++;
      if (s.status === "active") inspectorMap[id].active++;
    });
    Object.entries(inspectorTimes).forEach(([id, times]) => {
      if (times.length) inspectorMap[id].avgMinutes = times.reduce((a, b) => a + b, 0) / times.length;
    });
    const topInspectors = Object.values(inspectorMap).sort((a, b) => b.completed - a.completed);

    // Top compañias por inspecciones
    const claimMap = new Map(allClaims.map((c) => [c.id, c]));
    const companyMap: Record<string, { id: string; name: string; total: number }> = {};
    allSessions.forEach((s) => {
      const claim = s.claim_id ? claimMap.get(s.claim_id) : undefined;
      const id = claim?.insurance_company_id || "unknown";
      const name = claim?.insurance_company?.name || "Sin compañía";
      if (!companyMap[id]) companyMap[id] = { id, name, total: 0 };
      companyMap[id].total++;
    });
    const topCompaniesByInspections = Object.values(companyMap).sort((a, b) => b.total - a.total);

    // Metrics personales
    const personalSessions = !isGlobalUser && profile
      ? allSessions.filter((s) => s.inspector_id === profile.id)
      : allSessions;
    const myTotalSessions = personalSessions.length;
    const myActiveSessions = personalSessions.filter((s) => s.status === "active").length;
    const myScheduledSessions = personalSessions.filter((s) => s.status === "scheduled").length;
    const myCompletedSessions = personalSessions.filter((s) => s.status === "completed").length;
    const now = new Date();
    const monthsData: Array<{ name: string; value: number; value2: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = monthDate.toLocaleDateString("es-CL", { month: "short" });

      const monthClaims = allClaims.filter((c: LightClaim) => {
        const d = new Date(c.claim_date || c.created_at);
        return d >= monthDate && d <= monthEnd;
      });

      const monthInspections = allSessions.filter((s: LightSession) => {
        if (!s.scheduled_at) return false;
        const d = new Date(s.scheduled_at);
        return d >= monthDate && d <= monthEnd;
      });

      monthsData.push({
        name: monthLabel,
        value: monthClaims.length,
        value2: monthInspections.length,
      });
    }

    // Claims por día de la semana (para barras)
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const claimsByDay: Array<{ name: string; value: number }> = dayNames.map(d => ({ name: d, value: 0 }));
    allClaims.forEach((c: LightClaim) => {
      const d = new Date(c.claim_date || c.created_at);
      claimsByDay[d.getDay()].value++;
    });

    // Inspecciones por día de la semana
    const inspectionsByDay: Array<{ name: string; value: number }> = dayNames.map(d => ({ name: d, value: 0 }));
    allSessions.forEach((s) => {
      const d = s.scheduled_at || s.started_at || s.ended_at;
      if (d) inspectionsByDay[new Date(d).getDay()].value++;
    });

    // Inspecciones por región (con 4 estados + country_id para filtro)
    const inspByRegionMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number; country_id: string | null }> = {};
    allSessions.forEach((s) => {
      const claim = s.claim_id ? claimMapForCompany.get(s.claim_id) : undefined;
      const region = claim?.region?.name || "Sin región";
      const countryId = claim?.region?.country_id || null;
      if (!inspByRegionMap[region]) inspByRegionMap[region] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0, country_id: countryId };
      if (s.status === "scheduled") inspByRegionMap[region].agendadas++;
      else if (s.status === "active") inspByRegionMap[region].enProceso++;
      else if (s.status === "completed") inspByRegionMap[region].completadas++;
      else if (s.status === "cancelled") inspByRegionMap[region].canceladas++;
    });
    const inspectionsByRegion = Object.entries(inspByRegionMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.agendadas + b.enProceso + b.completadas + b.canceladas) - (a.agendadas + a.enProceso + a.completadas + a.canceladas))
      .slice(0, 8);

    // Inspecciones por comuna (top 10, con 4 estados)
    const inspByCommuneMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    allSessions.forEach((s) => {
      const claim = s.claim_id ? claimMapForCompany.get(s.claim_id) : undefined;
      const commune = claim?.commune?.name || "Sin comuna";
      if (!inspByCommuneMap[commune]) inspByCommuneMap[commune] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (s.status === "scheduled") inspByCommuneMap[commune].agendadas++;
      else if (s.status === "active") inspByCommuneMap[commune].enProceso++;
      else if (s.status === "completed") inspByCommuneMap[commune].completadas++;
      else if (s.status === "cancelled") inspByCommuneMap[commune].canceladas++;
    });
    const inspectionsByCommune = Object.entries(inspByCommuneMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.agendadas + b.enProceso + b.completadas + b.canceladas) - (a.agendadas + a.enProceso + a.completadas + a.canceladas))
      .slice(0, 10);

    // Tiempo promedio por inspector (minutos)
    const timeByInspectorMap: Record<string, number[]> = {};
    allSessions.forEach((s) => {
      if (s.status !== "completed" || !s.started_at || !s.ended_at) return;
      const inspectorName = users?.find((u) => u.id === s.inspector_id)?.full_name || "Sin inspector";
      const mins = Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
      if (!timeByInspectorMap[inspectorName]) timeByInspectorMap[inspectorName] = [];
      timeByInspectorMap[inspectorName].push(mins);
    });
    const avgTimeByInspector = Object.entries(timeByInspectorMap)
      .map(([name, times]) => ({ name, value: Math.round(times.reduce((a, b) => a + b, 0) / times.length) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Siniestros por región
    const claimsByRegionMap: Record<string, number> = {};
    allClaims.forEach((c: LightClaim) => {
      const region = c.region?.name || "Sin región";
      claimsByRegionMap[region] = (claimsByRegionMap[region] || 0) + 1;
    });
    const claimsByRegion = Object.entries(claimsByRegionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Inspecciones sin asignar (sin inspector)
    const unassignedInspections = allSessions.filter((s) => !s.inspector_id).length;
    const scheduledForRate = scheduledSessions.length;
    const completedForRate = completedSessions.length;
    const completionVsScheduledRate = scheduledForRate + completedForRate > 0
      ? (completedForRate / (scheduledForRate + completedForRate)) * 100
      : 0;

    return {
      totalClaims: allClaims.length,
      openClaims: openClaims.length,
      closedClaims: closedClaims.length,
      createdClaims: createdClaims.length,
      adjustmentClaims: adjustmentClaims.length,
      avgResolutionDays,
      closeRate,
      scheduledSessions: scheduledSessions.length,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      cancelledSessions: cancelledSessions.length,
      totalSessions: allSessions.length,
      inspectionCompletionRate,
      claimsByStatus,
      topCompanies,
      topRamos,
      topAdjusters,
      topDispatchers,
      topAuditors,
      inspectionsByStatus,
      monthsData,
      claimsByDay,
      inspectionsByDay,
      inspectionsByRegion,
      inspectionsByCommune,
      avgTimeByInspector,
      claimsByRegion,
      unassignedInspections,
      completionVsScheduledRate,
      totalCompanies: companiesCount ?? 0,
      totalUsers: users?.length ?? 0,
      activeUsers: users?.filter((u) => u.is_active)?.length ?? 0,
      // Nuevas métricas de inspecciones
      inspectionsToday,
      scheduledToday,
      completedToday,
      overdueSessions,
      avgInspectionMinutes,
      topInspectors,
      topCompaniesByInspections,
      myTotalSessions,
      myActiveSessions,
      myScheduledSessions,
      myCompletedSessions,
    };
  }, [myClaims, sessionList, companiesCount, users, statusCode, isGlobalUser, profile, STATUS_COLORS, isAurora, LOCATION_COLORS]);

  // Setear el país inicial al primero que tenga inspecciones
  // Patrón render-time (evita setState-in-effect): ajustamos el estado cuando
  // cambian los datos, comparando con el valor previo para no looping.
  const [prevCountryInit, setPrevCountryInit] = useState<string>("__all");
  if (
    selectedCountryId === "__all" &&
    stats.inspectionsByRegion.length > 0 &&
    prevCountryInit === "__all"
  ) {
    const firstCountryId = stats.inspectionsByRegion.find((r) => r.country_id)?.country_id;
    if (firstCountryId) {
      setSelectedCountryId(firstCountryId);
      setPrevCountryInit(firstCountryId);
    }
  }

  // ── Datos para los 3 nested donuts de inspecciones por ubicación ──

  const buildDonut = useCallback((map: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }>, selectedName: string | null) => {
    const outer = Object.entries(map)
      .sort((a, b) => (b[1].agendadas + b[1].enProceso + b[1].completadas + b[1].canceladas) - (a[1].agendadas + a[1].enProceso + a[1].completadas + a[1].canceladas))
      .slice(0, 6)
      .map(([name, v], i) => ({
        name,
        value: v.agendadas + v.enProceso + v.completadas + v.canceladas,
        color: LOCATION_COLORS[i % LOCATION_COLORS.length],
      }));

    const selected = outer.find((o) => o.name === selectedName)?.name || outer[0]?.name || null;
    const selectedEntry = selected ? outer.find((o) => o.name === selected) : null;
    const selectedData = selected ? map[selected] : null;
    const totalValue = outer.reduce((sum, o) => sum + o.value, 0);
    const selectedPercent = selectedEntry && totalValue > 0 ? (selectedEntry.value / totalValue) * 100 : 0;
    const inner = selectedData
      ? [
          { name: "Agendadas", value: selectedData.agendadas, color: INSPECTION_STATUS.scheduled },
          { name: "En curso", value: selectedData.enProceso, color: INSPECTION_STATUS.inProgress },
          { name: "Completadas", value: selectedData.completadas, color: INSPECTION_STATUS.completed },
          { name: "Canceladas", value: selectedData.canceladas, color: INSPECTION_STATUS.cancelled },
        ].filter((d) => d.value > 0)
      : [];

    return { outer, inner, selectedName: selected, selectedPercent };
  }, [LOCATION_COLORS, INSPECTION_STATUS]);

  const locationDonuts = useMemo(() => {
    const claimMap = new Map(myClaims.map((c) => [c.id, c]));
    const regionMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    const cityMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    const communeMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};

    sessionList.forEach((s) => {
      const claim = s.claim_id ? claimMap.get(s.claim_id) : undefined;
      const countryId = claim?.region?.country_id;
      if (selectedCountryId !== "__all" && countryId !== selectedCountryId) return;

      const region = claim?.region?.name || "Sin región";
      const city = claim?.commune?.city?.name || "Sin ciudad";
      const commune = claim?.commune?.name || "Sin comuna";

      if (!regionMap[region]) regionMap[region] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (!cityMap[city]) cityMap[city] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (!communeMap[commune]) communeMap[commune] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };

      if (s.status === "scheduled") { regionMap[region].agendadas++; cityMap[city].agendadas++; communeMap[commune].agendadas++; }
      else if (s.status === "active") { regionMap[region].enProceso++; cityMap[city].enProceso++; communeMap[commune].enProceso++; }
      else if (s.status === "completed") { regionMap[region].completadas++; cityMap[city].completadas++; communeMap[commune].completadas++; }
      else if (s.status === "cancelled") { regionMap[region].canceladas++; cityMap[city].canceladas++; communeMap[commune].canceladas++; }
    });

    // Filtrar ciudad y comuna por región seleccionada
    const regionKey = selectedRegion || Object.keys(regionMap)[0];
    const filteredCityMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    const filteredCommuneMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};

    sessionList.forEach((s) => {
      const claim = s.claim_id ? claimMap.get(s.claim_id) : undefined;
      const countryId = claim?.region?.country_id;
      if (selectedCountryId !== "__all" && countryId !== selectedCountryId) return;
      if ((claim?.region?.name || "Sin región") !== regionKey) return;
      const city = claim?.commune?.city?.name || "Sin ciudad";
      const commune = claim?.commune?.name || "Sin comuna";
      if (!filteredCityMap[city]) filteredCityMap[city] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (!filteredCommuneMap[commune]) filteredCommuneMap[commune] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (s.status === "scheduled") { filteredCityMap[city].agendadas++; filteredCommuneMap[commune].agendadas++; }
      else if (s.status === "active") { filteredCityMap[city].enProceso++; filteredCommuneMap[commune].enProceso++; }
      else if (s.status === "completed") { filteredCityMap[city].completadas++; filteredCommuneMap[commune].completadas++; }
      else if (s.status === "cancelled") { filteredCityMap[city].canceladas++; filteredCommuneMap[commune].canceladas++; }
    });

    const cityKey = selectedCity || Object.keys(filteredCityMap)[0];
    const finalCommuneMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    sessionList.forEach((s) => {
      const claim = s.claim_id ? claimMap.get(s.claim_id) : undefined;
      const countryId = claim?.region?.country_id;
      if (selectedCountryId !== "__all" && countryId !== selectedCountryId) return;
      if ((claim?.region?.name || "Sin región") !== regionKey) return;
      if ((claim?.commune?.city?.name || "Sin ciudad") !== cityKey) return;
      const commune = claim?.commune?.name || "Sin comuna";
      if (!finalCommuneMap[commune]) finalCommuneMap[commune] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
      if (s.status === "scheduled") finalCommuneMap[commune].agendadas++;
      else if (s.status === "active") finalCommuneMap[commune].enProceso++;
      else if (s.status === "completed") finalCommuneMap[commune].completadas++;
      else if (s.status === "cancelled") finalCommuneMap[commune].canceladas++;
    });

    return {
      region: buildDonut(regionMap, selectedRegion),
      city: buildDonut(filteredCityMap, selectedCity),
      commune: buildDonut(finalCommuneMap, selectedCommune),
    };
  }, [myClaims, sessionList, selectedCountryId, selectedRegion, selectedCity, selectedCommune, buildDonut]);

  // Países con siniestros y seteo inicial del primer país
  const siniestrosCountries = useMemo(() => {
    const ids = new Set<string>();
    myClaims.forEach((c) => {
      const id = c.region?.country_id;
      if (id) ids.add(id);
    });
    return Array.from(ids)
      .map((id) => ({
        id,
        name: countries?.find((c) => c.id === id)?.name || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [myClaims, countries]);

  const [prevSiniestroCountryInit, setPrevSiniestroCountryInit] = useState<string | null>(null);
  if (
    selectedSiniestroCountryId === null &&
    siniestrosCountries.length > 0 &&
    prevSiniestroCountryInit === null
  ) {
    const firstCountryId = siniestrosCountries[0].id;
    setSelectedSiniestroCountryId(firstCountryId);
    setPrevSiniestroCountryInit(firstCountryId);
  }
  const siniestrosDonuts = useMemo(() => {
    const businessFallbackColors = LOCATION_COLORS;

    const addClaim = (
      targetMap: Record<string, { value: number; color: string }>,
      businessMap: Record<string, Record<string, { value: number; color: string | null }>>,
      key: string,
      businessLine: string,
      color: string | null,
      index: number
    ) => {
      if (!targetMap[key]) targetMap[key] = { value: 0, color: LOCATION_COLORS[index % LOCATION_COLORS.length] };
      targetMap[key].value++;

      if (!businessMap[key]) businessMap[key] = {};
      if (!businessMap[key][businessLine]) businessMap[key][businessLine] = { value: 0, color };
      businessMap[key][businessLine].value++;
      if (!businessMap[key][businessLine].color && color) businessMap[key][businessLine].color = color;
    };

    const buildBusinessDonut = (
      targetMap: Record<string, { value: number; color: string }>,
      businessMap: Record<string, Record<string, { value: number; color: string | null }>>,
      selectedName: string | null
    ) => {
      const outer = Object.entries(targetMap)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 6)
        .map(([name, v]) => ({ name, value: v.value, color: mapBusinessColor(v.color, v.color, isAurora) }));

      const selected = outer.find((o) => o.name === selectedName)?.name || outer[0]?.name || null;
      const selectedEntry = selected ? outer.find((o) => o.name === selected) : null;
      const totalValue = outer.reduce((sum, o) => sum + o.value, 0);
      const selectedPercent = selectedEntry && totalValue > 0 ? (selectedEntry.value / totalValue) * 100 : 0;

      const businessLines = selected ? businessMap[selected] : {};
      const inner = Object.entries(businessLines || {})
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 6)
        .map(([name, v], i) => ({
          name,
          value: v.value,
          color: mapBusinessColor(v.color, businessFallbackColors[i % businessFallbackColors.length], isAurora),
        }));

      return { outer, inner, selectedName: selected, selectedPercent };
    };

    const claimsForCountry = selectedSiniestroCountryId
      ? myClaims.filter((c) => c.region?.country_id === selectedSiniestroCountryId)
      : [];

    const regionMap: Record<string, { value: number; color: string }> = {};
    const businessByRegion: Record<string, Record<string, { value: number; color: string | null }>> = {};
    const cityMap: Record<string, { value: number; color: string }> = {};
    const businessByCity: Record<string, Record<string, { value: number; color: string | null }>> = {};
    const communeMap: Record<string, { value: number; color: string }> = {};
    const businessByCommune: Record<string, Record<string, { value: number; color: string | null }>> = {};

    claimsForCountry.forEach((c) => {
      const region = c.region?.name || "Sin región";
      const city = c.commune?.city?.name || "Sin ciudad";
      const commune = c.commune?.name || "Sin comuna";
      const businessLine = c.business_line?.name || c.claim_type?.name || "Sin línea de negocio";
      const color = c.business_line?.color || null;

      addClaim(regionMap, businessByRegion, region, businessLine, color, Object.keys(regionMap).length);
      addClaim(cityMap, businessByCity, city, businessLine, color, Object.keys(cityMap).length);
      addClaim(communeMap, businessByCommune, commune, businessLine, color, Object.keys(communeMap).length);
    });

    // Filtrar ciudad y comuna por región seleccionada
    const regionKey = selectedSiniestroRegion || Object.keys(regionMap)[0];
    const filteredCityMap: Record<string, { value: number; color: string }> = {};
    const filteredBusinessByCity: Record<string, Record<string, { value: number; color: string | null }>> = {};
    const filteredCommuneMap: Record<string, { value: number; color: string }> = {};
    const filteredBusinessByCommune: Record<string, Record<string, { value: number; color: string | null }>> = {};

    claimsForCountry.forEach((c) => {
      if ((c.region?.name || "Sin región") !== regionKey) return;
      const city = c.commune?.city?.name || "Sin ciudad";
      const commune = c.commune?.name || "Sin comuna";
      const businessLine = c.business_line?.name || c.claim_type?.name || "Sin línea de negocio";
      const color = c.business_line?.color || null;
      addClaim(filteredCityMap, filteredBusinessByCity, city, businessLine, color, Object.keys(filteredCityMap).length);
      addClaim(filteredCommuneMap, filteredBusinessByCommune, commune, businessLine, color, Object.keys(filteredCommuneMap).length);
    });

    const cityKey = selectedSiniestroCity || Object.keys(filteredCityMap)[0];
    const finalCommuneMap: Record<string, { value: number; color: string }> = {};
    const finalBusinessByCommune: Record<string, Record<string, { value: number; color: string | null }>> = {};

    claimsForCountry.forEach((c) => {
      if ((c.region?.name || "Sin región") !== regionKey) return;
      if ((c.commune?.city?.name || "Sin ciudad") !== cityKey) return;
      const commune = c.commune?.name || "Sin comuna";
      const businessLine = c.business_line?.name || c.claim_type?.name || "Sin línea de negocio";
      const color = c.business_line?.color || null;
      addClaim(finalCommuneMap, finalBusinessByCommune, commune, businessLine, color, Object.keys(finalCommuneMap).length);
    });

    return {
      region: buildBusinessDonut(regionMap, businessByRegion, selectedSiniestroRegion),
      city: buildBusinessDonut(filteredCityMap, filteredBusinessByCity, selectedSiniestroCity),
      commune: buildBusinessDonut(finalCommuneMap, finalBusinessByCommune, selectedSiniestroCommune),
      hasData: claimsForCountry.length > 0,
    };
  }, [myClaims, selectedSiniestroCountryId, selectedSiniestroRegion, selectedSiniestroCity, selectedSiniestroCommune, LOCATION_COLORS, isAurora]);

  // KPIs globales: foco en inspecciones
  const kpis = isGlobalUser
    ? [
        {
          label: "Inspecciones Hoy",
          value: stats.inspectionsToday,
          icon: KpiTodayIcon,
          color: "blue",
          trend: "neutral" as const,
          trendValue: "Hoy",
          detailKey: "today" as const,
          detailTitle: "Inspecciones del día",
        },
        {
          label: "En Curso",
          value: stats.activeSessions,
          icon: KpiActiveIcon,
          color: "amber",
          trend: stats.activeSessions > 5 ? "up" as const : "neutral" as const,
          trendValue: stats.activeSessions > 5 ? "Alto" : "Normal",
          detailKey: "active" as const,
          detailTitle: "Inspecciones en curso",
        },
        {
          label: "Agendadas Hoy",
          value: stats.scheduledToday,
          icon: KpiScheduledIcon,
          color: "violet",
          trend: "neutral" as const,
          trendValue: "Pendientes",
          detailKey: "scheduled-today" as const,
          detailTitle: "Inspecciones agendadas para hoy",
        },
        {
          label: "Completadas Hoy",
          value: stats.completedToday,
          icon: KpiCompletedIcon,
          color: "emerald",
          trend: stats.completedToday > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.completedToday > 0 ? "Progreso" : "Sin",
          detailKey: "completed-today" as const,
          detailTitle: "Inspecciones completadas hoy",
        },
        {
          label: "Con Retraso",
          value: stats.overdueSessions,
          icon: KpiOverdueIcon,
          color: "pink",
          trend: stats.overdueSessions > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.overdueSessions > 0 ? "Alerta" : "OK",
          detailKey: "overdue" as const,
          detailTitle: "Inspecciones con retraso",
        },
        {
          label: "Tiempo Promedio",
          value: formatDuration(stats.avgInspectionMinutes),
          icon: KpiTimeIcon,
          color: "sky",
          trend: "neutral" as const,
          trendValue: "Por inspección",
          detailKey: "avg-time" as const,
          detailTitle: "Tiempos de inspección",
        },
      ]
    : [
        {
          label: "Mis Inspecciones",
          value: stats.myTotalSessions,
          icon: KpiTodayIcon,
          color: "blue",
          trend: "neutral" as const,
          trendValue: "Asignadas",
          detailKey: "my-total" as const,
          detailTitle: "Mis inspecciones",
        },
        {
          label: "En Curso",
          value: stats.myActiveSessions,
          icon: KpiActiveIcon,
          color: "amber",
          trend: stats.myActiveSessions > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.myActiveSessions > 0 ? "Activa" : "Sin",
          detailKey: "my-active" as const,
          detailTitle: "Mis inspecciones en curso",
        },
        {
          label: "Agendadas",
          value: stats.myScheduledSessions,
          icon: KpiScheduledIcon,
          color: "violet",
          trend: "neutral" as const,
          trendValue: "Pendientes",
          detailKey: "my-scheduled" as const,
          detailTitle: "Mis inspecciones agendadas",
        },
        {
          label: "Completadas",
          value: stats.myCompletedSessions,
          icon: KpiCompletedIcon,
          color: "emerald",
          trend: "up" as const,
          trendValue: "Cerradas",
          detailKey: "my-completed" as const,
          detailTitle: "Mis inspecciones completadas",
        },
      ];

  // Subtítulo contextual según el rol
  const subtitle = isGlobalUser
    ? "Panel de gestión visual — métricas globales en tiempo real"
    : `Tus casos asignados — ${roleLabel.toLowerCase()}`;

  // Modal de detalle de KPI
  const [kpiModal, setKpiModal] = useState<{ title: string; key: string } | null>(null);

  const kpiDetailRows = useMemo<KpiDetailRow[]>(() => {
    if (!kpiModal) return [];
    const claimMap = new Map(myClaims.map((c) => [c.id, c]));
    const getName = (id: string | null) =>
      users?.find((u) => u.id === id)?.full_name || "Sin asignar";

    const sessions = sessionList;

    const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CL");
    const fmtTime = (d: string) =>
      new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const getBase = (s: (typeof sessions)[number]) => {
      const claim = s.claim_id ? claimMap.get(s.claim_id) : undefined;
      const date = s.scheduled_at || s.started_at || s.ended_at;
      const liq = claim?.liquidation_number || "—";
      const shortLiq = liq.startsWith("L-") ? liq.slice(2) : liq;
      const insured = claim?.claims_participants?.find((p) => p.type === "insured")?.full_name || "—";
      // Regla AGENTS.md: si la liquidación se muestra en el mismo contexto,
      // el código de gestión debe ser el CORTO (solo gestión, sin prefijo de liquidación)
      const rawCode = s.inspection_number || `I-${s.id.slice(0, 4)}`;
      const shortCode = rawCode.match(/^L-\d+-/) ? rawCode.replace(/^L-\d+-/, "") : rawCode;
      return {
        id: s.id,
        inspectionCode: shortCode,
        liquidation: shortLiq,
        insured,
        address: claim?.claim_address || "—",
        inspector: getName(s.inspector_id),
        status: s.status,
        date: date ? fmtDate(date) : "—",
        time: date ? fmtTime(date) : "—",
      };
    };

    switch (kpiModal.key) {
      case "today":
      case "my-total":
        return sessions
          .filter((s) =>
            (s.scheduled_at && isToday(s.scheduled_at)) ||
            (s.started_at && isToday(s.started_at)) ||
            (s.ended_at && isToday(s.ended_at))
          )
          .map((s) => ({ ...getBase(s), scheduled: s.scheduled_at }));
      case "active":
      case "my-active":
        return sessions
          .filter((s) => s.status === "active")
          .map((s) => ({ ...getBase(s), started: s.started_at }));
      case "scheduled-today":
      case "my-scheduled":
        return sessions
          .filter((s) => s.status === "scheduled" && s.scheduled_at && isToday(s.scheduled_at))
          .map((s) => ({ ...getBase(s), scheduled: s.scheduled_at }));
      case "completed-today":
      case "my-completed":
        return sessions
          .filter((s) => s.status === "completed" && s.ended_at && isToday(s.ended_at))
          .map((s) => ({
            ...getBase(s),
            ended: s.ended_at,
            duration:
              s.started_at && s.ended_at
                ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
                : 0,
          }));
      case "overdue":
        return sessions
          .filter((s) => (s.status === "scheduled" || s.status === "active") && s.scheduled_at && new Date(s.scheduled_at) < new Date())
          .map((s) => ({ ...getBase(s), scheduled: s.scheduled_at }));
      case "avg-time":
        return sessions
          .filter((s) => s.status === "completed" && s.started_at && s.ended_at)
          .map((s) => ({
            ...getBase(s),
            ended: s.ended_at,
            duration: Math.round((new Date(s.ended_at!).getTime() - new Date(s.started_at!).getTime()) / 60000),
          }))
          .sort((a, b) => b.duration - a.duration);
      default:
        return [];
    }
  }, [kpiModal, myClaims, sessionList, users]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {isGlobalUser ? "Dashboard" : "Mi Panel"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isGlobalUser && profile && (
            <div className="glass-panel px-3 py-2 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">{profile.full_name}</span>
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                {roleLabel}
              </span>
            </div>
          )}
          <div className="glass-panel px-3 py-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">En vivo</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* KPI Cards — resumen rápido */}
      {(claimsLoading || sessionsLoading) ? (
        <KpiGridSkeleton count={isGlobalUser ? 6 : 4} />
      ) : (
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${isGlobalUser ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`kpi-card kpi-glow-${kpi.color} cursor-pointer transition-transform hover:scale-[1.01]`}
              onClick={() =>
                setKpiModal({
                  title: (kpi as { detailTitle: string }).detailTitle,
                  key: (kpi as { detailKey: string }).detailKey,
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setKpiModal({
                    title: (kpi as { detailTitle: string }).detailTitle,
                    key: (kpi as { detailKey: string }).detailKey,
                  });
                }
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <div className="-ml-2 shrink-0">
                  <Icon />
                </div>
                <div className="kpi-value flex-1 text-center">{kpi.value}</div>
              </div>
              <div className="text-center text-sm font-medium text-foreground/80 mt-2">{kpi.label}</div>
            </div>
          );
        })}
      </div>
      )}

      {/* Empty state para usuarios sin casos */}
      {stats.totalClaims === 0 && !isGlobalUser && (
        <div className="glass-panel glass-glow-blue-soft">
          <div className="glass-panel-body flex flex-col items-center justify-center py-16">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-base font-medium text-muted-foreground">No tienes casos asignados</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Cuando te asignen siniestros, verás aquí tus métricas y gráficos.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN: INSPECCIONES
          Top Inspectores + Por Estado + Por Región + Por Comuna + Por Día + Tiempo por Región + Tasa Cancelación
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && (
        <>
          <div className="dash-section-header">
            <ClipboardCheck className="h-4.5 w-4.5" />
            <span className="dash-section-title">Inspecciones</span>
            <div className="dash-section-line" />
            <span className="dash-section-count">{stats.totalSessions} sesiones</span>
          </div>

          {/* Row 1: Por Día de la Semana + Por Estado + Tasa Cancelación */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-4 glass-glow-pink">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Calendar className="h-4 w-4" />
                  Por Día de la Semana
                </div>
              </div>
              <div className="glass-panel-body">
                <SplineAreaChart
                  data={stats.inspectionsByDay}
                  color={isAurora ? "#00f2ff" : "#ec4899"}
                />
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-amber">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Activity className="h-4 w-4" />
                  Por Estado
                </div>
              </div>
              <div className="glass-panel-body">
                <BarChartGlass
                  data={stats.inspectionsByStatus}
                  color="#8b5cf6"
                />
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-rose">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <AlertCircle className="h-4 w-4" />
                  Tasa de Completadas vs Programadas
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight text-rose-500">
                  {stats.completionVsScheduledRate.toFixed(0)}%
                </span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {stats.completedSessions} completadas de {stats.completedSessions + stats.scheduledSessions} programadas
                </p>
                <div className="mt-4 w-full grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center rounded-lg bg-emerald-500/5 border border-emerald-500/10 py-2">
                    <span className="text-lg font-bold text-emerald-500">{stats.completedSessions}</span>
                    <span className="text-[10px] text-muted-foreground">Completadas</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-blue-500/5 border border-blue-500/10 py-2">
                    <span className="text-lg font-bold text-blue-500">{stats.scheduledSessions}</span>
                    <span className="text-[10px] text-muted-foreground">Programadas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Inspecciones por Ubicación — 3 nested donuts interconectados en una sola card */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-12 glass-glow-sky">
              <div className="glass-panel-header dash-location-header">
                <div className="glass-panel-title">
                  <MapPin className="h-4 w-4" />
                  Inspecciones por Ubicación
                </div>
                {countries && countries.length > 0 && (() => {
                  const activeCountries = countries.filter((c) => myClaims.some((claim) => claim.region?.country_id === c.id));
                  if (activeCountries.length === 0) return null;
                  return (
                    <Select
                      value={selectedCountryId}
                      onValueChange={(v) => { setSelectedCountryId(v ?? "__all"); setSelectedRegion(null); setSelectedCity(null); setSelectedCommune(null); }}
                    >
                      <SelectTrigger className="dash-filter-select">
                        <SelectValue placeholder="Todos los países" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all">Todos los países</SelectItem>
                        {activeCountries.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
                {/* Leyenda única de estados de inspección (flotante, común a los 3 donuts) */}
                <div className="dash-location-legend">
                  <span className="dash-location-legend-item">
                    <span className="dash-location-legend-dot dash-legend-dot-scheduled" />
                    Agendadas
                  </span>
                  <span className="dash-location-legend-item">
                    <span className="dash-location-legend-dot dash-legend-dot-active" />
                    En curso
                  </span>
                  <span className="dash-location-legend-item">
                    <span className="dash-location-legend-dot dash-legend-dot-completed" />
                    Completadas
                  </span>
                  <span className="dash-location-legend-item">
                    <span className="dash-location-legend-dot dash-legend-dot-cancelled" />
                    Canceladas
                  </span>
                </div>
              </div>
              <div className="glass-panel-body">
                <div className="dash-location-grid">
                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Región
                    </div>
                    {locationDonuts.region.outer.length > 0 ? (
                      <NestedDonutChart
                        data={locationDonuts.region}
                        onSliceClick={(name) => { setSelectedRegion(name); setSelectedCity(null); setSelectedCommune(null); }}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>

                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Ciudad
                    </div>
                    {locationDonuts.city.outer.length > 0 ? (
                      <NestedDonutChart
                        data={locationDonuts.city}
                        onSliceClick={(name) => { setSelectedCity(name); setSelectedCommune(null); }}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>

                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Comuna
                    </div>
                    {locationDonuts.commune.outer.length > 0 ? (
                      <NestedDonutChart
                        data={locationDonuts.commune}
                        onSliceClick={(name) => setSelectedCommune(name)}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Top Inspectores + Tiempo por Inspector */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-6 glass-glow-violet">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <UserCheck className="h-4 w-4" />
                  Top Inspectores
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topInspectors.length > 0 ? (
                  <BarChartQuad
                    data={stats.topInspectors.slice(0, 6).map((i) => ({
                      name: i.name,
                      agendadas: i.scheduled,
                      enProceso: i.active,
                      completadas: i.completed,
                      canceladas: Math.max(0, i.total - i.completed - i.scheduled - i.active),
                    }))}
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-6 glass-glow-amber">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Timer className="h-4 w-4" />
                  Tiempo Promedio por Inspector
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.avgTimeByInspector.length > 0 ? (
                  <BarChartGlass
                    data={stats.avgTimeByInspector.map((r) => ({
                      name: r.name,
                      value: r.value,
                      label: formatDuration(r.value),
                    }))}
                    color="#f59e0b"
                    horizontal
                    valueInside
                    tickFormatter={formatDuration}
                    seriesName="Duración"
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN: SINIESTROS
          Por Estado + Por Ramo + Por Región + Top Liquidadores + Top Despachadores + Top Revisores
          ═══════════════════════════════════════════════════════════════ */}
      {siniestrosDonuts.hasData && (
        <>
          <div className="dash-section-header">
            <FileText className="h-4.5 w-4.5" />
            <span className="dash-section-title">Siniestros</span>
            <div className="dash-section-line" />
            <span className="dash-section-count">{myClaims.length} casos</span>
          </div>

          {/* Row 1: Siniestros por Ubicación — 3 nested donuts (Región > Ciudad > Comuna) con Línea de Negocio interior */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-12 glass-glow-sky">
              <div className="glass-panel-header dash-location-header">
                <div className="glass-panel-title">
                  <MapPin className="h-4 w-4" />
                  Siniestros por Ubicación y Línea de Negocio
                </div>
                {siniestrosCountries.length > 0 && (
                  <Select
                    value={selectedSiniestroCountryId || ""}
                    onValueChange={(v) => {
                      setSelectedSiniestroCountryId(v);
                      setSelectedSiniestroRegion(null);
                      setSelectedSiniestroCity(null);
                      setSelectedSiniestroCommune(null);
                      setPrevSiniestroCountryInit(v);
                    }}
                  >
                    <SelectTrigger className="dash-filter-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {siniestrosCountries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Leyenda flotante de líneas de negocio */}
                <div className="dash-location-legend dash-siniestros-legend">
                  {siniestrosDonuts.region.inner.map((entry) => (
                    <span key={entry.name} className="dash-location-legend-item">
                      <span
                        className="dash-location-legend-dot dash-siniestros-legend-dot"
                        style={{ background: entry.color, boxShadow: isAurora ? `0 0 8px ${entry.color}80` : undefined }}
                      />
                      {entry.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="glass-panel-body">
                <div className="dash-location-grid">
                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Región
                    </div>
                    {siniestrosDonuts.region.outer.length > 0 ? (
                      <NestedDonutChart
                        data={siniestrosDonuts.region}
                        onSliceClick={(name) => { setSelectedSiniestroRegion(name); setSelectedSiniestroCity(null); setSelectedSiniestroCommune(null); }}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>

                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Ciudad
                    </div>
                    {siniestrosDonuts.city.outer.length > 0 ? (
                      <NestedDonutChart
                        data={siniestrosDonuts.city}
                        onSliceClick={(name) => { setSelectedSiniestroCity(name); setSelectedSiniestroCommune(null); }}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>

                  <div className="dash-location-col">
                    <div className="dash-location-col-title">
                      <MapPin className="h-3.5 w-3.5" />
                      Comuna
                    </div>
                    {siniestrosDonuts.commune.outer.length > 0 ? (
                      <NestedDonutChart
                        data={siniestrosDonuts.commune}
                        onSliceClick={(name) => setSelectedSiniestroCommune(name)}
                        showLegend={false}
                        label="Seleccionada"
                      />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Top Liquidadores + Sistema (Top Compañías casos vs inspecciones) */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-4 glass-glow-violet">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <FilePen className="h-4 w-4" />
                  Top Liquidadores
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topAdjusters.length > 0 ? (
                  <BarChartGlass
                    data={stats.topAdjusters.map((a) => ({ name: a.name, value: a.count }))}
                    color="#8b5cf6"
                    horizontal
                    seriesName="Siniestros"
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-8 glass-glow-sky">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Building2 className="h-4 w-4" />
                  Liquidaciones por Compañía
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topCompanies.length > 0 ? (
                  <BarChartGlass
                    data={stats.topCompanies.map((c) => ({ name: c.name, value: c.value }))}
                    color="#0095DA"
                    horizontal
                    seriesName="Siniestros"
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!kpiModal} onOpenChange={() => setKpiModal(null)}>
        <DialogContent className="modal-xl" showCloseButton>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              <span className="modal-title-icon">
                <Layers className="h-4 w-4" />
              </span>
              {kpiModal?.title}
            </DialogTitle>
          </div>
          <div className="modal-body modal-body-flush">
            {kpiDetailRows.length === 0 ? (
              <div className="py-12 text-center text-[11px] text-muted-foreground">Sin datos para mostrar</div>
            ) : (
              <div className="app-data-table-wrap modal-grid-wrap">
                <table className="app-data-table">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Inspección</th>
                      <th className="whitespace-nowrap">Liquidación</th>
                      <th className="whitespace-nowrap">Asegurado</th>
                      <th className="whitespace-nowrap">Dirección</th>
                      <th className="whitespace-nowrap">Inspector</th>
                      {kpiModal?.key === "overdue" && <th className="whitespace-nowrap">Estado</th>}
                      {kpiModal?.key === "avg-time" && <th className="text-right whitespace-nowrap">Duración</th>}
                      <th className="text-right whitespace-nowrap">Fecha</th>
                      <th className="text-right whitespace-nowrap">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiDetailRows.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td className="font-mono whitespace-nowrap">{row.inspectionCode}</td>
                        <td className="font-mono whitespace-nowrap">{row.liquidation}</td>
                        <td className="whitespace-nowrap">{row.insured}</td>
                        <td className="max-w-xs truncate">
                          <Tooltip>
                            <TooltipTrigger render={<span className="truncate block" />}>{row.address}</TooltipTrigger>
                            <TooltipContent side="top"><p>{row.address}</p></TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="whitespace-nowrap">{row.inspector}</td>
                        {kpiModal?.key === "overdue" && (
                          <td className="whitespace-nowrap capitalize">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              row.status === "active" ? "bg-amber-100 text-amber-700" :
                              row.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {row.status === "active" ? "En curso" : row.status === "scheduled" ? "Agendada" : row.status}
                            </span>
                          </td>
                        )}
                        {kpiModal?.key === "avg-time" && (
                          <td className="text-right font-mono whitespace-nowrap">
                            {row.duration != null ? formatDuration(row.duration) : "—"}
                          </td>
                        )}
                        <td className="text-right text-muted-foreground whitespace-nowrap">{row.date}</td>
                        <td className="text-right text-muted-foreground whitespace-nowrap">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="modal-footer">
            {kpiDetailRows.length > 10 ? (
              <span className="text-[11px] text-muted-foreground mr-auto">
                Muestra parcial — primeros 10 registros de {kpiDetailRows.length}
              </span>
            ) : kpiDetailRows.length > 0 ? (
              <span className="text-[11px] text-muted-foreground mr-auto">
                {kpiDetailRows.length} registro{kpiDetailRows.length !== 1 ? "s" : ""}
              </span>
            ) : null}
            <button type="button" className="pg-btn-platinum" onClick={() => setKpiModal(null)}>
              Cerrar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
