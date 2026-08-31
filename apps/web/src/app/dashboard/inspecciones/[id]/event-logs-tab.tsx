"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Camera, Video, Upload, Trash2, MapPin, RefreshCw,
  Video as VideoIcon, FileText, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Smartphone, Monitor, Tablet,
} from "lucide-react";
import { getInspectionEventLogs, type InspectionEventLog } from "@/services/inspection-events";
import { formatUserTime } from "@/lib/timezone";

interface EventLogsTabProps {
  sessionId: string;
}

const eventTypeConfig: Record<string, { label: string; icon: typeof Camera; color: string }> = {
  photo_taken: { label: "Foto tomada", icon: Camera, color: "text-sky-500" },
  video_recorded: { label: "Video grabado", icon: Video, color: "text-violet-500" },
  upload_started: { label: "Subida iniciada", icon: Upload, color: "text-amber-500" },
  upload_completed: { label: "Subida completada", icon: CheckCircle2, color: "text-emerald-500" },
  upload_failed: { label: "Subida fallida", icon: AlertTriangle, color: "text-rose-500" },
  evidence_deleted: { label: "Evidencia eliminada", icon: Trash2, color: "text-rose-500" },
  geo_captured: { label: "Ubicación capturada", icon: MapPin, color: "text-emerald-500" },
  geo_recapture_enabled: { label: "Recaptura habilitada", icon: MapPin, color: "text-amber-500" },
  video_call_started: { label: "Videollamada iniciada", icon: VideoIcon, color: "text-sky-500" },
  video_call_ended: { label: "Videollamada finalizada", icon: VideoIcon, color: "text-slate-500" },
  screenshot_taken: { label: "Screenshot tomado", icon: Camera, color: "text-sky-500" },
  recording_saved: { label: "Grabación guardada", icon: Video, color: "text-emerald-500" },
};

const roleLabels: Record<string, string> = {
  insured: "Asegurado",
  adjuster: "Inspector",
  system: "Sistema",
};

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="h-3 w-3" />;
  if (type === "tablet") return <Tablet className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

export default function EventLogsTab({ sessionId }: EventLogsTabProps) {
  const [showHistory, setShowHistory] = useState(true);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<InspectionEventLog[]>({
    queryKey: ["inspection-event-logs", sessionId],
    queryFn: () => getInspectionEventLogs(sessionId),
    refetchInterval: 5000,
  });

  // Resumen rápido por tipo
  const summary = logs.reduce((acc, log) => {
    acc[log.event_type] = (acc[log.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mt-4 space-y-3">
      {/* Resumen */}
      <div className="app-panel px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-500" />
            <h3 className="app-section-title">Eventos de inspección</h3>
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
          <p className="text-sm text-slate-500">Cargando eventos...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">No hay eventos registrados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary).map(([type, count]) => {
              const cfg = eventTypeConfig[type];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div
                  key={type}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${cfg.color} bg-current/10`}
                >
                  <span className={cfg.color}>
                    <Icon className="h-3.5 w-3.5 inline" />
                    <span className="ml-1">{cfg.label}</span>
                    <span className="ml-1.5 opacity-60">({count})</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial completo */}
      <div className="app-panel overflow-hidden">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-sm font-medium">Historial de eventos ({logs.length})</span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showHistory && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No hay registros.</p>
            ) : (
              <div className="space-y-2 max-h-125 overflow-y-auto">
                {logs.map((log) => {
                  const cfg = eventTypeConfig[log.event_type] || {
                    label: log.event_type,
                    icon: FileText,
                    color: "text-slate-500",
                  };
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-2 sm:w-56">
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-slate-500">{roleLabels[log.role] || log.role}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 sm:ml-auto">
                        {log.event_detail && (
                          <span className="truncate max-w-50" aria-label={log.event_detail}>
                            {log.event_detail}
                          </span>
                        )}
                        {log.device_type && (
                          <span className="flex items-center gap-1">
                            <DeviceIcon type={log.device_type} />
                            {log.browser || "—"} / {log.os || "—"}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatUserTime(log.created_at)}
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
