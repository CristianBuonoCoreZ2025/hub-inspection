"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInspectionSessionsLight, canAccessInspectionSession, type SessionWithRelations } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { ClipboardCheck, Calendar, MapPin, Loader2, RefreshCw, Video, Home } from "lucide-react";

type TabKey = "hoy" | "pendientes" | "completadas" | "pausadas";

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
  const [activeTab, setActiveTab] = useState<TabKey>("hoy");

  useRealtime("inspection_sessions", [["inspection-sessions-mobile"]]);

  const { data: sessions, isLoading, isFetching } = useQuery<SessionWithRelations[]>({
    queryKey: ["inspection-sessions-mobile"],
    queryFn: () => getInspectionSessionsLight(),
    staleTime: 30 * 1000,
  });

  // Filtrar solo las inspecciones del inspector logueado
  const mySessions = useMemo(() => {
    if (!sessions || !profile?.id) return [];
    return sessions.filter((s) => {
      const effInspector = s.inspector_id || s.claim?.inspector_id;
      if (dataAccess?.is_admin) return true; // admin ve todas
      return effInspector === profile.id;
    });
  }, [sessions, profile, dataAccess]);

  // Filtrar por tab
  const filteredSessions = useMemo(() => {
    const today = new Date().toDateString();
    switch (activeTab) {
      case "hoy":
        return mySessions.filter((s) => {
          if (s.status === "cancelled" || s.status === "completed") return false;
          if (!s.scheduled_at) return false;
          return new Date(s.scheduled_at).toDateString() === today;
        });
      case "pendientes":
        return mySessions.filter((s) => s.status === "scheduled" && s.substate !== "paused");
      case "pausadas":
        return mySessions.filter((s) => s.status === "scheduled" && s.substate === "paused");
      case "completadas":
        return mySessions.filter((s) => s.status === "completed" || s.status === "cancelled");
      default:
        return mySessions;
    }
  }, [mySessions, activeTab]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "hoy", label: "Hoy", count: mySessions.filter((s) => s.status !== "cancelled" && s.status !== "completed" && s.scheduled_at && new Date(s.scheduled_at).toDateString() === new Date().toDateString()).length },
    { key: "pendientes", label: "Pendientes", count: mySessions.filter((s) => s.status === "scheduled" && s.substate !== "paused").length },
    { key: "pausadas", label: "Pausadas", count: mySessions.filter((s) => s.status === "scheduled" && s.substate === "paused").length },
    { key: "completadas", label: "Completadas", count: mySessions.filter((s) => s.status === "completed" || s.status === "cancelled").length },
  ];

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
            {t.count > 0 && (
              <span className="ml-1 text-xs opacity-60">({t.count})</span>
            )}
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
        ) : filteredSessions.length === 0 ? (
          <div className="mobile-empty">
            <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
            <p className="mobile-empty-text">No hay inspecciones en esta categoría</p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const address = session.claim?.claim_address || "Sin dirección";
            const liquidation = session.claim?.liquidation_number || "";
            const scheduled = session.scheduled_at;
            const statusClass = STATUS_COLORS[session.status] || "scheduled";
            const isPaused = session.substate === "paused";
            const canOpen = canAccessInspectionSession(session, profile, dataAccess);

            return (
              <button
                key={session.id}
                className="mobile-inspection-card"
                onClick={() => canOpen && router.push(`/mobile/inspecciones/${session.id}`)}
                disabled={!canOpen}
              >
                {/* Header: código + estado + tipo */}
                <div className="flex items-center justify-between gap-2">
                  <span className="mobile-inspection-code">
                    {liquidation || session.inspection_number || "Sin código"}
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

                {/* Dirección */}
                <div className="mobile-inspection-address flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{address}</span>
                </div>

                {/* Meta: fecha + tipo (detalle) */}
                <div className="mobile-inspection-meta">
                  {scheduled && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(scheduled)} {formatTime(scheduled)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {session.inspection_type === "remote" ? "Videollamada con asegurado" : "Inspector en campo"}
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
