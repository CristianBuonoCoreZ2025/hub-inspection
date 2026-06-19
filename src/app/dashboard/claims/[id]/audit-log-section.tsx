"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/services/audit-logs";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/types";

const actionLabels: Record<string, string> = {
  INSERT: "Creado",
  UPDATE: "Actualizado",
  DELETE: "Eliminado",
};

const actionIcons: Record<string, React.ReactNode> = {
  INSERT: <Plus className="h-3.5 w-3.5" />,
  UPDATE: <Pencil className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
};

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  UPDATE: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AuditLogSectionProps {
  claimId: string;
  users?: Profile[];
}

export default function AuditLogSection({ claimId, users }: AuditLogSectionProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", "claims", claimId],
    queryFn: () => getAuditLogs("claims", claimId),
  });

  if (isLoading) {
    return (
      <div className="app-panel">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Historial de cambios
        </h3>
        <p className="text-sm text-muted-foreground">Cargando historial...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="app-panel">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Historial de cambios
        </h3>
        <p className="text-sm text-muted-foreground">
          No hay registros de cambios para este siniestro.
        </p>
      </div>
    );
  }

  return (
    <div className="app-panel">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Historial de cambios
      </h3>
      <div className="space-y-1">
        {logs.map((log, index) => {
          const performer = users?.find((u) => u.id === log.performed_by);
          const performerName = performer?.full_name || "Sistema";
          const label = actionLabels[log.action] || log.action;
          const icon = actionIcons[log.action];
          const color = actionColors[log.action] || "bg-gray-100 text-gray-700";

          return (
            <div key={log.id}>
              <div className="flex items-start gap-3 py-3">
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}
                >
                  {icon}
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      por {performerName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </p>
                </div>
              </div>
              {index < logs.length - 1 && <Separator />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
