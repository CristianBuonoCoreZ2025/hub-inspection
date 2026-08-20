"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInspectionSessionsLight, canAccessInspectionSession, type SessionWithRelations } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import { ClipboardCheck, Calendar, MapPin, Loader2, RefreshCw, Video, Home, User, UserCheck, Download, WifiOff, Clock, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DownloadButton } from "@/components/mobile/download-button";
import { getDownloadedSessions, removeDownloadedSession } from "@/lib/offline/download-session";
import { hasPendingChanges, countPendingChanges, daysUntilExpiration, type OfflineSession } from "@/db/offline-db";
import { useConfirm } from "@/hooks/use-confirm";

type TabKey = "todas" | "hoy" | "pendientes" | "en_curso" | "pausadas" | "completadas" | "descargadas";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "scheduled",
  active: "active",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled",
};

const INSPECTION_TYPE_LABELS: Record<string, { label: string; icon: typeof Video; badgeClass: string }> = {
  remote: { label: "Remota", icon: Video, badgeClass: "mobile-type-badge-remote" },
  onsite: { label: "Presencial", icon: Home, badgeClass: "mobile-type-badge-onsite" },
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  active: "En curso",
  paused: "Pausada",
  completed: "Completada",
  cancelled: "Cancelada",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Hoy";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Mañana";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function InspectionTypeIcon({ type }: { type: string }) {
  const TypeIcon = INSPECTION_TYPE_LABELS[type]?.icon || Home;
  return <TypeIcon className="h-3 w-3" />;
}

export default function MobileInspectionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, dataAccess } = useAuth();
  const online = useOnline();
  const confirm = useConfirm();
  const canSeeAll = dataAccess?.is_admin || profile?.role === "internal";
  const [activeTab, setActiveTab] = useState<TabKey>("todas");
  const [downloadedSessions, setDownloadedSessions] = useState<OfflineSession[]>([]);

  useRealtime("inspection_sessions", [["inspection-sessions-mobile"]]);

  const {
    data: sessions,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery<SessionWithRelations[]>({
    queryKey: ["inspection-sessions-mobile"],
    queryFn: () => getInspectionSessionsLight(),
    staleTime: 30 * 1000,
    enabled: online, // No fetch cuando estamos offline
  });

  // Cargar sesiones descargadas de IndexedDB
  const refreshDownloaded = async () => {
    if (!profile?.id) return;
    const downloaded = await getDownloadedSessions(profile.id);
    setDownloadedSessions(downloaded);
  };

  useEffect(() => {
    refreshDownloaded();
  }, [profile?.id]);

  // Filtrar: solo inspecciones presenciales (onsite) del inspector logueado
  const mySessions = useMemo(() => {
    if (!sessions || !profile?.id) return [];
    return sessions.filter((s) => {
      if (s.status === "cancelled") return false;
      if (s.inspection_type !== "onsite") return false;
      if (canSeeAll) return true;
      const effInspector = s.inspector_id || s.claim?.inspector_id;
      return effInspector === profile.id;
    });
  }, [sessions, profile, canSeeAll]);

  // IDs de sesiones descargadas (para mostrar badge)
  const downloadedIds = useMemo(() => new Set(downloadedSessions.map((s) => s.sessionId)), [downloadedSessions]);

  // Filtrar por tab
  const filteredSessions = useMemo(() => {
    const today = new Date().toDateString();
    switch (activeTab) {
      case "todas":
        return mySessions;
      case "hoy":
        return mySessions.filter((s) => {
          if (s.status === "cancelled" || s.status === "completed") return false;
          if (!s.scheduled_at) return false;
          return new Date(s.scheduled_at).toDateString() === today;
        });
      case "pendientes":
        return mySessions.filter((s) => s.status === "scheduled" && s.substate !== "paused");
      case "en_curso":
        return mySessions.filter((s) => s.status === "active" && s.substate !== "paused");
      case "pausadas":
        return mySessions.filter((s) => s.substate === "paused");
      case "completadas":
        return mySessions.filter((s) => s.status === "completed");
      default:
        return mySessions;
    }
  }, [mySessions, activeTab]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
    refreshDownloaded();
  };

  const handleDeleteDownloaded = async (sessionId: string) => {
    const ok = await confirm({
      title: "Eliminar descarga",
      description: "¿Eliminar esta inspección del dispositivo? Los cambios no sincronizados se perderán.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    await removeDownloadedSession(sessionId);
    refreshDownloaded();
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: mySessions.length },
    { key: "hoy", label: "Hoy", count: mySessions.filter((s) => s.status !== "cancelled" && s.status !== "completed" && s.scheduled_at && new Date(s.scheduled_at).toDateString() === new Date().toDateString()).length },
    { key: "pendientes", label: "Programadas", count: mySessions.filter((s) => s.status === "scheduled" && s.substate !== "paused").length },
    { key: "en_curso", label: "En curso", count: mySessions.filter((s) => s.status === "active" && s.substate !== "paused").length },
    { key: "pausadas", label: "Pausadas", count: mySessions.filter((s) => s.substate === "paused").length },
    { key: "completadas", label: "Completadas", count: mySessions.filter((s) => s.status === "completed").length },
    { key: "descargadas", label: "Descargadas", count: downloadedSessions.length },
  ];

  // Render offline: solo sesiones descargadas
  if (!online) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="mobile-tabs sticky top-0 bg-background z-10">
          <button className={`mobile-tab active`}>Descargadas ({downloadedSessions.length})</button>
        </div>

        <div className="mobile-pull-hint">
          <WifiOff className="h-3 w-3" /> Sin conexión
        </div>

        <div className="flex-1 px-4 pb-6 space-y-3">
          {downloadedSessions.length === 0 ? (
            <div className="mobile-empty">
              <WifiOff className="h-10 w-10 mobile-empty-icon" />
              <p className="mobile-empty-text">Sin conexión y sin inspecciones descargadas</p>
              <p className="mobile-empty-subtext">Conéctate a internet para descargar inspecciones</p>
            </div>
          ) : (
            downloadedSessions.map((offline) => {
              const session = offline.session;
              const address = session.claim?.claim_address || "Sin dirección";
              const pendingCount = countPendingChanges(offline.pending);
              const daysLeft = daysUntilExpiration(offline.expires_at);

              return (
                <button
                  key={offline.sessionId}
                  className="mobile-inspection-card"
                  onClick={() => router.push(`/mobile/inspecciones/${offline.sessionId}?offline=1`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mobile-inspection-code truncate">
                      {session.inspection_number || "Sin código"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {pendingCount > 0 ? (
                        <span className="mobile-offline-status pending">
                          {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="mobile-offline-status synced">Sincronizada</span>
                      )}
                    </div>
                  </div>

                  <div className="mobile-inspection-address flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{address}</span>
                  </div>

                  <div className="mobile-inspection-meta">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira en {daysLeft} día{daysLeft !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Render tab descargadas
  if (activeTab === "descargadas") {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="mobile-tabs sticky top-0 bg-background z-10">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`mobile-tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mobile-pull-hint">
          <button onClick={handleRefresh} className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Actualizar
          </button>
        </div>

        <div className="flex-1 px-4 pb-6 space-y-3">
          {downloadedSessions.length === 0 ? (
            <div className="mobile-empty">
              <Download className="h-10 w-10 mobile-empty-icon" />
              <p className="mobile-empty-text">No hay inspecciones descargadas</p>
              <p className="mobile-empty-subtext">Descarga inspecciones para trabajar sin conexión</p>
            </div>
          ) : (
            downloadedSessions.map((offline) => {
              const session = offline.session;
              const address = session.claim?.claim_address || "Sin dirección";
              const pendingCount = countPendingChanges(offline.pending);
              const daysLeft = daysUntilExpiration(offline.expires_at);
              const hasChanges = hasPendingChanges(offline.pending);

              return (
                <div key={offline.sessionId} className="mobile-inspection-card">
                  <button
                    className="flex-1 text-left"
                    onClick={() => router.push(`/mobile/inspecciones/${offline.sessionId}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mobile-inspection-code truncate">
                        {session.inspection_number || "Sin código"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasChanges ? (
                          <span className="mobile-offline-status pending">
                            {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="mobile-offline-status synced">Sincronizada</span>
                        )}
                      </div>
                    </div>

                    <div className="mobile-inspection-address flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{address}</span>
                    </div>

                    <div className="mobile-inspection-meta">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expira en {daysLeft} día{daysLeft !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                    <button
                      className="mobile-offline-delete-btn"
                      onClick={() => handleDeleteDownloaded(offline.sessionId)}
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Tabs */}
      <div className="mobile-tabs sticky top-0 bg-background z-10">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`mobile-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pull to refresh hint */}
      <div className="mobile-pull-hint">
        {isFetching ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Actualizando...</>
        ) : (
          <button onClick={handleRefresh} className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Actualizar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="mobile-empty">
            <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
            <p className="mobile-empty-text">Cargando inspecciones...</p>
          </div>
        ) : queryError ? (
          <div className="mobile-empty">
            <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
            <p className="mobile-empty-text">Error: {queryError.message}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="mobile-empty">
            <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
            <p className="mobile-empty-text">No hay inspecciones en esta categoría</p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const address = session.claim?.claim_address || "Sin dirección";
            const dateToShow = session.scheduled_at || session.created_at;
            const dateLabel = dateToShow ? `${formatDate(dateToShow)} ${formatTime(dateToShow)}` : "Sin fecha";
            const statusClass = STATUS_COLORS[session.status] || "scheduled";
            const isPaused = session.substate === "paused";
            const canOpen = canAccessInspectionSession(session, profile, dataAccess);
            const inspectorName = session.inspector?.full_name ||
              session.claim?.inspector_id ||
              session.inspector_id ||
              "Inspector no asignado";
            const insuredName = session.claim?.claims_participants?.[0]?.full_name || "";
            const isDownloaded = downloadedIds.has(session.id);

            return (
              <div
                key={session.id}
                className="mobile-inspection-card"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => canOpen && router.push(`/mobile/inspecciones/${session.id}`)}
                  disabled={!canOpen}
                >
                  {/* Header: código de inspección + estado + tipo */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="mobile-inspection-code truncate">
                      {session.inspection_number || "Sin código"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`mobile-type-badge ${INSPECTION_TYPE_LABELS[session.inspection_type]?.badgeClass || "mobile-type-badge-onsite"}`}>
                        <InspectionTypeIcon type={session.inspection_type} />
                        {INSPECTION_TYPE_LABELS[session.inspection_type]?.label || (session.inspection_type === "remote" ? "Remota" : "Presencial")}
                      </span>
                      <span className={`mobile-badge mobile-badge-${statusClass}`}>
                        {isPaused ? "Pausada" : STATUS_LABELS[session.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-inspection-inspector">
                    {canSeeAll && (
                      <Tooltip>
                        <TooltipTrigger className="gap-1">
                          <User className="h-3 w-3 shrink-0 text-blue-500" />
                          <span>Insp. {inspectorName}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Inspector</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {insuredName && (
                      <Tooltip>
                        <TooltipTrigger className="gap-1">
                          <UserCheck className="h-3 w-3 shrink-0 text-violet-500" />
                          <span>Aseg. {insuredName}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Asegurado</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Dirección */}
                  <div className="mobile-inspection-address flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{address}</span>
                  </div>

                  {/* Meta: fecha */}
                  <div className="mobile-inspection-meta">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {dateLabel}
                    </span>
                  </div>
                </button>

                {/* Botón descargar (solo si no está descargada y está programada) */}
                {profile?.id && !isDownloaded && session.status === "scheduled" && (
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                    <DownloadButton
                      sessionId={session.id}
                      inspectorId={profile.id}
                      onDownloaded={refreshDownloaded}
                    />
                  </div>
                )}

                {/* Badge descargada */}
                {isDownloaded && (
                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                    <span className="mobile-offline-badge downloaded">
                      <Download className="h-3 w-3" /> Descargada
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
