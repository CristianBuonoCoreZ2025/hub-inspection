"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionSessionById,
  startInspection,
  resumeInspection,
  pauseInspection,
  cancelInspectionViaCIN,
  getWorkPeriods,
  canAccessInspectionSession,
  forceReleaseOfflineSession,
  updateInspectionSession,
  type SessionDetail,
} from "@/services/inspections";
import { getLookupCatalog } from "@/services/catalogs";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import { getDownloadedSession, releaseDownloadedSession } from "@/lib/offline/download-session";
import { syncInspection } from "@/lib/offline/sync-session";
import { hasPendingChanges, getGlobalCatalogs, type OfflineSession, type OfflineCatalogs } from "@/db/offline-db";
import { getUserTimeZone } from "@/lib/timezone";
import { SyncButton } from "@/components/mobile/sync-button";
import { useConfirm } from "@/hooks/use-confirm";
import { useState as useReactState, useEffect as useReactEffect } from "react";

// GeoCapture usa Leaflet (browser-only) — import dinámico
const GeoCapture = dynamic(() => import("@/components/inspection/geo-capture").then((m) => ({ default: m.GeoCapture })), { ssr: false });
import {
  Play, FastForward, Pause, XCircle, Loader2, MapPin,
  FileText, Camera, ShieldCheck, PenTool, FileCheck,
  ClipboardCheck, Clock, Video, Home, Pencil, CloudOff, Lock, CloudUpload,
} from "lucide-react";

import MobileEvidencesTab from "./tabs/evidences-tab";
import MobileDamagesTab from "./tabs/damages-tab";
import MobileSignaturesTab from "./tabs/signatures-tab";
import MobileActaTab from "./tabs/acta-tab";
import MobileReportTab from "./tabs/report-tab";
import MobileSketchesTab from "./tabs/sketches-tab";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  active: "En curso",
  paused: "Pausada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "mobile-badge-scheduled",
  active: "mobile-badge-active",
  paused: "mobile-badge-paused",
  completed: "mobile-badge-completed",
  cancelled: "mobile-badge-cancelled",
};

type TabId = "resumen" | "acta" | "danos" | "evidencias" | "croquis" | "firmas" | "informe";

