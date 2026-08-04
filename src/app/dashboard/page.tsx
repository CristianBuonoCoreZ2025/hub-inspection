"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { getClaims } from "@/services/claims";
import { getInspectionSessions } from "@/services/inspections";
import { getRecentAuditLogs } from "@/services/audit-logs";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import { userTypeLabels } from "@/services/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Timer,
  TrendingUp,
  TrendingDown,
  Activity,
  ClipboardCheck,
  Building2,
  Shield,
  Zap,
  ChevronRight,
  UserCheck,
  Briefcase,
} from "lucide-react";
import {
  Eye as PhEye,
  Radio as PhRadio,
  CalendarCheck as PhCalendarCheck,
  CheckCircle as PhCheckCircle,
  Warning as PhWarning,
  Hourglass as PhHourglass,
  FolderOpen as PhFolderOpen,
} from "@phosphor-icons/react";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import type { Claim, InspectionSession, AuditLog, UserRole, Profile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { BarChartGlass } from "@/components/dashboard/bar-chart";
import { AreaChartGlass } from "@/components/dashboard/area-chart";
import { GaugeChart } from "@/components/dashboard/gauge-chart";

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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} h`;
  if (diffDay < 7) return `Hace ${diffDay} día${diffDay > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-CL");
}

type KpiDetailRow = {
  id: string;
  liquidation: string;
  address: string;
  inspector: string;
  status: string;
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

function getActivityText(log: AuditLog): string {
  const actionLabels: Record<string, string> = {
    INSERT: "creado",
    UPDATE: "actualizado",
    DELETE: "eliminado",
  };
  const tableLabels: Record<string, string> = {
    claims: "siniestro",
    inspection_sessions: "inspección",
  };
  const action = actionLabels[log.action] || log.action.toLowerCase();
  const table = tableLabels[log.table_name] || log.table_name;
  return `${table.charAt(0).toUpperCase() + table.slice(1)} ${action}`;
}

function getActivityIcon(log: AuditLog) {
  if (log.table_name === "claims") return FileText;
  if (log.table_name === "inspection_sessions") return ClipboardCheck;
  return Activity;
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

  const { data: auditLogs } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () => getRecentAuditLogs(undefined, 8),
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

    // Claims por compañía (top 5, para barras horizontales)
    const claimsByCompany: Record<string, number> = {};
    allClaims.forEach((c: Claim) => {
      const name = c.insurance_company?.name || "Sin compañía";
      claimsByCompany[name] = (claimsByCompany[name] || 0) + 1;
    });
    const topCompanies = Object.entries(claimsByCompany)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

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
    const inspectorMap: Record<string, { id: string; name: string; total: number; completed: number; active: number; avgMinutes: number }> = {};
    const inspectorTimes: Record<string, number[]> = {};
    allSessions.forEach((s) => {
      const id = s.inspector_id;
      if (!id) return;
      const name = users?.find((u) => u.id === id)?.full_name || "Sin nombre";
      if (!inspectorMap[id]) {
        inspectorMap[id] = { id, name, total: 0, completed: 0, active: 0, avgMinutes: 0 };
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
      inspectionsByStatus,
      monthsData,
      claimsByDay,
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

  const recentActivity =
    auditLogs?.map((log: AuditLog) => ({
      id: log.id,
      text: getActivityText(log),
      time: formatRelativeTime(log.created_at),
      icon: getActivityIcon(log),
    })) ?? [];

  // KPIs globales: foco en inspecciones
  const kpis = isGlobalUser
    ? [
        {
          label: "Inspecciones Hoy",
          value: stats.inspectionsToday,
          icon: PhEye,
          color: "blue",
          trend: "neutral" as const,
          trendValue: "Hoy",
          detailKey: "today" as const,
          detailTitle: "Inspecciones del día",
        },
        {
          label: "En Curso",
          value: stats.activeSessions,
          icon: PhRadio,
          color: "amber",
          trend: stats.activeSessions > 5 ? "up" as const : "neutral" as const,
          trendValue: stats.activeSessions > 5 ? "Alto" : "Normal",
          detailKey: "active" as const,
          detailTitle: "Inspecciones en curso",
        },
        {
          label: "Agendadas Hoy",
          value: stats.scheduledToday,
          icon: PhCalendarCheck,
          color: "violet",
          trend: "neutral" as const,
          trendValue: "Pendientes",
          detailKey: "scheduled-today" as const,
          detailTitle: "Inspecciones agendadas para hoy",
        },
        {
          label: "Completadas Hoy",
          value: stats.completedToday,
          icon: PhCheckCircle,
          color: "emerald",
          trend: stats.completedToday > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.completedToday > 0 ? "Progreso" : "Sin",
          detailKey: "completed-today" as const,
          detailTitle: "Inspecciones completadas hoy",
        },
        {
          label: "Con Retraso",
          value: stats.overdueSessions,
          icon: PhWarning,
          color: "pink",
          trend: stats.overdueSessions > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.overdueSessions > 0 ? "Alerta" : "OK",
          detailKey: "overdue" as const,
          detailTitle: "Inspecciones con retraso",
        },
        {
          label: "Tiempo Promedio",
          value: `${stats.avgInspectionMinutes.toFixed(0)}m`,
          icon: PhHourglass,
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
          icon: PhFolderOpen,
          color: "blue",
          trend: "neutral" as const,
          trendValue: "Asignadas",
          detailKey: "my-total" as const,
          detailTitle: "Mis inspecciones",
        },
        {
          label: "En Curso",
          value: stats.myActiveSessions,
          icon: PhRadio,
          color: "amber",
          trend: stats.myActiveSessions > 0 ? "up" as const : "neutral" as const,
          trendValue: stats.myActiveSessions > 0 ? "Activa" : "Sin",
          detailKey: "my-active" as const,
          detailTitle: "Mis inspecciones en curso",
        },
        {
          label: "Agendadas",
          value: stats.myScheduledSessions,
          icon: PhCalendarCheck,
          color: "violet",
          trend: "neutral" as const,
          trendValue: "Pendientes",
          detailKey: "my-scheduled" as const,
          detailTitle: "Mis inspecciones agendadas",
        },
        {
          label: "Completadas",
          value: stats.myCompletedSessions,
          icon: PhCheckCircle,
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

    switch (kpiModal.key) {
      case "today":
      case "my-total":
        return sessions
          .filter((s) =>
            (s.scheduled_at && isToday(s.scheduled_at)) ||
            (s.started_at && isToday(s.started_at)) ||
            (s.ended_at && isToday(s.ended_at))
          )
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            scheduled: s.scheduled_at,
          }));
      case "active":
      case "my-active":
        return sessions
          .filter((s) => s.status === "active")
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            started: s.started_at,
          }));
      case "scheduled-today":
      case "my-scheduled":
        return sessions
          .filter((s) => s.status === "scheduled" && s.scheduled_at && isToday(s.scheduled_at))
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            scheduled: s.scheduled_at,
          }));
      case "completed-today":
      case "my-completed":
        return sessions
          .filter((s) => s.status === "completed" && s.ended_at && isToday(s.ended_at))
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            ended: s.ended_at,
            duration:
              s.started_at && s.ended_at
                ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
                : 0,
          }));
      case "overdue":
        return sessions
          .filter((s) => (s.status === "scheduled" || s.status === "active") && s.scheduled_at && new Date(s.scheduled_at) < new Date())
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            scheduled: s.scheduled_at,
          }));
      case "avg-time":
        return sessions
          .filter((s) => s.status === "completed" && s.started_at && s.ended_at)
          .map((s) => ({
            id: s.id,
            liquidation: claimMap.get(s.claim_id)?.liquidation_number || "—",
            address: claimMap.get(s.claim_id)?.claim_address || "—",
            inspector: getName(s.inspector_id),
            status: s.status,
            started: s.started_at,
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
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-white/30 to-white/10 backdrop-blur-md border border-white/30 shadow-lg flex items-center justify-center dark:from-white/10 dark:to-white/5">
                  <Icon weight="fill" className="h-5 w-5 text-white/90" />
                </div>
                <div className={`kpi-trend kpi-trend-${kpi.trend}`}>
                  {kpi.trend === "up" && <TrendingUp className="h-3 w-3" />}
                  {(kpi.trend as string) === "down" && <TrendingDown className="h-3 w-3" />}
                  <span>{kpi.trendValue}</span>
                </div>
              </div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label mt-1">{kpi.label}</div>
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
          SECCIÓN: SINIESTROS
          Donut + Gauge cierre + Evolución mensual + Por día + Tiempo + En creación + En liquidación
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && (
        <>
          <div className="dash-section-header">
            <FileText className="h-4.5 w-4.5" />
            <span className="dash-section-title">Siniestros</span>
            <div className="dash-section-line" />
            <span className="dash-section-count">{stats.totalClaims} casos</span>
          </div>

          {/* Row 1: Donut (estado) + Gauge (tasa cierre) + Area (evolución) */}
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

            <div className="glass-panel dash-col-4 glass-glow-emerald">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <CheckCircle className="h-4 w-4" />
                  Tasa de Cierre
                </div>
              </div>
              <div className="glass-panel-body flex items-center justify-center pt-2">
                <GaugeChart
                  value={stats.closeRate}
                  max={100}
                  label="Siniestros cerrados"
                  color="#10b981"
                  size={210}
                />
              </div>
            </div>

            <div className="glass-panel dash-col-4 glass-glow-sky">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Activity className="h-4 w-4" />
                  Evolución Mensual
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
                <AreaChartGlass
                  data={stats.monthsData}
                  
                  label="Siniestros"
                  label2="Inspecciones"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Bar (por día) + Tiempo Resolución + En Creación + En Liquidación */}
          <div className="dash-grid">
            <div className="glass-panel dash-col-3 glass-glow-pink">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Calendar className="h-4 w-4" />
                  Por Día de la Semana
                </div>
              </div>
              <div className="glass-panel-body">
                <BarChartGlass
                  data={stats.claimsByDay}
                  
                  color="#ec4899"
                />
              </div>
            </div>

            <div className="glass-panel dash-col-3 glass-glow-amber">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Timer className="h-4 w-4" />
                  Tiempo Resolución
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {stats.avgResolutionDays > 0 ? stats.avgResolutionDays.toFixed(1) : "—"}
                  </span>
                  {stats.avgResolutionDays > 0 && (
                    <span className="text-sm text-muted-foreground font-medium">días</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {isGlobalUser ? "Promedio de cierre" : "Promedio de cierre de tus casos"}
                </p>
                <div className="mt-3 w-full flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all progress-bar-amber"
                      style={{
                        width: `${Math.min(stats.avgResolutionDays * 10, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {stats.avgResolutionDays > 30 ? "Lento" : stats.avgResolutionDays > 14 ? "Normal" : "Rápido"}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-panel dash-col-3 glass-glow-blue">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Clock className="h-4 w-4" />
                  En Creación
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight">{stats.createdClaims}</span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {isGlobalUser ? "Recién ingresados" : "Casos recién ingresados"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] font-semibold text-blue-500">
                      {stats.totalClaims > 0 ? ((stats.createdClaims / stats.totalClaims) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">del total</span>
                </div>
              </div>
            </div>

            <div className="glass-panel dash-col-3 glass-glow-amber">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <AlertCircle className="h-4 w-4" />
                  En Liquidación
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight">{stats.adjustmentClaims}</span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {isGlobalUser ? "En proceso de ajuste" : "Casos en proceso de ajuste"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-semibold text-amber-500">
                      {stats.totalClaims > 0 ? ((stats.adjustmentClaims / stats.totalClaims) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">del total</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN: INSPECCIONES
          Gauge completitud + Bar por estado + Inspecciones OK
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && (
        <>
          <div className="dash-section-header">
            <ClipboardCheck className="h-4.5 w-4.5" />
            <span className="dash-section-title">Inspecciones</span>
            <div className="dash-section-line" />
            <span className="dash-section-count">{stats.totalSessions} sesiones</span>
          </div>

          <div className="dash-grid">
            {/* Gauge: Completitud inspecciones */}
            <div className="glass-panel dash-col-4 glass-glow-violet">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <ClipboardCheck className="h-4 w-4" />
                  Tasa de Completitud
                </div>
              </div>
              <div className="glass-panel-body flex items-center justify-center pt-2">
                <GaugeChart
                  value={stats.inspectionCompletionRate}
                  max={100}
                  label="Inspecciones completadas"
                  color="#8b5cf6"
                  size={210}
                />
              </div>
            </div>

            {/* Bar: Inspecciones por estado */}
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

            {/* Inspecciones OK + desglose agendadas/activas */}
            <div className="glass-panel dash-col-4 glass-glow-emerald">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <CheckCircle className="h-4 w-4" />
                  Inspecciones OK
                </div>
              </div>
              <div className="glass-panel-body flex flex-col items-center justify-center pt-4 pb-4">
                <span className="text-4xl font-bold tracking-tight">{stats.completedSessions}</span>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Inspecciones completadas
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-semibold text-emerald-500">
                      {stats.totalSessions > 0 ? ((stats.completedSessions / stats.totalSessions) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">del total</span>
                </div>
                <div className="mt-4 w-full grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center rounded-lg bg-blue-500/5 border border-blue-500/10 py-2">
                    <span className="text-lg font-bold text-blue-500">{stats.scheduledSessions}</span>
                    <span className="text-[10px] text-muted-foreground">Agendadas</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-amber-500/5 border border-amber-500/10 py-2">
                    <span className="text-lg font-bold text-amber-500">{stats.activeSessions}</span>
                    <span className="text-[10px] text-muted-foreground">En curso</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN: SISTEMA / ACTIVIDAD (internal + adjuster)
          Top compañías + Actividad reciente
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && showSystemSection && (
        <>
          <div className="dash-section-header">
            <Building2 className="h-4.5 w-4.5" />
            <span className="dash-section-title">{isGlobalUser ? "Sistema" : "Mis Compañías"}</span>
            <div className="dash-section-line" />
          </div>

          <div className="dash-grid">
            <div className="glass-panel dash-col-6 glass-glow-sky">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Building2 className="h-4 w-4" />
                  {isGlobalUser ? "Top Compañías" : "Mis Casos por Compañía"}
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.topCompanies.length > 0 ? (
                  <BarChartGlass
                    data={stats.topCompanies}
                    
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

            <div className="glass-panel dash-col-6 glass-glow-indigo">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Activity className="h-4 w-4" />
                  Actividad Reciente
                </div>
              </div>
              <div className="glass-panel-body scroll-box-sm">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No hay actividad reciente.
                  </p>
                ) : (
                  <div>
                    {recentActivity.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="activity-item">
                          <div
                            className="activity-icon activity-icon-gradient"
                          >
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{item.text}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN: RESUMEN (inspector / assistant)
          Distribución por estado + Actividad reciente
          ═══════════════════════════════════════════════════════════════ */}
      {stats.totalClaims > 0 && !showSystemSection && (
        <>
          <div className="dash-section-header">
            <Shield className="h-4.5 w-4.5" />
            <span className="dash-section-title">Resumen</span>
            <div className="dash-section-line" />
          </div>

          <div className="dash-grid">
            <div className="glass-panel dash-col-6 glass-glow-indigo">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Shield className="h-4 w-4" />
                  Distribución por Estado
                </div>
              </div>
              <div className="glass-panel-body">
                {stats.claimsByStatus.length > 0 ? (
                  <div className="space-y-4 pt-2">
                    {stats.claimsByStatus.map((s) => {
                      const pct = stats.totalClaims > 0 ? (s.value / stats.totalClaims) * 100 : 0;
                      return (
                        <div key={s.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="text-sm text-muted-foreground">{s.value} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: s.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-50 flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel dash-col-6 glass-glow-indigo">
              <div className="glass-panel-header">
                <div className="glass-panel-title">
                  <Activity className="h-4 w-4" />
                  Actividad Reciente
                </div>
              </div>
              <div className="glass-panel-body scroll-box-sm">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No hay actividad reciente.
                  </p>
                ) : (
                  <div>
                    {recentActivity.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="activity-item">
                          <div
                            className="activity-icon activity-icon-gradient"
                          >
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{item.text}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <Dialog open={!!kpiModal} onOpenChange={() => setKpiModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{kpiModal?.title}</DialogTitle>
            <DialogDescription>
              {kpiModal?.key === "avg-time"
                ? "Detalle de inspecciones completadas, ordenadas de mayor a menor duración."
                : "Haz clic en una fila para ir al siniestro o inspección asociada."}
            </DialogDescription>
          </DialogHeader>
          {kpiDetailRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sin datos para mostrar</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="py-2 pr-4">Liquidación</th>
                    <th className="py-2 pr-4">Dirección</th>
                    <th className="py-2 pr-4">Inspector</th>
                    <th className="py-2 pr-4">Estado</th>
                    {kpiModal?.key === "avg-time" && <th className="py-2 pr-4 text-right">Duración</th>}
                    <th className="py-2 pr-4 text-right">Horario</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiDetailRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-mono">{row.liquidation}</td>
                      <td className="py-2 pr-4 max-w-[220px] truncate" title={row.address}>{row.address}</td>
                      <td className="py-2 pr-4">{row.inspector}</td>
                      <td className="py-2 pr-4 capitalize">{row.status}</td>
                      {kpiModal?.key === "avg-time" && <td className="py-2 pr-4 text-right font-mono">{row.duration}m</td>}
                      <td className="py-2 pr-4 text-right text-xs text-muted-foreground">
                        {row.scheduled
                          ? new Date(row.scheduled).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                          : row.started
                            ? new Date(row.started).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                            : row.ended
                              ? new Date(row.ended).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                      </td>
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
