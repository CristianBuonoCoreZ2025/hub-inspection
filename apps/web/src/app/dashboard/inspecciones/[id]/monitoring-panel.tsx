"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  MapPin,
  Camera,
  Mic,
  AlertTriangle,
  Users,
  Zap,
  Ban,
  PhoneOff,
  Video,
} from "lucide-react";
import { getConnectionLogs, type ConnectionLog } from "@/services/connection-logs";
import { getWebrtcEvents, type WebrtcEvent } from "@/services/webrtc-events";
import { formatUserDateTime, formatUserTime } from "@/lib/timezone";

interface MonitoringPanelProps {
  sessionId: string;
}

const roleLabels: Record<string, string> = {
  insured: "Asegurado",
  adjuster: "Inspector",
  supervisor: "Supervisor",
  client: "Asegurado",
  inspector: "Inspector",
};

const eventConfig: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  peer_join: { label: "Peer conectado", icon: Users, color: "text-emerald-500" },
  peer_leave: { label: "Peer desconectado", icon: PhoneOff, color: "text-slate-500" },
  peer_rejected: { label: "Peer rechazado", icon: Ban, color: "text-amber-500" },
  ice_restart: { label: "Reinicio ICE", icon: Zap, color: "text-amber-500" },
  kick: { label: "Expulsado", icon: Ban, color: "text-rose-500" },
  call_start: { label: "Inicio llamada", icon: Video, color: "text-sky-500" },
  call_end: { label: "Fin llamada", icon: PhoneOff, color: "text-slate-500" },
  duplicate_access: { label: "Acceso duplicado", icon: AlertTriangle, color: "text-rose-500" },
};

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

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function MonitoringPanel({ sessionId }: MonitoringPanelProps) {
  const [showHistory, setShowHistory] = useState(true);

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs, isFetching: logsFetching } = useQuery<ConnectionLog[]>({
    queryKey: ["connection-logs", sessionId],
    queryFn: () => getConnectionLogs(sessionId),
    refetchInterval: 5000,
  });

  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents, isFetching: eventsFetching } = useQuery<WebrtcEvent[]>({
    queryKey: ["webrtc-events", sessionId],
    queryFn: () => getWebrtcEvents(sessionId),
    refetchInterval: 5000,
  });

  const insuredLogs = useMemo(() => logs.filter((l) => l.role === "insured"), [logs]);

  // Detectar IPs únicas del asegurado
  const insuredIps = useMemo(() => {
    const ips = new Set<string>();
    insuredLogs.forEach((l) => { if (l.ip_address) ips.add(l.ip_address); });
    return Array.from(ips);
  }, [insuredLogs]);

  // Detectar dispositivos únicos del asegurado
  const insuredDevices = useMemo(() => {
    const devices = new Set<string>();
    insuredLogs.forEach((l) => {
      if (l.device_type || l.browser || l.os) {
        devices.add(`${l.device_type || "?"}/${l.browser || "?"}/${l.os || "?"}`);
      }
    });
    return Array.from(devices);
  }, [insuredLogs]);

  // Alertas
  const alerts = useMemo(() => {
    const list: { type: string; message: string; severity: "high" | "medium" | "low" }[] = [];
    if (insuredIps.length > 1) {
      list.push({
        type: "duplicate_ip",
        message: `El asegurado accedió desde ${insuredIps.length} IPs diferentes: ${insuredIps.join(", ")}`,
        severity: "high",
      });
    }
    if (insuredDevices.length > 1) {
      list.push({
        type: "duplicate_device",
        message: `El asegurado usó ${insuredDevices.length} dispositivos diferentes`,
        severity: "medium",
      });
    }
    const duplicateEvents = events.filter((e) => e.event_type === "duplicate_access");
    duplicateEvents.forEach((e) => {
      list.push({
        type: "duplicate_access",
        message: `Acceso duplicado detectado desde ${e.ip_address || "IP desconocida"}`,
        severity: "high",
      });
    });
    const iceRestarts = events.filter((e) => e.event_type === "ice_restart");
    if (iceRestarts.length > 2) {
      list.push({
        type: "ice_instability",
        message: `${iceRestarts.length} reinicios ICE — conexión inestable`,
        severity: "medium",
      });
    }
    const rejectedPeers = events.filter((e) => e.event_type === "peer_rejected");
    if (rejectedPeers.length > 0) {
      list.push({
        type: "peer_rejected",
        message: `${rejectedPeers.length} intento(s) de conexión rechazado(s) — posible magic link compartido`,
        severity: "high",
      });
    }
    return list;
  }, [insuredIps, insuredDevices, events]);

  // Combinar logs y eventos en un timeline
  const timeline = useMemo(() => {
    const items: { timestamp: string; type: "log" | "event"; data: ConnectionLog | WebrtcEvent }[] = [
      ...logs.map((l) => ({ timestamp: l.connected_at, type: "log" as const, data: l })),
      ...events.map((e) => ({ timestamp: e.created_at, type: "event" as const, data: e })),
    ];
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, events]);

  const refetchAll = () => { refetchLogs(); refetchEvents(); };
  const isFetching = logsFetching || eventsFetching;

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg border ${
                alert.severity === "high"
                  ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30"
                  : alert.severity === "medium"
                  ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                alert.severity === "high" ? "text-rose-500" : "text-amber-500"
              }`} />
              <p className="text-sm text-slate-700 dark:text-slate-300">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="app-panel px-3 py-2">
          <p className="text-xs text-slate-500">Conexiones</p>
          <p className="text-lg font-semibold">{logs.length}</p>
        </div>
        <div className="app-panel px-3 py-2">
          <p className="text-xs text-slate-500">Eventos WebRTC</p>
          <p className="text-lg font-semibold">{events.length}</p>
        </div>
        <div className="app-panel px-3 py-2">
          <p className="text-xs text-slate-500">IPs del asegurado</p>
          <p className={`text-lg font-semibold ${insuredIps.length > 1 ? "text-rose-500" : ""}`}>{insuredIps.length}</p>
        </div>
        <div className="app-panel px-3 py-2">
          <p className="text-xs text-slate-500">Dispositivos</p>
          <p className={`text-lg font-semibold ${insuredDevices.length > 1 ? "text-amber-500" : ""}`}>{insuredDevices.length}</p>
        </div>
      </div>

      {/* IPs y dispositivos del asegurado */}
      {insuredIps.length > 0 && (
        <div className="app-panel px-4 py-3">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            Accesos del asegurado
          </h4>
          <div className="space-y-1.5">
            {insuredLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <DeviceIcon type={log.device_type} />
                  {log.browser || "—"} / {log.os || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[log.city, log.country].filter(Boolean).join(", ") || log.ip_address || "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatUserDateTime(log.connected_at)}
                </span>
                <span className={`font-medium ${statusConfig[log.status]?.color || ""}`}>
                  {statusConfig[log.status]?.label || log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline combinado */}
      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm font-medium flex items-center gap-2"
          >
            <Activity className="h-4 w-4 text-sky-500" />
            Timeline de eventos
            <span className="text-xs text-slate-400">({timeline.length})</span>
          </button>
          <button
            onClick={refetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {showHistory && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 max-h-96 overflow-y-auto">
            {logsLoading && eventsLoading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-slate-500">No hay eventos registrados.</p>
            ) : (
              <div className="space-y-2">
                {timeline.slice(0, 100).map((item, i) => {
                  if (item.type === "event") {
                    const evt = item.data as WebrtcEvent;
                    const cfg = eventConfig[evt.event_type] || { label: evt.event_type, icon: Activity, color: "text-slate-500" };
                    const Icon = cfg.icon;
                    return (
                      <div key={`evt-${i}`} className="flex items-start gap-3 p-2 rounded-md border border-slate-200 dark:border-slate-700">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-xs text-slate-400">{roleLabels[evt.role] || evt.role}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatUserTime(evt.created_at)}
                            {evt.ip_address && ` · ${evt.ip_address}`}
                          </p>
                          {evt.details && Object.keys(evt.details).length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                              {JSON.stringify(evt.details).substring(0, 120)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    const log = item.data as ConnectionLog;
                    const status = statusConfig[log.status] || statusConfig.connecting;
                    const camPerm = permissionConfig[log.camera_permission || "not_requested"];
                    const micPerm = permissionConfig[log.microphone_permission || "not_requested"];
                    return (
                      <div key={`log-${i}`} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-md border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 sm:w-40">
                          <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                          <span className="text-xs text-slate-500">{roleLabels[log.role] || log.role}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 sm:ml-auto flex-wrap">
                          <span className="flex items-center gap-1">
                            <DeviceIcon type={log.device_type} />
                            {log.browser || "—"} / {log.os || "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[log.city, log.country].filter(Boolean).join(", ") || log.ip_address || "—"}
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
                  }
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
