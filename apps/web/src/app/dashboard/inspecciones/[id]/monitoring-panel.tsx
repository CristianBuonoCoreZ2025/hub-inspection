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
  ChevronDown,
  Shield,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { getConnectionLogs, type ConnectionLog } from "@/services/connection-logs";
import { getWebrtcEvents, type WebrtcEvent } from "@/services/webrtc-events";
import { formatUserDateTime } from "@/lib/timezone";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  peer_join: { label: "Conectado", icon: Users, color: "text-emerald-500" },
  peer_leave: { label: "Desconectado", icon: PhoneOff, color: "text-slate-500" },
  peer_rejected: { label: "Rechazado", icon: Ban, color: "text-amber-500" },
  ice_restart: { label: "Reinicio ICE", icon: Zap, color: "text-amber-500" },
  kick: { label: "Expulsado", icon: Ban, color: "text-rose-500" },
  call_start: { label: "Inicio llamada", icon: Video, color: "text-sky-500" },
  call_end: { label: "Fin llamada", icon: PhoneOff, color: "text-slate-500" },
  duplicate_access: { label: "Acceso duplicado", icon: AlertTriangle, color: "text-rose-500" },
  media_error: { label: "Error media", icon: AlertTriangle, color: "text-rose-500" },
  camera_switch: { label: "Cámara volteada", icon: Activity, color: "text-sky-500" },
  camera_switch_error: { label: "Error cámara", icon: AlertTriangle, color: "text-rose-500" },
  camera_switch_remote: { label: "Voltear cámara", icon: Activity, color: "text-sky-500" },
  geo_error: { label: "Error geo", icon: AlertTriangle, color: "text-rose-500" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  connecting: { label: "Conectando", color: "text-sky-500" },
  success: { label: "Conectado", color: "text-emerald-500" },
  failed: { label: "Fallido", color: "text-rose-500" },
  retry: { label: "Reintento", color: "text-amber-500" },
  disconnected: { label: "Desconectado", color: "text-slate-500" },
  kicked: { label: "Expulsado", color: "text-rose-500" },
};

const permissionColors: Record<string, string> = {
  granted: "text-emerald-500",
  denied: "text-rose-500",
  error: "text-amber-500",
  not_requested: "text-slate-400",
};

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-3 w-3" />;
  if (type === "tablet") return <Tablet className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center justify-center w-4 h-3">
        <span className={`h-2 w-2 rounded-full ${color.replace("text-", "bg-")}`} />
      </TooltipTrigger>
      <TooltipContent side="top"><p className="text-xs">{label}</p></TooltipContent>
    </Tooltip>
  );
}

function PermissionIcon({ permission, kind }: { permission: string; kind: "camera" | "mic" }) {
  const color = permissionColors[permission || "not_requested"] || permissionColors.not_requested;
  const labels: Record<string, string> = {
    granted: `${kind === "camera" ? "Cámara" : "Micrófono"} permitido`,
    denied: `${kind === "camera" ? "Cámara" : "Micrófono"} denegado`,
    error: `Error de ${kind === "camera" ? "cámara" : "micrófono"}`,
    not_requested: `${kind === "camera" ? "Cámara" : "Micrófono"} no solicitado`,
  };
  const Icon = kind === "camera" ? Camera : Mic;
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center justify-center w-4">
        <Icon className={`h-3 w-3 ${color}`} />
      </TooltipTrigger>
      <TooltipContent side="top"><p className="text-xs">{labels[permission || "not_requested"] || labels.not_requested}</p></TooltipContent>
    </Tooltip>
  );
}

function EventIcon({ eventType }: { eventType: string }) {
  const cfg = eventConfig[eventType] || { label: eventType, icon: Activity, color: "text-slate-500" };
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex items-center justify-center w-4 h-3">
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </TooltipTrigger>
      <TooltipContent side="top"><p className="text-xs">{cfg.label}</p></TooltipContent>
    </Tooltip>
  );
}

