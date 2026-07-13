"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/services/audit-logs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// Campos relevantes para mostrar en el detalle del cambio
const fieldLabels: Record<string, string> = {
  claim_number: "N° Siniestro",
  status_id: "Estado",
  claim_date: "Fecha",
  policy_number: "Poliza",
  policy_amount: "Monto Asegurado",
  policy_premium: "Prima",
  summary: "Resumen",
  inspector_id: "Inspector",
  adjuster_id: "Ajustador",
  auditor_id: "Auditor",
  recovery_type_legal: "Recupero Legal",
  recovery_type_material: "Recupero Material",
  recovery_comments: "Comentarios Recupero",
  disabled: "Inhabilitado",
  disabled_reason: "Razon Inhabilitacion",
};

function summarizeChange(log: { action: string; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null }) {
  if (log.action === "INSERT" && log.new_data) {
    const fields = Object.keys(log.new_data).filter((k) => fieldLabels[k] && log.new_data![k] != null);
    if (fields.length === 0) return "Registro creado";
    return fields.slice(0, 3).map((k) => fieldLabels[k]).join(", ") + (fields.length > 3 ? "..." : "");
  }
  if (log.action === "UPDATE" && log.new_data) {
    const changed = Object.keys(log.new_data).filter((k) => fieldLabels[k]);
    if (changed.length === 0) return "Actualizacion general";
    return changed.map((k) => `${fieldLabels[k]}: ${log.new_data![k] ?? "—"}`).join(", ");
  }
  if (log.action === "DELETE") return "Registro eliminado";
  return "—";
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
        <div className="text-center py-8 text-muted-foreground text-[13px]">Cargando...</div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="app-panel">
        <div className="text-center py-8 text-muted-foreground text-[13px]">
          No hay registros en el log.
        </div>
      </div>
    );
  }

  return (
    <div className="app-panel">
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-[40px]"></th>
              <th>Accion</th>
              <th>Detalle</th>
              <th>Usuario</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const performer = users?.find((u) => u.id === log.performed_by);
              const performerName = performer?.full_name || "Sistema";
              const label = actionLabels[log.action] || log.action;
              const icon = actionIcons[log.action];
              const color = actionColors[log.action] || "bg-gray-100 text-gray-700";

              return (
                <tr key={log.id}>
                  <td>
                    <div className={`flex size-7 items-center justify-center rounded-full ${color}`}>
                      {icon}
                    </div>
                  </td>
                  <td><Badge className={color}>{label}</Badge></td>
                  <td className="text-muted-foreground max-w-md truncate" title={summarizeChange(log)}>
                    {summarizeChange(log)}
                  </td>
                  <td className="font-medium">{performerName}</td>
                  <td className="text-muted-foreground">{formatDateTime(log.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
