"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wifi,
  WifiOff,
  Clock,
  Smartphone,
  Tablet,
  Monitor,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Camera,
  Mic,
} from "lucide-react";
import { getConnectionLogs, type ConnectionLog } from "@/services/connection-logs";
import { formatUserDateTime, formatUserTime } from "@/lib/timezone";

interface ConnectionLogsTabProps {
  sessionId: string;
}

const roleLabels: Record<string, string> = {
  insured: "Asegurado",
  adjuster: "Inspector",
  supervisor: "Supervisor",
};

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function getLatestLog(logs: ConnectionLog[], role: string) {
  return logs
    .filter((log) => log.role === role)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

function getConnectionState(log: ConnectionLog | undefined) {
  if (!log) return { label: "Sin conexión", color: "text-slate-500 bg-slate-500/10", icon: WifiOff };
  if (log.disconnected_at || log.status === "disconnected" || log.status === "kicked") {
    return { label: "Desconectado", color: "text-slate-500 bg-slate-500/10", icon: WifiOff };
  }
  if (log.status === "connecting" || log.status === "retry") {
    return { label: "Conectando", color: "text-sky-500 bg-sky-500/10", icon: Clock };
  }
  if (log.status === "success") {
    return { label: "Conectado", color: "text-emerald-500 bg-emerald-500/10", icon: Wifi };
  }
  if (log.status === "failed") {
    return { label: "Fallido", color: "text-rose-500 bg-rose-500/10", icon: WifiOff };
  }
  return { label: "Sin conexión", color: "text-slate-500 bg-slate-500/10", icon: WifiOff };
}

export default function ConnectionLogsTab({ sessionId }: ConnectionLogsTabProps) {
  const [showHistory, setShowHistory] = useState(false);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<ConnectionLog[]>({
    queryKey: ["connection-logs", sessionId],
    queryFn: () => getConnectionLogs(sessionId),
    refetchInterval: 5000,
  });

  const insuredLog = useMemo(() => getLatestLog(logs, "insured"), [logs]);
  const adjusterLog = useMemo(() => getLatestLog(logs, "adjuster"), [logs]);

  const insuredState = useMemo(() => getConnectionState(insuredLog), [insuredLog]);
  const adjusterState = useMemo(() => getConnectionState(adjusterLog), [adjusterLog]);

  const statusConfig: Record<string, { label: string; color: string }> = {
    connecting: { label: "Conectando", color: "text-sky-500" },
    success: { label: "Conectado", color: "text-emerald-500" },
    failed: { label: "Fallido", color: "text-rose-500" },
    retry: { label: "Reintento", color: "text-amber-500" },
    disconnected: { label: "Desconectado", color: "text-slate-500" },
    kicked: { label: "Expulsado", color: "text-rose-500" },
  };

  const permissionConfig: Record<string, { label: string; color: string }> = {
    granted: { label: "Sí", color: "text-emerald-500" },
    denied: { label: "No", color: "text-rose-500" },
    error: { label: "Error", color: "text-amber-500" },
    not_requested: { label: "—", color: "text-slate-400" },
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Estado actual */}
      <div className="app-panel px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-sky-500" />
            <h3 className="app-section-title">Estado de conexión</h3>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Cargando estado...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Asegurado */}
            <div className={`rounded-lg p-4 border ${insuredLog ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-300 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-sm">Asegurado</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${insuredState.color}`}>
                <insuredState.icon className="h-4 w-4" />
                {insuredState.label}
              </div>
              {insuredLog && (
                <p className="text-xs text-slate-500 mt-2">
                  Último cambio: {formatUserDateTime(insuredLog.connected_at)}
                </p>
              )}
            </div>

            {/* Inspector */}
            <div className={`rounded-lg p-4 border ${adjusterLog ? "border-slate-200 dark:border-slate-700" : "border-dashed border-slate-300 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-sm">Inspector</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${adjusterState.color}`}>
                <adjusterState.icon className="h-4 w-4" />
                {adjusterState.label}
              </div>
              {adjusterLog && (
                <p className="text-xs text-slate-500 mt-2">
                  Último cambio: {formatUserDateTime(adjusterLog.connected_at)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historial (opcional) */}
      <div className="app-panel overflow-hidden">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm font-medium">Historial de conexiones</span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showHistory && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No hay registros.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const status = statusConfig[log.status] || statusConfig.connecting;
                  const camPerm = permissionConfig[log.camera_permission || "not_requested"];
                  const micPerm = permissionConfig[log.microphone_permission || "not_requested"];

                  return (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2 sm:w-40">
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                        <span className="text-xs text-slate-500">{roleLabels[log.role] || log.role}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 sm:ml-auto">
                        <span className="flex items-center gap-1">
                          <DeviceIcon type={log.device_type} />
                          {log.browser || "—"} / {log.os || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[log.city, log.country].filter(Boolean).join(", ") || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatUserTime(log.connected_at)}
                        </span>
                        <span className="flex items-center gap-1" aria-label="Cámara">
                          <Camera className="h-3 w-3" />
                          <span className={camPerm.color}>{camPerm.label}</span>
                        </span>
                        <span className="flex items-center gap-1" aria-label="Micrófono">
                          <Mic className="h-3 w-3" />
                          <span className={micPerm.color}>{micPerm.label}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