export default function MonitoringPanel({ sessionId }: MonitoringPanelProps) {
  const [showHistory, setShowHistory] = useState(true);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

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

  const insuredIps = useMemo(() => {
    const ips = new Set<string>();
    insuredLogs.forEach((l) => { if (l.ip_address) ips.add(l.ip_address); });
    return Array.from(ips);
  }, [insuredLogs]);

  const insuredDevices = useMemo(() => {
    const devices = new Set<string>();
    insuredLogs.forEach((l) => {
      if (l.device_type || l.browser || l.os) {
        devices.add(`${l.device_type || "?"}/${l.browser || "?"}/${l.os || "?"}`);
      }
    });
    return Array.from(devices);
  }, [insuredLogs]);

  const alerts = useMemo(() => {
    const list: { type: string; message: string; severity: "high" | "medium" | "low" }[] = [];
    if (insuredIps.length > 1) list.push({ type: "duplicate_ip", message: `El asegurado accedió desde ${insuredIps.length} IPs diferentes`, severity: "high" });
    if (insuredDevices.length > 1) list.push({ type: "duplicate_device", message: `El asegurado usó ${insuredDevices.length} dispositivos diferentes`, severity: "medium" });
    events.filter((e) => e.event_type === "duplicate_access").forEach((e) => list.push({ type: "duplicate_access", message: `Acceso duplicado desde ${e.ip_address || "IP desconocida"}`, severity: "high" }));
    const iceRestarts = events.filter((e) => e.event_type === "ice_restart");
    if (iceRestarts.length > 2) list.push({ type: "ice_instability", message: `${iceRestarts.length} reinicios de conexión — calidad inestable`, severity: "medium" });
    const rejectedPeers = events.filter((e) => e.event_type === "peer_rejected");
    if (rejectedPeers.length > 0) list.push({ type: "peer_rejected", message: `${rejectedPeers.length} conexión(es) rechazada(s) — posible magic link compartido`, severity: "high" });
    const mediaErrors = events.filter((e) => e.event_type === "media_error");
    if (mediaErrors.length > 0) list.push({ type: "media_error", message: `${mediaErrors.length} error(es) de cámara/micrófono`, severity: "medium" });
    return list;
  }, [insuredIps, insuredDevices, events]);

  const alertSummary = useMemo(() => {
    const high = alerts.filter(a => a.severity === "high").length;
    const medium = alerts.filter(a => a.severity === "medium").length;
    const low = alerts.filter(a => a.severity === "low").length;
    return { high, medium, low, total: alerts.length };
  }, [alerts]);

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 3);

  const timeline = useMemo(() => {
    const items: { timestamp: string; type: "log" | "event"; data: ConnectionLog | WebrtcEvent }[] = [
      ...logs.map((l) => ({ timestamp: l.connected_at, type: "log" as const, data: l })),
      ...events.map((e) => ({ timestamp: e.created_at, type: "event" as const, data: e })),
    ];
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, events]);

  const refetchAll = () => { refetchLogs(); refetchEvents(); };
  const isFetching = logsFetching || eventsFetching;

  const headRow = (
    <tr className="text-[10px] text-slate-400 border-b border-slate-200 dark:border-slate-700">
      <th className="w-4 py-1 text-left"></th>
      <th className="w-32 py-1 text-left font-normal">Fecha</th>
      <th className="w-20 py-1 text-left font-normal">Rol</th>
      <th className="w-28 py-1 text-left font-normal">Dispositivo</th>
      <th className="w-24 py-1 text-left font-normal">Ubicación</th>
      <th className="w-4 py-1 text-center font-normal">C</th>
      <th className="w-4 py-1 text-center font-normal">M</th>
    </tr>
  );

  const renderLogRow = (log: ConnectionLog) => {
    const status = statusConfig[log.status] || statusConfig.connecting;
    return (
      <tr key={log.id} className="text-[10px] text-slate-500">
        <td className="w-4 py-1"><StatusDot label={status.label} color={status.color} /></td>
        <td className="w-32 py-1">
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="h-3 w-3" />
            {formatUserDateTime(log.connected_at)}
          </span>
        </td>
        <td className="w-20 py-1 truncate">{roleLabels[log.role] || log.role}</td>
        <td className="w-28 py-1">
          <span className="inline-flex items-center gap-1 truncate">
            <DeviceIcon type={log.device_type} />
            <span className="truncate">{log.browser || "—"} / {log.os || "—"}</span>
          </span>
        </td>
        <td className="w-24 py-1">
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{log.ip_address || [log.city, log.country].filter(Boolean).join(", ") || "—"}</span>
          </span>
        </td>
        <td className="w-4 py-1 text-center"><PermissionIcon permission={log.camera_permission || "not_requested"} kind="camera" /></td>
        <td className="w-4 py-1 text-center"><PermissionIcon permission={log.microphone_permission || "not_requested"} kind="mic" /></td>
      </tr>
    );
  };

  const renderEventRow = (evt: WebrtcEvent, i: number) => {
    const cfg = eventConfig[evt.event_type] || { label: evt.event_type, icon: Activity, color: "text-slate-500" };
    return (
      <tr key={`evt-${i}`} className="text-[10px] text-slate-500">
        <td className="w-4 py-1"><EventIcon eventType={evt.event_type} /></td>
        <td className="w-32 py-1">
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="h-3 w-3" />
            {formatUserDateTime(evt.created_at)}
          </span>
        </td>
        <td className={`w-20 py-1 truncate ${cfg.color}`}>{roleLabels[evt.role] || evt.role}</td>
        <td className={`w-28 py-1 truncate ${cfg.color}`}>{cfg.label}</td>
        <td className="w-24 py-1 truncate">{evt.ip_address || "—"}</td>
        <td className="w-4 py-1 text-center">—</td>
        <td className="w-4 py-1 text-center">—</td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col max-h-[calc(85vh-3rem)]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        {alerts.length > 0 && (
          <div className="app-panel p-2 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                <h4 className="text-[11px] font-medium">Resumen de alertas</h4>
              </div>
              <div className="flex items-center gap-1.5">
                {alertSummary.high > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <ShieldX className="h-3 w-3" />
                    {alertSummary.high}
                  </span>
                )}
                {alertSummary.medium > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <Shield className="h-3 w-3" />
                    {alertSummary.medium}
                  </span>
                )}
                {alertSummary.low > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {alertSummary.low}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {visibleAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 p-1.5 rounded border ${
                    alert.severity === "high"
                      ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30"
                      : alert.severity === "medium"
                      ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                  }`}
                >
                  <AlertTriangle className={`h-3 w-3 shrink-0 mt-0.5 ${alert.severity === "high" ? "text-rose-500" : "text-amber-500"}`} />
                  <p className="text-[10px] leading-tight text-slate-700 dark:text-slate-300">{alert.message}</p>
                </div>
              ))}
            </div>

            {alerts.length > 3 && (
              <button
                onClick={() => setShowAllAlerts(v => !v)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1"
              >
                {showAllAlerts ? "Ver menos" : `Ver ${alerts.length - 3} más`}
                <ChevronDown className={`h-3 w-3 transition-transform ${showAllAlerts ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <div className="app-panel px-2 py-2 rounded-md flex items-center justify-between h-9">
            <p className="text-[10px] text-slate-500">Conexiones</p>
            <p className="text-sm font-semibold">{logs.length}</p>
          </div>
          <div className="app-panel px-2 py-2 rounded-md flex items-center justify-between h-9">
            <p className="text-[10px] text-slate-500">WebRTC</p>
            <p className="text-sm font-semibold">{events.length}</p>
          </div>
          <div className="app-panel px-2 py-2 rounded-md flex items-center justify-between h-9">
            <p className="text-[10px] text-slate-500">IPs</p>
            <p className={`text-sm font-semibold ${insuredIps.length > 1 ? "text-rose-500" : ""}`}>{insuredIps.length}</p>
          </div>
          <div className="app-panel px-2 py-2 rounded-md flex items-center justify-between h-9">
            <p className="text-[10px] text-slate-500">Dispositivos</p>
            <p className={`text-sm font-semibold ${insuredDevices.length > 1 ? "text-amber-500" : ""}`}>{insuredDevices.length}</p>
          </div>
        </div>

        <div className="app-panel p-2 rounded-md">
          <h4 className="text-[11px] font-medium mb-1.5 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            Accesos del asegurado
            <span className="text-[10px] text-slate-400">({insuredLogs.length})</span>
          </h4>
          <table className="w-full border-collapse table-fixed">
            <thead>{headRow}</thead>
          </table>
          <div className="max-h-40 overflow-y-auto pr-1">
            <table className="w-full border-collapse table-fixed">
              <tbody>
                {insuredLogs.slice(0, 20).sort((a, b) => new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime()).map(renderLogRow)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="app-panel p-0 overflow-hidden rounded-md">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-[11px] font-medium flex items-center gap-2"
            >
              <Activity className="h-3.5 w-3.5 text-sky-500" />
              Timeline de eventos
              <span className="text-[10px] text-slate-400">({timeline.length})</span>
            </button>
            <button
              onClick={refetchAll}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
          {showHistory && (
            <div className="p-2 pb-2">
              {logsLoading && eventsLoading ? (
                <p className="text-xs text-slate-500">Cargando...</p>
              ) : timeline.length === 0 ? (
                <p className="text-xs text-slate-500">No hay eventos registrados.</p>
              ) : (
                <>
                  <table className="w-full border-collapse table-fixed">
                    <thead>{headRow}</thead>
                  </table>
                  <div className="max-h-64 overflow-y-auto pr-1">
                    <table className="w-full border-collapse table-fixed">
                      <tbody>
                        {timeline.slice(0, 100).map((item, i) => item.type === "event" ? renderEventRow(item.data as WebrtcEvent, i) : renderLogRow(item.data as ConnectionLog))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