export default function MobileInspectionDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const sessionId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { profile, dataAccess } = useAuth();
  const online = useOnline();
  const confirm = useConfirm();
  const [offlineSession, setOfflineSession] = useReactState<OfflineSession | null>(null);
  const [globalCatalogs, setGlobalCatalogs] = useReactState<OfflineCatalogs | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  // Cargar sesión offline + catálogos globales de IndexedDB
  useReactEffect(() => {
    if (!sessionId) return;
    console.log("[mobile page] loading offline session", sessionId);
    getDownloadedSession(sessionId).then((s) => {
      console.log("[mobile page] getDownloadedSession result", !!s, s?.id);
      setOfflineSession(s);
    }).catch((err) => {
      console.error("[mobile page] getDownloadedSession error", err);
    });
    getGlobalCatalogs().then(setGlobalCatalogs);
  }, [sessionId]);

  const refreshOffline = () => {
    getDownloadedSession(sessionId).then(setOfflineSession);
    // Invalidar cache de React Query para que se recarguen los datos online
    queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
  };
  const handleOfflineSaved = (updated?: OfflineSession) => {
    if (updated) {
      setOfflineSession(updated);
    } else {
      refreshOffline();
    }
  };
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Realtime: escuchar cambios en evidences, damages, checklists y signatures
  useRealtime("inspection_evidences", [["inspection-session", sessionId]], !!sessionId && online);
  useRealtime("inspection_damages", [["inspection-session", sessionId]], !!sessionId && online);
  useRealtime("inspection_checklists", [["inspection-session", sessionId]], !!sessionId && online);
  useRealtime("inspection_signatures", [["inspection-session", sessionId], ["signatures", sessionId]], !!sessionId && online);

  const { data: serverSession, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId) as Promise<SessionDetail>,
    enabled: !!sessionId && online,
    retry: false,
  });
  // Modo offline si: no hay internet O el query online falló Y tenemos sesión descargada
  const isOfflineMode = (!online || (online && isError && !!offlineSession)) && !!offlineSession;
  const session = isOfflineMode ? offlineSession?.session ?? null : serverSession ?? null;

  const { data: workPeriods } = useQuery({
    queryKey: ["inspection-work-periods", sessionId],
    queryFn: () => getWorkPeriods(sessionId),
    enabled: !!sessionId,
  });

  const { data: desistidaReasons } = useQuery({
    queryKey: ["lookup-catalog", "cancellation_reason_desistida"],
    queryFn: () => getLookupCatalog("cancellation_reason_desistida"),
  });

  const sessionStatus = (session?.status ?? "") as string;
  const sessionSubstate = (session?.substate ?? "normal") as string;
  const isPlanned = sessionStatus === "scheduled";
  const isPaused = isPlanned && sessionSubstate === "paused";
  const isActive = sessionStatus === "active";
  const effectiveInspectorId = session?.inspector_id ?? session?.claim?.inspector_id ?? null;
  const isAssignedInspector = !!profile?.id && effectiveInspectorId === profile.id;
  const isAccessBlocked = useMemo(() => {
    if (!session || !profile) return false;
    // Sin conexión y con sesión descargada: acceso permitido (es su dispositivo)
    if (!online && isOfflineMode) return false;
    // Online: verificar bloqueo normalmente
    return !canAccessInspectionSession(session, profile, dataAccess);
  }, [session, profile, dataAccess, isOfflineMode, online]);

  // Si estamos online pero la query falló y usamos la sesión de IndexedDB,
  // y el usuario actual NO es el que la descargó, bloquear acceso
  const isOfflineBlockedByOtherOnline = online && isOfflineMode && !!offlineSession && offlineSession.inspectorId !== profile?.id;

  // Bloqueo específico por descarga offline
  const offlineDownloadedBy = session?.offline_downloaded_by ?? null;
  const isOfflineBlocked = isAccessBlocked && !!offlineDownloadedBy;
  const isMyOfflineDownload = isOfflineBlocked && offlineDownloadedBy === profile?.id;
  const offlineInspectorName = (session as SessionDetail | null)?.offlineInspector?.full_name ?? null;
  const canForceRelease = isOfflineBlocked && !isMyOfflineDownload && (dataAccess?.is_admin || profile?.role === "internal");

  const startMutation = useMutation({
    mutationFn: (id: string) => startInspection(id, true),
    onSuccess: () => {
      toast.success("Inspección iniciada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutation para guardar geolocalización capturada
  const geoMutation = useMutation({
    mutationFn: async (input: {
      geo_latitude: number;
      geo_longitude: number;
      geo_captured_at: string;
      geo_captured_by: string | undefined;
      geo_distance_meters: number;
      geo_status: string;
      geo_map_url: string;
    }) => updateInspectionSession(sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    },
    onError: (err: Error) => toast.error("Error al guardar ubicación: " + err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => resumeInspection(id, true),
    onSuccess: () => {
      toast.success("Inspección reanudada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => pauseInspection(id),
    onSuccess: () => {
      toast.success("Inspección pausada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelInspectionViaCIN({
      sessionId,
      claimId: session?.claim_id ?? "",
      insActionId: session?.claim_action_id,
      reasonId: cancelReasonId,
      notes: cancelNotes || undefined,
      cancelledBy: profile?.id,
      userId: profile?.user_id,
    }),
    onSuccess: () => {
      toast.success("Inspección cancelada");
      setCancelModalOpen(false);
      setCancelReasonId("");
      setCancelNotes("");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Liberar inspección descargada offline (desde el mismo dispositivo o forzado)
  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (offlineSession) {
        // Mismo dispositivo: sincronizar cambios primero, luego liberar
        const hasChanges = hasPendingChanges(offlineSession.pending);
        if (hasChanges) {
          const result = await syncInspection(sessionId);
          if (!result.success) {
            throw new Error(`Sincronización con errores: ${result.errors.length} falla(s)`);
          }
        }
        await releaseDownloadedSession(sessionId);
      } else {
        // Si no está en IndexedDB (otro dispositivo), forzar liberación
        await forceReleaseOfflineSession(sessionId, profile?.user_id);
      }
    },
    onSuccess: () => {
      toast.success("Inspección liberada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Liberar inspección descargada offline con confirmación previa
  const handleReleaseOffline = async () => {
    if (isMyOfflineDownload) {
      // Mismo dispositivo: sincronizar cambios y poner en línea
      const hasChanges = offlineSession ? hasPendingChanges(offlineSession.pending) : false;
      const ok = await confirm({
        title: hasChanges ? "Sincronizar y poner en línea" : "Poner en línea",
        description: hasChanges
          ? "Se subirán los cambios pendientes al servidor y la inspección volverá a estar disponible en línea. Ya no podrás editarla sin conexión."
          : "La inspección volverá a estar disponible en línea. Ya no podrás editarla sin conexión.",
        confirmLabel: "Sincronizar",
        destructive: false,
      });
      if (!ok) return;
      releaseMutation.mutate();
    } else if (canForceRelease) {
      // Otro dispositivo (admin/internal): forzar liberación, se pierden los datos del dispositivo original
      const ok = await confirm({
        title: "Liberar inspección offline",
        description: `Esta inspección está siendo trabajada offline por ${offlineInspectorName || "otro inspector"}. Al liberarla, los datos no sincronizados del dispositivo original se perderán. Esta acción no se puede deshacer.`,
        confirmLabel: "Liberar",
        destructive: true,
      });
      if (!ok) return;
      releaseMutation.mutate();
    }
  };

  if (!sessionId) {
    return (
      <div className="mobile-empty">
        <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
        <p className="mobile-empty-text">ID de inspección inválido</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mobile-empty">
        <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
        <p className="mobile-empty-text">Cargando inspección...</p>
      </div>
    );
  }

  if (!online && !offlineSession) {
    return (
      <div className="mobile-empty">
        <CloudOff className="h-10 w-10 mobile-empty-icon" />
        <p className="mobile-empty-text">Sin conexión</p>
        <p className="app-body text-muted-foreground text-center px-6 mt-2">
          Esta inspección no está descargada para uso offline.
          <br />
          Conéctate a internet o descárgala desde el listado de inspecciones.
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mobile-empty">
        <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
        <p className="mobile-empty-text">Inspección no encontrada</p>
      </div>
    );
  }

  if (isAccessBlocked || isOfflineBlockedByOtherOnline) {
    // Bloqueo por descarga offline
    if (isOfflineBlocked || isOfflineBlockedByOtherOnline) {
      const hasChanges = offlineSession ? hasPendingChanges(offlineSession.pending) : false;
      return (
        <div className="mobile-empty">
          <Lock className="h-10 w-10 mobile-empty-icon" />
          <p className="mobile-empty-text">
            {isMyOfflineDownload
              ? "Inspección descargada en este dispositivo"
              : "Inspección en uso offline"}
          </p>
          <p className="app-body text-muted-foreground text-center px-6 mt-2">
            {isMyOfflineDownload
              ? hasChanges
                ? "Esta inspección está descargada en este dispositivo y tiene cambios pendientes. Sincroniza para subir los cambios al servidor y volver a tenerla disponible en línea."
                : "Esta inspección está descargada en este dispositivo. Sincroniza para volver a tenerla disponible en línea. No se perderán datos."
              : `Esta inspección está siendo trabajada offline por ${offlineInspectorName || "otro inspector"}. No puedes acceder hasta que la libere.`}
          </p>
          {(isMyOfflineDownload || canForceRelease) && (
            <div className="flex gap-2 mt-4">
              <button
                className={isMyOfflineDownload ? "mobile-btn" : "mobile-btn mobile-btn-danger"}
                disabled={releaseMutation.isPending}
                onClick={handleReleaseOffline}
              >
                {releaseMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando...</>
                ) : isMyOfflineDownload ? (
                  <><CloudUpload className="h-4 w-4" /> Sincronizar</>
                ) : (
                  "Liberar"
                )}
              </button>
            </div>
          )}
        </div>
      );
    }
    // Bloqueo genérico (inspección en curso con otro inspector)
    return (
      <div className="mobile-empty">
        <ClipboardCheck className="h-10 w-10 mobile-empty-icon" />
        <p className="mobile-empty-text">No puedes acceder a esta inspección. Está en curso con otro inspector.</p>
      </div>
    );
  }

  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");
  const address = claim?.claim_address || "Sin dirección";

  // Tabs en orden lógico de inspección presencial:
  // Resumen → Acta → Daños → Evidencias → Croquis → Firmas → Informe
  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: "resumen", label: "Resumen", icon: FileText },
    { id: "acta", label: "Acta", icon: FileCheck },
    { id: "danos", label: "Daños", icon: ShieldCheck },
    { id: "evidencias", label: "Fotos", icon: Camera },
    { id: "croquis", label: "Croquis", icon: Pencil },
    { id: "firmas", label: "Firmas", icon: PenTool },
    { id: "informe", label: "Informe", icon: FileText },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header: datos del siniestro + estado */}
      <div className="px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="mobile-inspection-code">
            {session.inspection_number || "Sin código"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`mobile-type-badge ${session.inspection_type === "remote" ? "mobile-type-badge-remote" : "mobile-type-badge-onsite"}`}>
              {session.inspection_type === "remote" ? <Video className="h-3 w-3" /> : <Home className="h-3 w-3" />}
              {session.inspection_type === "remote" ? "Remota" : "Presencial"}
            </span>
            <span className={`mobile-badge ${STATUS_BADGE[session.status]}`}>
              {isPaused ? "Pausada" : STATUS_LABELS[session.status]}
            </span>
          </div>
        </div>
        {/* Sync button cuando hay cambios pendientes */}
        {offlineSession && hasPendingChanges(offlineSession.pending) && online && (
          <div className="px-4 py-2 flex items-center justify-end border-b">
            <SyncButton
              sessionId={session.id}
              pending={offlineSession.pending}
              onSynced={refreshOffline}
            />
          </div>
        )}
        {/* Split 70-30: izquierda datos, derecha botones de acción */}
        <div className="mobile-header-split">
          {/* 70% — dirección + asegurado */}
          <div className="mobile-header-split-left">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{address}</span>
            </div>
            {insured && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{insured.full_name}</span>
              </div>
            )}
          </div>
          {/* 30% — botones de acción */}
          {isAssignedInspector && (isPlanned || isActive) && (
            <div className="mobile-header-split-right">
              {/* Scheduled + no pausada → Iniciar (verde) */}
              {isPlanned && !isPaused && (
                <button
                  className="mobile-btn mobile-btn-sm mobile-btn-success"
                  disabled={startMutation.isPending}
                  onClick={() => startMutation.mutate(session.id)}
                >
                  {startMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Iniciando...</>
                  ) : (
                    <><Play className="h-3 w-3" /> Iniciar</>
                  )}
                </button>
              )}
              {/* Scheduled + pausada → Reanudar (verde) */}
              {isPaused && (
                <button
                  className="mobile-btn mobile-btn-sm mobile-btn-success"
                  disabled={resumeMutation.isPending}
                  onClick={() => resumeMutation.mutate(session.id)}
                >
                  {resumeMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Reanudando...</>
                  ) : (
                    <><FastForward className="h-3 w-3" /> Reanudar</>
                  )}
                </button>
              )}
              {/* Active → Pausar (naranja) */}
              {isActive && (
                <button
                  className="mobile-btn mobile-btn-sm mobile-btn-warning"
                  disabled={pauseMutation.isPending}
                  onClick={() => pauseMutation.mutate(session.id)}
                >
                  {pauseMutation.isPending ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Pausando...</>
                  ) : (
                    <><Pause className="h-3 w-3" /> Pausar</>
                  )}
                </button>
              )}
              {/* Detener (rojo) */}
              <button
                className="mobile-btn mobile-btn-sm mobile-btn-danger"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelModalOpen(true)}
                aria-label="Cancelar inspección"
              >
                <XCircle className="h-3 w-3" />
                Detener
              </button>
            </div>
          )}
        </div>
      </div>



      {/* Work periods indicator */}
      {workPeriods && workPeriods.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b">
          <Clock className="h-3 w-3" />
          <span>{workPeriods.length} período{workPeriods.length > 1 ? "s" : ""} de trabajo</span>
        </div>
      )}

      {/* Tabs horizontales — enfocadas en campo */}
      <div className="mobile-tabs-wrap sticky top-0 bg-background z-10">
        <div className="mobile-tabs">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`mobile-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  // Auto-reanudar si la inspección está pausada y el inspector
                  // quiere trabajar en ella (clic en cualquier tab de trabajo)
                  if (isPaused && isAssignedInspector && t.id !== "resumen" && !resumeMutation.isPending) {
                    resumeMutation.mutate(session.id);
                  }
                }}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab activo */}
      <div className="flex-1 px-4 py-4">
        {activeTab === "resumen" && (
          <MobileResumenTab
            session={session}
            isAssignedInspector={isAssignedInspector}
            profileId={profile?.id}
            onGeoCapture={(result) => geoMutation.mutate({
              geo_latitude: result.coords.lat,
              geo_longitude: result.coords.lng,
              geo_captured_at: new Date().toISOString(),
              geo_captured_by: profile?.id,
              geo_distance_meters: result.distance,
              geo_status: result.status,
              geo_map_url: result.mapUrl,
            })}
          />
        )}
        {activeTab === "acta" && <MobileActaTab sessionId={session.id} offlineMode={isOfflineMode} onOfflineSaved={refreshOffline} />}
        {activeTab === "danos" && (
          <MobileDamagesTab
            sessionId={session.id}
            propertyClassification={offlineSession?.pending.acta?.property_risk?.risk_class ?? session.property_risk?.risk_class ?? offlineSession?.session.property_risk?.risk_class}
            countryId={session.claim?.country_id}
            sessionStatus={session.status}
            offlineMode={isOfflineMode}
            offlineCatalogs={globalCatalogs}
            session={session}
            offlineSession={offlineSession}
            onOfflineSaved={handleOfflineSaved}
          />
        )}
        {activeTab === "evidencias" && <MobileEvidencesTab sessionId={session.id} sessionStatus={session.status} offlineMode={isOfflineMode} onOfflineSaved={refreshOffline} />}
        {activeTab === "croquis" && (
          <MobileSketchesTab
            sessionId={session.id}
            sessionStatus={session.status}
            magicLinkToken={session.magic_link_token || undefined}
            offlineMode={isOfflineMode}
            onOfflineSaved={refreshOffline}
          />
        )}
        {activeTab === "firmas" && (
          <MobileSignaturesTab
            sessionId={session.id}
            sessionStatus={session.status}
            magicLinkToken={session.magic_link_token || undefined}
            inspectionType={session.inspection_type as "onsite" | "remote" | undefined}
            signatureWaiverReason={session.signature_waiver_reason}
            offlineMode={isOfflineMode}
            onOfflineSaved={refreshOffline}
          />
        )}
        {activeTab === "informe" && <MobileReportTab sessionId={session.id} offlineMode={isOfflineMode} offlineSession={offlineSession} />}
      </div>

      {/* Modal de cancelación */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => !cancelMutation.isPending && setCancelModalOpen(false)}>
          <div className="bg-background w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-base">Cancelar inspección</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Se registrará como desistida.
            </p>
            <div className="space-y-2">
              <label className="mobile-label">Motivo *</label>
              <select
                className="mobile-input"
                disabled={cancelMutation.isPending}
                value={cancelReasonId}
                onChange={(e) => setCancelReasonId(e.target.value)}
              >
                <option value="">Seleccionar motivo...</option>
                {desistidaReasons?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="mobile-label">Notas adicionales</label>
              <textarea
                className="mobile-textarea"
                rows={3}
                disabled={cancelMutation.isPending}
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Notas sobre la cancelación..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                className="mobile-btn mobile-btn-outline flex-1"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelModalOpen(false)}
              >
                Cerrar
              </button>
              <button
                className="mobile-btn mobile-btn-danger flex-1"
                disabled={!cancelReasonId || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Cancelando...</>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Resumen ──
function MobileResumenTab({
  session,
  isAssignedInspector,
  profileId,
  onGeoCapture,
}: {
  session: SessionDetail;
  isAssignedInspector: boolean;
  profileId?: string;
  onGeoCapture: (result: {
    coords: { lat: number; lng: number };
    distance: number;
    status: string;
    mapUrl: string;
  }) => void;
}) {
  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");
  const claimCoords = claim?.claim_latitude != null && claim?.claim_longitude != null
    ? { lat: claim.claim_latitude, lng: claim.claim_longitude }
    : null;

  return (
    <div className="space-y-4">
      {/* Datos del siniestro */}
      <div className="mobile-card">
        <p className="mobile-card-title">Datos del siniestro</p>
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Liquidación</span>
          <span className="mobile-card-row-value">{claim?.liquidation_number || "—"}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Ref. cliente</span>
          <span className="mobile-card-row-value">{claim?.client_reference || "—"}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Dirección</span>
          <span className="mobile-card-row-value">{claim?.claim_address || "—"}</span>
        </div>
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Tipo</span>
          <span className="mobile-card-row-value inline-flex items-center gap-1">
            {session.inspection_type === "remote" ? <Video className="h-3.5 w-3.5 mobile-type-icon-remote" /> : <Home className="h-3.5 w-3.5 mobile-type-icon-onsite" />}
            {session.inspection_type === "remote" ? "Remota (videollamada con asegurado)" : "Presencial (inspector en campo)"}
          </span>
        </div>
        {session.scheduled_at && (
          <div className="mobile-card-row">
            <span className="mobile-card-row-label">Programada</span>
            <span className="mobile-card-row-value">
              {new Date(session.scheduled_at).toLocaleString("es-CL", {
                timeZone: getUserTimeZone(),
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: false,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Asegurado */}
      {insured && (
        <div className="mobile-card">
          <p className="mobile-card-title">Asegurado</p>
          <p className="text-sm font-medium">{insured.full_name}</p>
        </div>
      )}

      {/* Estado de la inspección */}
      <div className="mobile-card">
        <p className="mobile-card-title">Estado de la inspección</p>
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Estado</span>
          <span className="mobile-card-row-value">{STATUS_LABELS[session.status]}</span>
        </div>
        {session.substate === "paused" && (
          <div className="mobile-card-row">
            <span className="mobile-card-row-label">Subestado</span>
            <span className="mobile-card-row-value">Pausada</span>
          </div>
        )}
        <div className="mobile-card-row">
          <span className="mobile-card-row-label">Inspector asignado</span>
          <span className="mobile-card-row-value">
            {isAssignedInspector ? "Tú" : "Otro inspector"}
          </span>
        </div>
      </div>

      {/* Geolocalización del lugar (presencial: captura automática al iniciar) */}
      {session.inspection_type === "onsite" && session.status === "active" && (
        <GeoCapture
          title="Geolocalización del Lugar del Siniestro"
          inspectionType="onsite"
          sessionId={session.id}
          capturedBy={profileId}
          claimCoords={claimCoords}
          claimAddress={claim?.claim_address || undefined}
          initialCoords={session.geo_latitude && session.geo_longitude ? { lat: session.geo_latitude, lng: session.geo_longitude } : null}
          initialDistance={session.geo_distance_meters}
          initialStatus={(session.geo_status as "pending" | "verified" | "out_of_range" | "failed") || "pending"}
          disabled={false}
          onCapture={onGeoCapture}
        />
      )}

      {/* Aviso si no es inspector asignado */}
      {!isAssignedInspector && session.status === "scheduled" && (
        <div className="mobile-card border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-600">
            Solo el inspector asignado puede iniciar o reanudar esta inspección.
          </p>
        </div>
      )}
    </div>
  );
}
