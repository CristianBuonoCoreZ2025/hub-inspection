"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getClaims } from "@/services/claims";
import { getInspectionSessions } from "@/services/inspections";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import { userTypeLabels } from "@/services/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
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
  Navigation,
  ScrollText,
  MapPin,
} from "lucide-react";
import { KpiTodayIcon, KpiActiveIcon, KpiScheduledIcon, KpiCompletedIcon, KpiOverdueIcon, KpiTimeIcon } from "@/components/dashboard/kpi-icons";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import type { Claim, InspectionSession, UserRole, Profile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { BarChartGlass } from "@/components/dashboard/bar-chart";
import { BarChartDual } from "@/components/dashboard/bar-chart-dual";
import { BarChartQuad } from "@/components/dashboard/bar-chart-quad";

const STATUS_COLORS: Record<string, string> = {
  created: "#3b82f6",
  adjustment: "#f59e0b",
  dispatchment: "#8b5cf6",
  closed: "#10b981",
  reopened: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  created: "Creado",
  adjustment: "Liquidación",
  dispatchment: "Despacho",
  closed: "Cerrado",
  reopened: "Reabierto",
};

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

/**
 * Filtra los claims según el rol del usuario:
 * - internal: ve todo
 * - otros roles: solo claims donde participa en alguno de los roles asignados
 */
function filterClaimsForUser(
  allClaims: Claim[],
  profile: { id: string; role: UserRole; company_id: string | null } | null | undefined
): Claim[] {
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

export default function DashboardPage() {
  const { profile } = useAuth();
  const { statusCode } = useClaimStatuses();
  useRealtime("claims", [["claims"], ["claims-all"]]);
  useRealtime("inspection_sessions", [["inspection-sessions"], ["inspection-sessions-all"]]);
  useRealtime("audit_logs", [["recent-activity"]]);

  const isGlobalUser = profile?.role === "internal";
  const roleLabel = profile ? userTypeLabels[profile.role] : "";

  const { data: claims } = useQuery<Claim[]>({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
    enabled: !!profile,
  });

  const { data: sessions } = useQuery<InspectionSession[]>({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
    enabled: !!profile,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
    enabled: !!profile,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
    enabled: !!profile,
  });

  // Filtrar claims según el rol del usuario
  const myClaims = useMemo(
    () => filterClaimsForUser(claims ?? [], profile),
    [claims, profile]
  );

  // Las sesiones ya vienen filtradas por RLS (is_session_accessible).
  // No se recortan por claims para que un inspector asignado a una inspección
  // la vea aunque no tenga acceso al siniestro asociado.
  const sessionList = useMemo(() => sessions ?? [], [sessions]);

  const stats = useMemo(() => {
    const allClaims = myClaims;
    const allSessions = sessionList;

    const closedClaims = allClaims.filter(
      (c: Claim) => statusCode(c.status_id) === "closed"
    );
    const openClaims = allClaims.filter(
      (c: Claim) => statusCode(c.status_id) !== "closed"
    );
    const createdClaims = allClaims.filter(
      (c: Claim) => statusCode(c.status_id) === "created"
    );
    const adjustmentClaims = allClaims.filter(
      (c: Claim) => statusCode(c.status_id) === "adjustment"
    );

    // Tiempo promedio de resolución
    let avgResolutionDays = 0;
    if (closedClaims.length > 0) {
      const totalDays = closedClaims.reduce((sum: number, c: Claim) => {
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
      (s: InspectionSession) =>
        s.status === "scheduled" &&
        s.scheduled_at &&
        new Date(s.scheduled_at) >= new Date()
    );
    const activeSessions = allSessions.filter(
      (s: InspectionSession) => s.status === "active"
    );
    const completedSessions = allSessions.filter(
      (s: InspectionSession) => s.status === "completed"
    );
    const cancelledSessions = allSessions.filter(
      (s: InspectionSession) => s.status === "cancelled"
    );

    // Tasa de completitud de inspecciones
    const inspectionCompletionRate =
      allSessions.length > 0
        ? (completedSessions.length / allSessions.length) * 100
        : 0;

    // Claims por estado (para donut)
    const claimsByStatus: Array<{ name: string; value: number; color: string }> = [];
    const statusCounts: Record<string, number> = {};
    allClaims.forEach((c: Claim) => {
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
    allClaims.forEach((c: Claim) => {
      const name = c.insurance_company?.name || "Sin compañía";
      if (!claimsByCompany[name]) claimsByCompany[name] = { claims: 0, inspections: 0 };
      claimsByCompany[name].claims++;
    });
    const claimMapForCompany = new Map(allClaims.map((c) => [c.id, c]));
    allSessions.forEach((s) => {
      const claim = claimMapForCompany.get(s.claim_id);
      const name = claim?.insurance_company?.name || "Sin compañía";
      if (!claimsByCompany[name]) claimsByCompany[name] = { claims: 0, inspections: 0 };
      claimsByCompany[name].inspections++;
    });
    const topCompanies = Object.entries(claimsByCompany)
      .sort((a, b) => b[1].claims - a[1].claims)
      .slice(0, 8)
      .map(([name, v]) => ({ name, value: v.claims, inspections: v.inspections }));

    // Claims por ramo / línea de negocio
    const claimsByRamo: Record<string, number> = {};
    allClaims.forEach((c: Claim) => {
      const name = c.business_line?.name || c.claim_type?.name || "Sin ramo";
      claimsByRamo[name] = (claimsByRamo[name] || 0) + 1;
    });
    const topRamos = Object.entries(claimsByRamo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // Top responsables (liquidador, despachador, revisor)
    const buildTopUsers = (field: "assigned_adjuster_id" | "adjuster_id" | "dispatcher_id" | "auditor_id") => {
      const map: Record<string, { id: string; name: string; count: number }> = {};
      allClaims.forEach((c: Claim) => {
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
      return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
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
      const claim = claimMap.get(s.claim_id);
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

      const monthClaims = allClaims.filter((c: Claim) => {
        const d = new Date(c.claim_date || c.created_at);
        return d >= monthDate && d <= monthEnd;
      });

      const monthInspections = allSessions.filter((s: InspectionSession) => {
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
    allClaims.forEach((c: Claim) => {
      const d = new Date(c.claim_date || c.created_at);
      claimsByDay[d.getDay()].value++;
    });

    // Inspecciones por día de la semana
    const inspectionsByDay: Array<{ name: string; value: number }> = dayNames.map(d => ({ name: d, value: 0 }));
    allSessions.forEach((s) => {
      const d = s.scheduled_at || s.started_at || s.ended_at;
      if (d) inspectionsByDay[new Date(d).getDay()].value++;
    });

    // Inspecciones por región (con 4 estados)
    const inspByRegionMap: Record<string, { agendadas: number; enProceso: number; completadas: number; canceladas: number }> = {};
    allSessions.forEach((s) => {
      const claim = claimMapForCompany.get(s.claim_id);
      const region = claim?.region?.name || "Sin región";
      if (!inspByRegionMap[region]) inspByRegionMap[region] = { agendadas: 0, enProceso: 0, completadas: 0, canceladas: 0 };
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
      const claim = claimMapForCompany.get(s.claim_id);
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
    allClaims.forEach((c: Claim) => {
      const region = c.region?.name || "Sin región";
      claimsByRegionMap[region] = (claimsByRegionMap[region] || 0) + 1;
    });
    const claimsByRegion = Object.entries(claimsByRegionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Inspecciones sin asignar (sin inspector)
    const unassignedInspections = allSessions.filter((s) => !s.inspector_id).length;
    const cancellationRate = allSessions.length > 0
      ? (cancelledSessions.length / allSessions.length) * 100
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
      cancellationRate,
      totalCompanies: companies?.length ?? 0,
      totalUsers: users?.length ?? 0,
      activeUsers: users?.filter((u: Profile) => u.is_active)?.length ?? 0,
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
  }, [myClaims, sessionList, companies, users, statusCode, isGlobalUser, profile]);

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
          value: `${stats.avgInspectionMinutes.toFixed(0)}m`,
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

  // ¿Mostrar sección de sistema (top compañías + actividad)?
  const showSystemSection = isGlobalUser || profile?.role === "adjuster";

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
      const claim = claimMap.get(s.claim_id);
      const date = s.scheduled_at || s.started_at || s.ended_at;
      const liq = claim?.liquidation_number || "—";
      const shortLiq = liq.startsWith("L-") ? liq.slice(2) : liq;
      const insured = claim?.claims_participants?.find((p) => p.type === "insured")?.full_name || "—";
      return {
        id: s.id,
        inspectionCode: s.inspection_number || `I-${s.id.slice(0, 4)}`,
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

          {/* Row 1: Top Inspectores + Por Estado + Tasa Cancelación */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-4 glass-glow-violet">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <UserCheck className="h-4 w-4" />
                  Top Inspectores
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topInspectors.length > 0 ? (
                  <BarChartQuad
                    data={stats.topInspectors.slice(0, 8).map((i) => ({
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
                  Tasa de Cancelación
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight text-rose-500">
                  {stats.cancellationRate.toFixed(0)}%
                </span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {stats.cancelledSessions} canceladas de {stats.totalSessions}
                </p>
                <div className="mt-4 w-full grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center rounded-lg bg-emerald-500/5 border border-emerald-500/10 py-2">
                    <span className="text-lg font-bold text-emerald-500">{stats.completedSessions}</span>
                    <span className="text-[10px] text-muted-foreground">Completadas</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-amber-500/5 border border-amber-500/10 py-2">
                    <span className="text-lg font-bold text-amber-500">{stats.activeSessions}</span>
                    <span className="text-[10px] text-muted-foreground">En curso</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Por Región + Por Comuna */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-6 glass-glow-sky">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <MapPin className="h-4 w-4" />
                  Inspecciones por Región
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.inspectionsByRegion.length > 0 ? (
                  <BarChartQuad
                    data={stats.inspectionsByRegion}
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-6 glass-glow-emerald">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <MapPin className="h-4 w-4" />
                  Inspecciones por Comuna
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.inspectionsByCommune.length > 0 ? (
                  <BarChartQuad
                    data={stats.inspectionsByCommune}
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Por Día + Tiempo por Región */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-6 glass-glow-pink">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Calendar className="h-4 w-4" />
                  Por Día de la Semana
                </div>
              </div>
              <div className="glass-panel-body">
                <BarChartGlass
                  data={stats.inspectionsByDay}
                  color="#ec4899"
                />
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
                      label: `${Math.floor(r.value / 60)}h ${r.value % 60}m`,
                    }))}
                    color="#f59e0b"
                    horizontal
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
      {stats.totalClaims > 0 && (
        <>
          <div className="dash-section-header">
            <FileText className="h-4.5 w-4.5" />
            <span className="dash-section-title">Siniestros</span>
            <div className="dash-section-line" />
            <span className="dash-section-count">{stats.totalClaims} casos</span>
          </div>

          {/* Row 1: Donut (estado) + Por Ramo */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-4 glass-glow-blue">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <FileText className="h-4 w-4" />
                  {isGlobalUser ? "Por Estado" : "Mis Casos por Estado"}
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.claimsByStatus.length > 0 ? (
                  <DonutChart data={stats.claimsByStatus} />
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
                  <Layers className="h-4 w-4" />
                  Por Ramo
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topRamos.length > 0 ? (
                  <BarChartGlass
                    data={stats.topRamos}
                    color="#0095DA"
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Por Región */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-12 glass-glow-violet">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <MapPin className="h-4 w-4" />
                  Siniestros por Región
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.claimsByRegion.length > 0 ? (
                  <BarChartGlass
                    data={stats.claimsByRegion}
                    color="#8b5cf6"
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Top Liquidadores + Top Despachadores + Top Revisores */}
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
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-amber">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Navigation className="h-4 w-4" />
                  Top Despachadores
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topDispatchers.length > 0 ? (
                  <BarChartGlass
                    data={stats.topDispatchers.map((d) => ({ name: d.name, value: d.count }))}
                    color="#f59e0b"
                    horizontal
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-emerald">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <ScrollText className="h-4 w-4" />
                  Top Revisores
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topAuditors.length > 0 ? (
                  <BarChartGlass
                    data={stats.topAuditors.map((a) => ({ name: a.name, value: a.count }))}
                    color="#10b981"
                    horizontal
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
          SECCIÓN: SISTEMA
          Top Compañías (casos vs inspecciones) + Inspecciones sin asignar
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && showSystemSection && (
        <>
          <div className="dash-section-header">
            <Building2 className="h-4.5 w-4.5" />
            <span className="dash-section-title">{isGlobalUser ? "Sistema" : "Mis Compañías"}</span>
            <div className="dash-section-line" />
          </div>

          <div className="dash-grid">
            <div className="glass-panel dash-col-8 glass-glow-sky">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Building2 className="h-4 w-4" />
                  {isGlobalUser ? "Top Compañías" : "Mis Casos por Compañía"}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0095DA]" />
                    Siniestros
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                    Inspecciones
                  </span>
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topCompanies.length > 0 ? (
                  <BarChartDual
                    data={stats.topCompanies.map((c) => ({
                      name: c.name,
                      asignadas: c.value,
                      completadas: c.inspections,
                    }))}
                    horizontal
                    color1="#0095DA"
                    color2="#8b5cf6"
                  />
                ) : (
                  <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-rose">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <AlertCircle className="h-4 w-4" />
                  Sin Asignar
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight text-rose-500">
                  {stats.unassignedInspections}
                </span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Inspecciones sin inspector asignado
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[10px] font-semibold text-rose-500">
                      {stats.totalSessions > 0 ? ((stats.unassignedInspections / stats.totalSessions) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">del total</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!kpiModal} onOpenChange={() => setKpiModal(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-5 py-3 border-b bg-muted/50 shrink-0">
            <DialogTitle className="text-base font-semibold">{kpiModal?.title}</DialogTitle>
          </DialogHeader>
          {kpiDetailRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Sin datos para mostrar</div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/80 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Inspección</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Liquidación</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Asegurado</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Dirección</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Inspector</th>
                    {kpiModal?.key === "overdue" && <th className="px-3 py-2 text-left whitespace-nowrap">Estado</th>}
                    {kpiModal?.key === "avg-time" && <th className="px-3 py-2 text-right whitespace-nowrap">Duración</th>}
                    <th className="px-3 py-2 text-right whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {kpiDetailRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.inspectionCode}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.liquidation}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.insured}</td>
                      <td className="px-3 py-2 max-w-xs truncate" title={row.address}>{row.address}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.inspector}</td>
                      {kpiModal?.key === "overdue" && (
                        <td className="px-3 py-2 whitespace-nowrap capitalize">
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
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {row.duration != null ? `${Math.floor(row.duration / 60)}h ${row.duration % 60}m` : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
