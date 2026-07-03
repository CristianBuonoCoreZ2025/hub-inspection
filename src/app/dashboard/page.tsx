"use client";

import { useQuery } from "@tanstack/react-query";
import { getClaims } from "@/services/claims";
import { getInspectionSessions } from "@/services/inspections";
import { getRecentAuditLogs } from "@/services/audit-logs";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Timer,
  Activity,
  ClipboardCheck,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Claim, InspectionSession, AuditLog } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";

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

export default function DashboardPage() {
  const { statusCode } = useClaimStatuses();
  const { data: claims } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () => getRecentAuditLogs(undefined, 10),
  });

  const closedClaims =
    claims?.filter((c: Claim) => statusCode(c.status_id) === "closed") ?? [];
  const createdClaims =
    claims?.filter((c: Claim) => statusCode(c.status_id) === "created") ?? [];
  const adjustmentClaims =
    claims?.filter((c: Claim) => statusCode(c.status_id) === "adjustment") ?? [];
  const openClaims =
    claims?.filter((c: Claim) => statusCode(c.status_id) !== "closed") ?? [];

  const scheduledSessions =
    sessions?.filter(
      (s: InspectionSession) =>
        s.status === "scheduled" &&
        s.scheduled_at &&
        new Date(s.scheduled_at) >= new Date()
    ) ?? [];

  // Tiempo promedio de resolución (claims cerrados)
  let avgResolutionDays = 0;
  if (closedClaims.length > 0) {
    const totalDays = closedClaims.reduce((sum: number, c: Claim) => {
      const created = new Date(c.created_at).getTime();
      const updated = new Date(c.updated_at).getTime();
      return sum + (updated - created) / 86400000;
    }, 0);
    avgResolutionDays = totalDays / closedClaims.length;
  }

  const metrics = [
    {
      label: "Casos abiertos",
      value: openClaims.length,
      icon: FileText,
    },
    {
      label: "Casos cerrados",
      value: closedClaims.length,
      icon: CheckCircle,
    },
    {
      label: "Casos en creación",
      value: createdClaims.length,
      icon: Clock,
    },
    {
      label: "Casos en liquidación",
      value: adjustmentClaims.length,
      icon: AlertCircle,
    },
    {
      label: "Inspecciones programadas",
      value: scheduledSessions.length,
      icon: Calendar,
    },
    {
      label: "Tiempo promedio de resolución",
      value:
        closedClaims.length > 0
          ? `${avgResolutionDays.toFixed(1)} días`
          : "—",
      icon: Timer,
    },
  ];

  const recentActivity =
    auditLogs?.map((log: AuditLog) => ({
      id: log.id,
      text: getActivityText(log),
      time: formatRelativeTime(log.created_at),
      icon: getActivityIcon(log),
    })) ?? [];

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la operación de inspecciones.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 text-primary" />
                  <span className="truncate">{metric.label}</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {metric.value}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay actividad reciente.
            </p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <p className="text-sm font-medium">{item.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.time}
                        </p>
                      </div>
                    </div>
                    {index < recentActivity.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
