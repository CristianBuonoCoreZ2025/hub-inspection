"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
 getInspectionSessionById,
 updateInspectionSession,
 moveInspectionDate,
 resumeInspection,
 startInspection,
 getWorkPeriods,
 rescheduleInspectionViaCIN,
 cancelInspectionViaCIN,
 canAccessInspectionSession,
} from "@/services/inspections";
import { getInspectionMaxDate } from "@/server/actions/inspections";
import { updateClaimStatus } from "@/services/claims";
import { getLookupCatalog } from "@/services/catalogs";
import { getUsers, getUsersByRoleForCompany } from "@/services/users";
import { usePermissions } from "@/hooks/use-permissions";
import { formatUserDateTime as formatDateTime, formatDuration } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const GeoCapture = dynamic(() => import("@/components/inspection/geo-capture").then((m) => ({ default: m.GeoCapture })), { ssr: false });
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import {
 ArrowLeft,
 ClipboardCheck,
 XCircle,
 FileText,
 MapPin,
 MapPinned,
 Map,
 User,
 Mail,
 Phone,
 Clock,
 ShieldCheck,
 MessageSquare,
 Video,
 RotateCcw,
 CalendarClock,
 Play,
 FastForward,
 AlertTriangle,
 CheckCircle2,
 Loader2,
 Camera,
 Wifi,
 ChevronRight,
 ChevronLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useAlert } from "@/components/ui/alert-context";
import { Badge } from "@/components/ui/badge";
import { MagicLinkSender } from "@/components/ui/magic-link-sender";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
// Tabs components no longer used — replaced with flat tab style matching claims page
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import {
 Popover,
 PopoverTrigger,
 PopoverContent,
} from "@/components/ui/popover";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { CoordScheduler } from "@/components/inspections/coord-scheduler";
import { Label } from "@/components/ui/label";
import type { InspectionSession } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import ActaForm from "./acta-form";
import DamagesTab from "./damages-tab";
import EvidencesTab from "./evidences-tab";
import SignaturesTab from "./signatures-tab";
import ReportTab from "./report-tab";
import SketchesTab from "./sketches-tab";
import ChatTab from "./chat-tab";
import ConnectionLogsTab from "./connection-logs-tab";
import EventLogsTab from "./event-logs-tab";
import { LiveVideoCall } from "@/components/inspection/live-video-call";
import { logConnectionEvent } from "@/services/connection-logs";

// Fix iconos de Leaflet en Next.js (CDN)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Mapea estado de inspección → código de estado de claim
const sessionToClaimStatusCode: Record<string, string> = {
 scheduled: "dispatchment",
 active: "adjustment",
 completed: "adjustment",
 cancelled: "created",
};
// Nota: "pending" ya no existe en el flujo. La inspección nace como "scheduled".

const sessionStatusLabels: Record<string, string> = {
 pending: "Pendiente",
 scheduled: "Agendada",
 active: "En progreso",
 completed: "Completada",
 cancelled: "Cancelada",
};

const sessionStatusColors: Record<string, string> = {
 pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
 scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
 active: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
 paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
 completed: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
 cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDate(dateStr: string | null) {
 if (!dateStr) return "—";
 // Las columnas `date` no tienen zona horaria: formatear en UTC para no cambiar el día
 return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("es-CL", {
 timeZone: "UTC",
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 });
}

function NotStartedNotice() {
 return (
 <div className="app-panel">
 <h3 className="app-section-title">Pendiente</h3>
 <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
 <p className="app-body text-amber-950 dark:text-amber-100">
 Inicia la inspección desde la pestaña Resumen para acceder a esta sección.
 </p>
 </div>
 </div>
 );
}

export default function InspectionDetailPage() {
 const params = useParams();
 const router = useRouter();
 const queryClient = useQueryClient();
 const confirmAction = useConfirm();
 const showAlert = useAlert();
 const sessionId = params.id as string;
 const { canView } = usePermissions();
 const { profile, dataAccess } = useAuth();
 const [activeTab, setActiveTab] = useState("resumen");
 const tabSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const [cancelModalOpen, setCancelModalOpen] = useState(false);
 const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
 const [moveDateModalOpen, setMoveDateModalOpen] = useState(false);
 const [moveSelectedDatetime, setMoveSelectedDatetime] = useState<string>("");
 const [cancelReasonId, setCancelReasonId] = useState<string>("");
 const [cancelNotes, setCancelNotes] = useState<string>("");
 const [rescheduleSelectedDatetime, setRescheduleSelectedDatetime] = useState<string>("");
 const [rescheduleType, setRescheduleType] = useState<"onsite" | "remote">("onsite");
 const [rescheduleInspectorId, setRescheduleInspectorId] = useState<string>("");
 const [chatPanelOpen, setChatPanelOpen] = useState(false);
 const [videoCallOpen, setVideoCallOpen] = useState(false);
 const [mapViewOpen, setMapViewOpen] = useState(false);
 const [geoCapturedModalOpen, setGeoCapturedModalOpen] = useState(false);
 const [geoCapturedData, setGeoCapturedData] = useState<{ lat: number; lng: number; distance: number | null; status: string } | null>(null);
 const [geoSavingEvidence, setGeoSavingEvidence] = useState(false);
 const [geoRecapturing, setGeoRecapturing] = useState(false);
 const geoMapRef = useRef<HTMLDivElement | null>(null);

 const saveGeoMapEvidence = async () => {
   if (!geoCapturedData || !geoMapRef.current || !sessionId) return;
   setGeoSavingEvidence(true);
   try {
     // Esperar a que los tiles del mapa terminen de cargar
     await new Promise((resolve) => setTimeout(resolve, 2000));
     const html2canvas = (await import("html2canvas-pro")).default;
     const canvas = await html2canvas(geoMapRef.current, {
       useCORS: true,
       allowTaint: true,
       backgroundColor: "#ffffff",
       scale: 2,
       imageTimeout: 15000,
     });
     const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.9));
     if (!blob) throw new Error("No se pudo capturar el mapa");

     const formData = new FormData();
     formData.append("file", new File([blob], `geo_map_${Date.now()}.png`, { type: "image/png" }));
     formData.append("sessionId", sessionId);
     formData.append("lat", String(geoCapturedData.lat));
     formData.append("lng", String(geoCapturedData.lng));
     formData.append("source", "geo_map");
     formData.append("label", "asegurado");
     if (profile?.id) formData.append("capturedBy", profile.id);

     const res = await fetch("/api/inspection/evidences/upload", {
       method: "POST",
       body: formData,
     });
     if (!res.ok) throw new Error(`HTTP ${res.status}`);

     showAlert({
      title: "Evidencia guardada",
      description: "El mapa de geolocalización se guardó como evidencia.",
      type: "info",
    });
    queryClient.invalidateQueries({ queryKey: ["inspection-evidences", sessionId] });
    setGeoCapturedModalOpen(false);
  } catch (err) {
    showAlert({
      title: "No se pudo guardar la evidencia",
      description: err instanceof Error ? err.message : "Error desconocido",
      type: "error",
    });
  } finally {
    setGeoSavingEvidence(false);
 }
};

 // Solicitar recaptura: llama al mismo endpoint que el boton del MagicLinkSender
 // Limpia los campos geo_* y habilita geo_recapture_enabled para que el asegurado
 // pueda capturar de nuevo desde el Magic Link
 const handleRequestRecapture = async () => {
   if (!sessionId) return;
   setGeoRecapturing(true);
   try {
     const res = await fetch("/api/inspection/geo/enable-recapture", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ sessionId }),
     });
     if (!res.ok) {
       const data = await res.json().catch(() => ({}));
       throw new Error(data.error || `HTTP ${res.status}`);
     }
     // Resetear el ref para que el polling detecte la proxima captura
     prevGeoCapturedAtRef.current = null;
     queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
     setGeoCapturedModalOpen(false);
     showAlert({
       title: "Recaptura habilitada",
       description: "El asegurado ya puede capturar su ubicación nuevamente.",
       type: "info",
     });
   } catch (err) {
     showAlert({
       title: "No se pudo habilitar la recaptura",
       description: err instanceof Error ? err.message : "Error desconocido",
       type: "error",
     });
   } finally {
     setGeoRecapturing(false);
   }
 };
 const autoVideoOpenedRef = useRef(false);
 // Ref para el ID del log de conexión del inspector
 const inspectorLogIdRef = useRef<string | null>(null);

 const { codeToId } = useClaimStatuses();

 const { data: session, isLoading, isError, error } = useQuery({
 queryKey: ["inspection-session", sessionId],
 queryFn: () => getInspectionSessionById(sessionId),
 retry: false,
 staleTime: 0,
 refetchOnMount: true,
 refetchInterval: (query) => {
 const s = query.state.data as InspectionSession | undefined;
 return s?.inspection_type === "remote" && s?.status === "active" ? 10000 : false;
 },
 });

 // Límites de fecha para reagendamiento/mover fecha:
 // máximo = fecha_creacion_claim + days_to_issue del CIN (días hábiles)
 const { data: inspectionMaxDate } = useQuery({
   queryKey: ["inspection-max-date", session?.claim_id],
   queryFn: () => getInspectionMaxDate(session!.claim_id!),
   enabled: !!session?.claim_id,
   staleTime: Infinity, // no cambia mientras la sesión está abierta
 });
 const rescheduleMaxDate = inspectionMaxDate?.maxDate;

 const sessionStatus = (session?.status ?? "") as string;
 const sessionSubstate = (session?.substate ?? "normal") as string;
 const isPlanned = sessionStatus === "scheduled";
 const isMovable = isPlanned || sessionStatus === "active";
 const isPaused = isPlanned && sessionSubstate === "paused";
 const isRemote = session?.inspection_type === "remote";
 // Solo el inspector asignado puede iniciar o reanudar la inspección
 const effectiveInspectorId = session?.inspector_id ?? session?.claim?.inspector_id ?? null;
 const isAssignedInspector = !!profile?.id && effectiveInspectorId === profile.id;

 // Realtime: reflejar firmas del asegurado inmediatamente en el dashboard
 useRealtime("inspection_signatures", [["inspection-session", sessionId], ["signatures", sessionId]], !!sessionId);
 // Detectar cuando el asegurado captura la ubicacion (inspeccion remota)
// Doble mecanismo: polling (la sesion se refresca cada 10s) + realtime Supabase
// Importante: solo disparamos el popup cuando geo_captured_at CAMBIA a un valor
// NUEVO. Si la pagina carga con una captura ya existente (ya guardada como
// evidencia), NO se levanta el popup. Solo se levanta si el valor cambia
// despues del montaje (captura nueva o recaptura).
const prevGeoCapturedAtRef = useRef<string | null | undefined>(undefined);
const showGeoPopup = useCallback((lat: number, lng: number, distance: number | null, status: string) => {
  setGeoCapturedData({ lat, lng, distance, status });
  setGeoCapturedModalOpen(true);
  queryClient.invalidateQueries({ queryKey: ["inspection-evidences", sessionId] });
}, [sessionId, queryClient]);

// Inicializar el ref con el valor actual al montar/cargar la sesion por primera vez
// Asi evitamos que el polling dispare el popup para una captura que ya existia
useEffect(() => {
  if (prevGeoCapturedAtRef.current === undefined && session) {
    prevGeoCapturedAtRef.current = session.geo_captured_at || null;
  }
}, [session]);

// Deteccion por polling: cuando session.geo_captured_at cambia a un valor NUEVO
useEffect(() => {
  if (!session?.geo_captured_at) return;
  if (session.geo_status !== "verified" && session.geo_status !== "out_of_range") return;
  const current = session.geo_captured_at;
  const prev = prevGeoCapturedAtRef.current;
  // Solo disparar si el valor cambio Y no es la inicializacion
  if (prev !== undefined && current !== prev) {
    prevGeoCapturedAtRef.current = current;
    if (session.geo_latitude != null && session.geo_longitude != null) {
      showGeoPopup(session.geo_latitude, session.geo_longitude, session.geo_distance_meters, session.geo_status);
    }
  }
}, [session?.geo_captured_at, session?.geo_status, session?.geo_latitude, session?.geo_longitude, session?.geo_distance_meters, showGeoPopup]);

// Deteccion por realtime (backup: deteccion inmediata sin esperar polling)
useEffect(() => {
  if (!sessionId) return;
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`geo-status-${sessionId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "inspection_sessions", filter: `id=eq.${sessionId}` },
      (payload: { new: Record<string, unknown> }) => {
        const newGeoStatus = payload.new?.geo_status as string | null;
        const newGeoCapturedAt = payload.new?.geo_captured_at as string | null;
        const oldGeoCapturedAt = prevGeoCapturedAtRef.current;
        const isCapture = oldGeoCapturedAt !== undefined && newGeoCapturedAt && newGeoCapturedAt !== oldGeoCapturedAt &&
          (newGeoStatus === "verified" || newGeoStatus === "out_of_range");
        if (isCapture) {
          prevGeoCapturedAtRef.current = newGeoCapturedAt;
          const newLat = payload.new?.geo_latitude as number | null;
          const newLng = payload.new?.geo_longitude as number | null;
          const newDistance = payload.new?.geo_distance_meters as number | null;
          if (newLat != null && newLng != null) {
            showGeoPopup(newLat, newLng, newDistance, newGeoStatus);
          }
          queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
        }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId]);

const { data: fullSession, isLoading: isFullLoading } = useQuery({
queryKey: ["inspection-session-full", sessionId],
queryFn: () => getInspectionSessionById(sessionId),
enabled: activeTab === "informe",
 retry: false,
 staleTime: 5 * 60 * 1000,
 });

 const isAccessBlocked = useMemo(() => {
   if (!session || !profile) return false;
   return !canAccessInspectionSession(session, profile, dataAccess);
 }, [session, profile, dataAccess]);

 useEffect(() => {
 if (session && session.inspection_type === "remote" && session.status === "active" && !autoVideoOpenedRef.current && !isAccessBlocked) {
 autoVideoOpenedRef.current = true;
 setChatPanelOpen(true);
 setVideoCallOpen(true);
 }
 }, [session, isAccessBlocked]);

 const { data: users } = useQuery({
 queryKey: ["users"],
 queryFn: () => getUsers(),
 });
 // company_id del claim para filtrar inspectores por empresa (igual que el form CIN)
 const claimCompanyId = (session?.claim as Record<string, unknown> | undefined)?.company_id as string | undefined;
 // Inspectores via RPC (bypassa RLS, igual que el formulario de coordinación CIN)
 const { data: inspectorList } = useQuery({
 queryKey: ["users-by-role", "inspector", claimCompanyId],
 queryFn: () => getUsersByRoleForCompany("inspector", claimCompanyId),
 enabled: !!session?.claim_id,
 });
 const inspectors = inspectorList || [];
 // Fallback: si la RPC no retorna datos, usar getUsers() filtrado client-side
 const inspectorsFallback = users?.filter((u) => u.role === "inspector" || u.secondary_roles?.some((r) => r.role === "inspector")) || [];
 const allInspectors = inspectors.length > 0 ? inspectors : inspectorsFallback;

 // Helper para buscar nombre de usuario sin depender del filtro de inspectores
 const userName = (id?: string | null) => {
   if (!id) return null;
   const u = users?.find((u) => u.id === id);
   return u?.full_name || u?.email || null;
 };

 // La agenda del inspector y los slots ahora los maneja CoordScheduler.
 // (mismo componente que la coordinación en DynamicScreen)

 // Cargar motivos: fallida para reagendar, desistida para cancelar
 // Se cargan siempre para poder mostrar el motivo de sesiones canceladas
 const { data: workPeriods } = useQuery({
 queryKey: ["inspection-work-periods", sessionId],
 queryFn: () => getWorkPeriods(sessionId),
 enabled: !!sessionId,
 });

 const { data: fallidaReasons } = useQuery({
 queryKey: ["lookup-catalog", "cancellation_reason_fallida"],
 queryFn: () => getLookupCatalog("cancellation_reason_fallida"),
 });
 const { data: desistidaReasons } = useQuery({
 queryKey: ["lookup-catalog", "cancellation_reason_desistida"],
 queryFn: () => getLookupCatalog("cancellation_reason_desistida"),
 });
 // Motivos combinados para mostrar el motivo de una sesión ya cancelada
 const allCancellationReasons = [...(fallidaReasons || []), ...(desistidaReasons || [])];

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
 updateInspectionSession(id, input),
 onSuccess: async (_data, variables) => {
 showAlert({ title: "Estado actualizado", description: "El estado de la inspección se actualizó correctamente.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });

 const newStatus = variables.input.status;
 if (newStatus && session?.claim_id) {
 const statusCode = sessionToClaimStatusCode[newStatus];
 const statusId = statusCode ? codeToId[statusCode] : null;
 if (statusId) {
 try {
 await updateClaimStatus(session.claim_id, statusId, profile?.id);
 queryClient.invalidateQueries({ queryKey: ["claim", session.claim_id] });
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 } catch {
 // No bloquear la UI si el claim no se puede actualizar
 }
 }
 }
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 function handleTabClick(tabId: string) {
   setActiveTab(tabId);
   if (tabSyncTimerRef.current) {
     clearTimeout(tabSyncTimerRef.current);
   }
   tabSyncTimerRef.current = setTimeout(() => {
     if (session) {
       syncTabMutation.mutate({ id: session.id, tab: tabId });
     }
   }, 1500);
 }

 // Sincronizar el tab activo con el cliente (piloto automático)
 const syncTabMutation = useMutation({
 mutationFn: async ({ id, tab }: { id: string; tab: string }) => {
 const res = await fetch(`/api/inspection/sessions/${id}/active-tab`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ active_tab: tab }),
 });
 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 throw new Error(err.detail || err.error || `HTTP ${res.status}`);
 }
 return res.json();
 },
 onError: () => {/* silencioso: no afecta al inspector si falla */},
 });

 const cancelMutation = useMutation({
 mutationFn: ({ id, claimId, insActionId, reasonId, notes }: {
 id: string; claimId: string; insActionId?: string | null; reasonId: string; notes?: string;
 }) => cancelInspectionViaCIN({
 sessionId: id,
 claimId,
 insActionId,
 reasonId,
 notes,
 cancelledBy: profile?.id,
 userId: profile?.id,
 }),
 onSuccess: async () => {
 showAlert({ title: "Inspección cancelada", description: "Se generó gestión CIN de desistimiento.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
 // Invalidar la agenda del inspector (la sesión cancelada libera el horario)
 queryClient.invalidateQueries({ queryKey: ["inspector-schedule"] });
 setCancelModalOpen(false);
 setCancelReasonId("");
 setCancelNotes("");
 // Actualizar estado del claim
 if (session?.claim_id) {
 const statusId = codeToId["created"];
 if (statusId) {
 try {
 await updateClaimStatus(session.claim_id, statusId, profile?.id);
 queryClient.invalidateQueries({ queryKey: ["claim", session.claim_id] });
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 } catch {}
 }
 }
 // Volver al siniestro (la INS fue rechazada, no hay nueva inspección)
 if (session?.claim_id && canOpenClaim) router.push(`/dashboard/claims/${session.claim_id}`);
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 const rescheduleMutation = useMutation({
 mutationFn: ({ currentId, claimId, insActionId, reasonId, notes, newOptions }: {
 currentId: string; claimId: string; insActionId?: string | null;
 reasonId: string; notes?: string;
 newOptions: { inspectionType: "onsite" | "remote"; scheduledAt: string; inspectorId?: string };
 }) => rescheduleInspectionViaCIN({
 sessionId: currentId,
 claimId,
 insActionId,
 reasonId,
 notes,
 newOptions,
 cancelledBy: profile?.id,
 userId: profile?.id,
 }),
 onSuccess: () => {
 showAlert({ title: "Inspección reagendada", description: "Se generó gestión CIN para re-coordinar.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
 // Invalidar la agenda del inspector para que la próxima vez muestre
 // las horas ocupadas actualizadas (sesión nueva agendada, vieja cancelada)
 queryClient.invalidateQueries({ queryKey: ["inspector-schedule"] });
 setRescheduleModalOpen(false);
 setCancelReasonId("");
 setCancelNotes("");
 setRescheduleSelectedDatetime("");
 setRescheduleInspectorId("");
 // Volver al siniestro — el usuario debe completar la nueva CIN
 if (session?.claim_id && canOpenClaim) router.push(`/dashboard/claims/${session.claim_id}`);
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 const moveDateMutation = useMutation({
 mutationFn: ({ sessionId: id, scheduledAt }: { sessionId: string; scheduledAt: string }) =>
 moveInspectionDate(id, scheduledAt),
 onSuccess: () => {
 showAlert({ title: "Fecha actualizada", description: "La fecha de inspección se actualizó correctamente.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["inspector-schedule"] });
 queryClient.invalidateQueries({ queryKey: ["magic-link-live", session?.magic_link_token] });
 queryClient.invalidateQueries({ queryKey: ["inspection-work-periods", sessionId] });
 setMoveDateModalOpen(false);
 setMoveSelectedDatetime("");
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 const resumeMutation = useMutation({
 mutationFn: (id: string) => resumeInspection(id),
 onSuccess: () => {
 showAlert({ title: "Inspección reanudada", description: "La inspección se reanudó correctamente.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["inspector-schedule"] });
 queryClient.invalidateQueries({ queryKey: ["inspection-work-periods", sessionId] });
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 const startMutation = useMutation({
 mutationFn: (id: string) => startInspection(id),
 onSuccess: () => {
 showAlert({ title: "Inspección iniciada", description: "La inspección se inició correctamente.", type: "info" });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["inspector-schedule"] });
 queryClient.invalidateQueries({ queryKey: ["inspection-work-periods", sessionId] });
 },
 onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
 });

 if (isLoading) {
 return (
 <div className="app-page">
 <div className="flex items-center justify-center py-20">
 <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
 <span className="ml-2 text-muted-foreground">Cargando inspeccion...</span>
 </div>
 </div>
 );
 }

 if (!session) {
 return (
 <div className="app-page">
 <p className="text-muted-foreground py-20 text-center">
 No se encontro la sesion de inspeccion.
 {isError && (
 <span className="block mt-2 text-rose-500 app-body">
 Error: {(error as Error)?.message || "desconocido"}
 </span>
 )}
 </p>
 </div>
 );
 }

 if (isAccessBlocked) {
 return (
 <div className="app-page flex items-center justify-center">
 <div className="app-panel max-w-xl w-full p-8 text-center">
 <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
 <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-300" />
 </div>
 <h2 className="app-section-title mb-2">Inspección en curso</h2>
 <p className="app-body text-muted-foreground mb-4">
 Esta inspección se encuentra activa y en realización. Solo el inspector asignado puede acceder mientras esté en curso.
 </p>
 <p className="app-body text-sm text-muted-foreground">
 Si necesitas intervenir, contacta al supervisor para levantar el bloqueo.
 </p>
 </div>
 </div>
 );
 }

 type ClaimData = {
 claim_number?: string | null;
 client_reference?: string | null;
 claim_address?: string | null;
 claim_latitude?: number | null;
 claim_longitude?: number | null;
 policy_number?: string | null;
 claim_date?: string | null;
 report_date?: string | null;
 assignment_date?: string | null;
 liquidation_number?: string | null;
 broker_executive?: string | null;
 inspector_id?: string | null;
 assigned_adjuster_id?: string | null;
 adjuster_id?: string | null;
 auditor_id?: string | null;
 dispatcher_id?: string | null;
 assistant_id?: string | null;
 country_id?: string | null;
 insurance_company?: { name: string } | null;
 broker?: { name: string } | null;
 advisor?: { name: string } | null;
 claim_cause?: { name: string } | null;
 country?: { name: string } | null;
 region?: { name: string } | null;
 city?: { name: string } | null;
 commune?: { name: string } | null;
 claims_participants?: Array<{ type: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; cell_phone: string | null; rut?: string | null; address?: string | null; person_type?: string | null; country?: string | null; region?: string | null; city?: string | null; commune?: string | null }>;
};
 const claim = session.claim as ClaimData | undefined;
 const isUserAssignedToClaim = (() => {
   if (!claim || !profile?.id) return false;
   if (dataAccess?.is_admin || dataAccess?.see_all_client_claims) return true;
   const assigneeIds = [
     claim.assigned_adjuster_id,
     claim.adjuster_id,
     claim.inspector_id,
     claim.auditor_id,
     claim.dispatcher_id,
     claim.assistant_id,
   ];
   return assigneeIds.some((id) => id === profile.id);
 })();
 const canOpenClaim = canView("claims") && isUserAssignedToClaim;
 const participants = claim?.claims_participants || [];
 const insuredParticipant = participants.find((p) => p.type === "insured");
 const contactParticipant = participants.find((p) => p.type === "contact");

 // ── Datos heredados de la coordinación (CIN) ──
 // El claim_action (INS) tiene action_data.parent_action_data con los campos del CIN.
 // Los campos tienen IDs con sufijos (coord_ubic_1, coord_cont_1, etc.).
 const parentActionData = (session.claim_action?.action_data?.parent_action_data || {}) as Record<string, unknown>;
 const findCoord = (prefixes: string[]): string | undefined => {
   for (const key of Object.keys(parentActionData)) {
     if (key.includes("recoord")) continue;
     for (const prefix of prefixes) {
       if (key.startsWith(prefix)) {
         const v = parentActionData[key];
         if (v && typeof v === "string" && v.trim()) return v;
       }
     }
   }
   return undefined;
 };
 const coordAclaracionDireccion = findCoord(["coord_ubic", "coord_ubicacion"]);

 const allTabs = [
 { id: "resumen", label: "Resumen", icon: FileText, section: "inspecciones_detalle" },
 { id: "acta", label: "Acta", icon: ClipboardCheck, section: "inspecciones_acta" },
 { id: "danos", label: "Daños", icon: ShieldCheck, section: "inspecciones_danos" },
 { id: "evidencias", label: "Evidencias", icon: MapPin, section: "inspecciones_evidencias" },
 { id: "croquis", label: "Croquis", icon: MapPin, section: "inspecciones_croquis" },
 { id: "firmas", label: "Firmas", icon: User, section: "inspecciones_firmas" },
 { id: "informe", label: "Informe", icon: FileText, section: "inspecciones_informe" },
 { id: "conexiones", label: "Conexiones", icon: Wifi, section: "inspecciones_detalle" },
 { id: "eventos", label: "Eventos", icon: FileText, section: "inspecciones_detalle" },
 ];

 const tabs = allTabs.filter(t => canView(t.section));

 return (
 <div className="app-page">

 {/* Header */}
 <div className="flex items-center justify-between gap-3 pb-2">
 <div className="flex items-center gap-2.5 min-w-0">
 <Button
 variant="ghost"
 size="sm"
 className="btn-icon-sm shrink-0"
 onClick={() => router.push("/dashboard/inspecciones")}
 >
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <p className="app-body font-semibold truncate">
 {session.inspection_number || `Inspección ${session.id.slice(0, 8)}`}
 </p>
 <Badge className={sessionStatusColors[session.status]}>
 {sessionStatusLabels[session.status]}
 </Badge>
 {session.substate === "paused" && (
 <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
 Pausada
 </Badge>
 )}
 {session.inspection_type === "remote" && (
 <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">
 Remota
 </Badge>
 )}
 </div>

 </div>

 {/* Layout principal: tabs a la izquierda, comunicación lateral a la derecha */}
 <div className="flex gap-4 flex-1">
 {/* Contenido principal (tabs) */}
 <div className="flex-1 min-w-0">
 <div className="border-b">
 <div className="flex gap-1 overflow-x-auto">
 {tabs.map((t) => {
 const Icon = t.icon;
 const isActive = activeTab === t.id;
 return (
 <button
 key={t.id}
 onClick={() => handleTabClick(t.id)}
 className={`flex items-center gap-2 px-4 py-2.5 app-body font-medium border-b-2 transition-colors whitespace-nowrap ${
 isActive
 ? "border-primary text-primary"
 : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
 }`}
 >
 <Icon className="h-4 w-4" />
 {t.label}
 </button>
 );
 })}
 </div>
 </div>

 {/* ── TAB: RESUMEN ── */}
 {activeTab === "resumen" && (
 <div className="mt-4 space-y-2">
 {/* Información General + Asegurado (fusionados) */}
 <div className="app-panel py-3 px-4">
 <h3 className="app-section-title mb-2">
 Información General
 </h3>
 {/* Línea 1: datos del siniestro */}
 <div className="grid grid-cols-5 gap-x-4 gap-y-1 app-body">
 <div className="min-w-0">
 <span className="app-data-label">N° Interno</span>
 <p className="font-mono font-semibold text-primary truncate">
 {claim?.liquidation_number ? (
 canOpenClaim ? (
 <Link href={`/dashboard/claims/${session.claim_id}`} className="hover:underline">
 {claim.liquidation_number as string}
 </Link>
 ) : (
 <span className="text-foreground">{claim.liquidation_number as string}</span>
 )
 ) : (
 "—"
 )}
 </p>
 </div>
 <div className="min-w-0">
 <span className="app-data-label">Ref. Cliente</span>
 <p className="font-medium truncate">{(claim?.client_reference as string) || "—"}</p>
 </div>
 <div className="min-w-0">
 <span className="app-data-label">Compañia</span>
 <p className="font-medium truncate">{claim?.insurance_company?.name || "—"}</p>
 </div>
 <div className="min-w-0">
 <span className="app-data-label">Fecha Siniestro</span>
 <p className="font-medium whitespace-nowrap">{formatDate(claim?.claim_date as string | null)}</p>
 </div>
 <div className="min-w-0">
 <span className="app-data-label">Fecha Denuncia</span>
 <p className="font-medium whitespace-nowrap">{formatDate(claim?.report_date as string | null)}</p>
 </div>
 </div>

 {/* Línea 2+: datos del asegurado */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 app-body mt-2">
 <div>
 <span className="app-data-label">RUT Asegurado</span>
 <p className="font-medium">{insuredParticipant?.rut || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Nombre Asegurado</span>
 <p className="font-medium">{insuredParticipant?.first_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Apellido Asegurado</span>
 <p className="font-medium">{insuredParticipant?.last_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Email Asegurado</span>
 <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground shrink-0" />{insuredParticipant?.email || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Teléfono Asegurado</span>
 <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground shrink-0" />{insuredParticipant?.cell_phone || insuredParticipant?.phone || "—"}</p>
 </div>
 </div>

 {/* Línea 3: dirección del asegurado */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 app-body mt-2">
 <div>
 <span className="app-data-label">Dirección Asegurado</span>
 <p className="font-medium">{insuredParticipant?.address || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">País Asegurado</span>
 <p className="font-medium">{insuredParticipant?.country || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Región Asegurado</span>
 <p className="font-medium">{insuredParticipant?.region || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Ciudad Asegurado</span>
 <p className="font-medium">{insuredParticipant?.city || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Comuna Asegurado</span>
 <p className="font-medium">{insuredParticipant?.commune || "—"}</p>
 </div>
 </div>

 {/* Separador liquid glass */}
 <hr className="app-section-divider" />

 {/* Sub-sección: Datos del Siniestro */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 app-body">
 <div>
 <span className="app-data-label">RUT Contacto</span>
 <p className="font-medium">{contactParticipant?.rut || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Nombre Contacto</span>
 <p className="font-medium">{contactParticipant?.first_name || insuredParticipant?.first_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Apellido Contacto</span>
 <p className="font-medium">{contactParticipant?.last_name || insuredParticipant?.last_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Email Contacto</span>
 <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground shrink-0" />{contactParticipant?.email || insuredParticipant?.email || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Teléfono Contacto</span>
 <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground shrink-0" />{contactParticipant?.cell_phone || contactParticipant?.phone || insuredParticipant?.cell_phone || insuredParticipant?.phone || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Dirección Siniestro</span>
 <p className="font-medium">{claim?.claim_address || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">País Siniestro</span>
 <p className="font-medium">{claim?.country?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Región Siniestro</span>
 <p className="font-medium">{claim?.region?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Ciudad Siniestro</span>
 <p className="font-medium">{claim?.city?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Comuna Siniestro</span>
 <p className="font-medium">{claim?.commune?.name || "—"}</p>
 </div>
 </div>
 </div>

 {/* Datos de la Coordinación — anexos capturados al agendar (CIN) */}
 <div className="app-panel py-3 px-4">
 <h3 className="app-section-title mb-2">
 Datos de la Coordinación
 </h3>
 <div className="grid grid-cols-2 gap-x-4 gap-y-1 app-body">
 <div className="grid grid-cols-2 gap-x-4 gap-y-1">
 <div>
 <span className="app-data-label">Fecha Coordinación</span>
 <p className="font-medium">{session.scheduled_at ? formatDateTime(session.scheduled_at) : "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Inspector</span>
 <p className="font-medium flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground shrink-0" />{userName(session.inspector_id) || "—"}</p>
 </div>
 </div>
 <div>
 <span className="app-data-label">Aclaración Dirección</span>
 <div className="flex items-start justify-between gap-2">
 <p className="font-medium whitespace-pre-wrap flex-1">{coordAclaracionDireccion || "—"}</p>
 {claim?.claim_latitude != null && claim?.claim_longitude != null && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0 shrink-0"
 title="Ver ubicación del siniestro en el mapa"
 onClick={() => setMapViewOpen(true)}
 >
 <Map className="h-3.5 w-3.5 text-primary" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Magic link */}
 {session.inspection_type === "remote" && session.magic_link_token && (
 <div className="app-panel">
 <h3 className="app-section-title">
 Magic Link
 </h3>
 <MagicLinkSender
 token={session.magic_link_token}
 sessionId={session.id}
 scheduledAt={session.scheduled_at}
 expiresAt={session.magic_link_expires_at}
 magicLinkExtended={session.magic_link_extended}
 sessionStatus={session.status}
 contactName={session.interviewed_name || contactParticipant?.full_name}
 contactEmail={session.interviewed_email || contactParticipant?.email}
 contactPhone={contactParticipant?.cell_phone || contactParticipant?.phone || insuredParticipant?.cell_phone || insuredParticipant?.phone}
 />
 </div>
 )}

 {/* Aviso: capturar geo antes de iniciar (presencial) */}
 {session.inspection_type === "onsite" && session.status === "scheduled" &&
 (!session.geo_status || session.geo_status === "pending" || session.geo_status === "failed") && (
 <div className="app-panel xl:col-span-2 border-amber-500/30 bg-amber-500/5">
 <div className="flex items-center gap-2">
 <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
 <p className="app-body text-amber-700 dark:text-amber-400">
 Para iniciar la inspección presencial, primero debes <strong>capturar tu geolocalización</strong> en el lugar del siniestro (ver panel más abajo).
 </p>
 </div>
 </div>
 )}

 {/* Estado de la Sesion + Resultado */}
 <div className="app-panel py-3 px-4">
 <h3 className="app-section-title mb-2">
 Estado de la Sesion
 </h3>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {/* 1/2: estado + fechas + acciones */}
 <div className="flex items-start gap-4">
 <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1 app-body flex-1 min-w-0">
 <div>
 <span className="app-data-label">Estado</span>
 <p>
 <Badge className={sessionStatusColors[session.status]}>
 {sessionStatusLabels[session.status]}
 </Badge>
 </p>
 </div>
 <div>
 <span className="app-data-label">Programada</span>
 <p className="font-medium">{session.scheduled_at ? formatDateTime(session.scheduled_at) : "Sin programar"}</p>
 </div>
 <div>
 <span className="app-data-label">Iniciada</span>
 <p className="font-medium">{session.started_at ? formatDateTime(session.started_at) : "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Finalizada</span>
 <p className="font-medium">{session.ended_at ? formatDateTime(session.ended_at) : "—"}</p>
 </div>
 <div className="col-span-2 md:col-span-4 xl:col-span-6">
 <span className="app-data-label">Log de inicios y términos</span>
 <div className="mt-1">
 <Popover>
 <PopoverTrigger
 render={<Button variant="outline" size="sm" className="h-7 text-xs" />}
 >
 Ver {workPeriods?.length ?? 0} registro{(workPeriods?.length ?? 0) > 1 ? "s" : ""}
 </PopoverTrigger>
 <PopoverContent className="w-80 p-3" side="bottom" align="start">
 <div className="space-y-1 pb-2 border-b border-border/40 mb-2">
 <div className="flex justify-between gap-2 text-xs app-body text-slate-700 dark:text-slate-300">
 <span className="text-slate-500">Programada</span>
 <span>{session.scheduled_at ? formatDateTime(session.scheduled_at) : "—"}</span>
 </div>
 <div className="flex justify-between gap-2 text-xs app-body text-slate-700 dark:text-slate-300">
 <span className="text-slate-500">Magic link expira</span>
 <span className={session.magic_link_expires_at && new Date(session.magic_link_expires_at) < new Date() ? "text-red-500" : ""}>
 {session.magic_link_expires_at ? formatDateTime(session.magic_link_expires_at) : "—"}
 </span>
 </div>
 </div>
 <div className="space-y-1 max-h-60 overflow-y-auto">
 {workPeriods && workPeriods.length > 0 ? (
 workPeriods.map((p, i) => (
 <div key={p.id} className="flex items-center justify-between gap-2 text-xs app-body">
 <div className="flex items-center gap-2">
 <span className="font-mono text-slate-500">#{i + 1}</span>
 <span className="text-slate-700 dark:text-slate-300">{p.started_at ? formatDateTime(p.started_at) : "—"}</span>
 <span className="text-slate-400">→</span>
 <span className={p.ended_at ? "text-slate-700 dark:text-slate-300" : "text-emerald-600 font-medium"}>
 {p.ended_at ? formatDateTime(p.ended_at) : "En curso"}
 </span>
 </div>
 {p.ended_at && (
 <span className="text-slate-500 font-mono shrink-0">
 {formatDuration(new Date(p.ended_at).getTime() - new Date(p.started_at).getTime())}
 </span>
 )}
 </div>
 ))
 ) : (
 <p className="text-xs text-muted-foreground py-2">Sin registros de trabajo</p>
 )}
 </div>
 </PopoverContent>
 </Popover>
 </div>
 </div>
 </div>

 {/* Botones de acción horizontales (scheduled, active o paused) */}
 {isMovable && (
 <div className="flex flex-row items-start gap-1.5 shrink-0">
 {isPlanned && !isPaused && isAssignedInspector && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0"
 title={
 session.inspection_type === "onsite" && (!session.geo_status || session.geo_status === "pending" || session.geo_status === "failed")
 ? "Primero debes capturar tu geolocalización en el lugar"
 : "Iniciar inspección"
 }
 disabled={
 session.inspection_type === "onsite" &&
 (!session.geo_status || session.geo_status === "pending" || session.geo_status === "failed")
 }
 onClick={() => {
 startMutation.mutate(session.id);
 }}
 >
 <Play className="h-3.5 w-3.5" />
 </Button>
 )}
 {isPaused && isAssignedInspector && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0 text-amber-600 dark:text-amber-400 border-amber-400/40"
 title="Reanudar inspección (viene de pausa)"
 disabled={resumeMutation.isPending}
 onClick={() => resumeMutation.mutate(session.id)}
 >
 <FastForward className="h-3.5 w-3.5" />
 </Button>
 )}
 {isMovable && isRemote && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0"
 title="Mover fecha (solo remotas)"
 onClick={() => {
 setMoveSelectedDatetime(sessionStatus === "active" ? "" : (session.scheduled_at || ""));
 setMoveDateModalOpen(true);
 }}
 >
 <Clock className="h-3.5 w-3.5" />
 </Button>
 )}
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0"
 title="Reagendar (genera CIN de re-coordinación)"
 onClick={() => {
 // Priorizar el inspector de la sesión, luego el del siniestro
 const sessionInspectorId = session?.inspector_id as string | undefined;
 const claimData = session?.claim as Record<string, unknown> | undefined;
 const claimInspectorId = claimData?.inspector_id as string | undefined;
 const initialInspector = sessionInspectorId || claimInspectorId || "";
 setRescheduleInspectorId(initialInspector);
 // Cargar tipo de inspección de la sesión actual
 setRescheduleType((session?.inspection_type as "onsite" | "remote") || "onsite");
 setRescheduleModalOpen(true);
 }}
 >
 <CalendarClock className="h-3.5 w-3.5" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="h-7 w-7 p-0"
 title="Cancelar (genera CIN desistida, INS rechazada)"
 onClick={() => setCancelModalOpen(true)}
 >
 <XCircle className="h-3.5 w-3.5" />
 </Button>
 </div>
 )}
 </div>

 {/* 1/2: resultado de la inspección (solo si hay un resultado) */}
 {(session.status === "cancelled" || session.status === "completed") && (
 <div className={`rounded-lg p-3 border ${session.status === "cancelled" ? "border-rose-500/20 bg-rose-500/5" : "border-violet-500/20 bg-violet-500/5"}`}>
 <div className="flex items-start gap-2">
 {session.status === "cancelled" ? (
 <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
 ) : (
 <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
 )}
 <div className="flex-1 min-w-0">
 <p className={`app-body font-semibold ${session.status === "cancelled" ? "text-rose-700 dark:text-rose-300" : "text-violet-700 dark:text-violet-300"}`}>
 {session.status === "cancelled" ? "Inspección Cancelada" : "Inspección Completada"}
 </p>
 {session.status === "cancelled" ? (
 <div className="mt-1">
 <p className="app-body text-muted-foreground">
 {allCancellationReasons?.find(r => r.id === session.cancellation_reason_id)?.name || "Motivo no registrado"}
 {session.cancellation_notes && (
 <>. &ldquo;{session.cancellation_notes}&rdquo;</>
 )}
 {session.cancelled_at && (
 <> - Cancelada el {new Date(session.cancelled_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</>
 )}
 </p>
 </div>
 ) : (
 session.ended_at && (
 <p className="app-body text-muted-foreground mt-1">
 Finalizada el {new Date(session.ended_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
 </p>
 )
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Geolocalización del lugar (presencial: inspector captura) */}
 {session.inspection_type === "onsite" && (
 <GeoCapture
 title="Geolocalización del Lugar del Siniestro"
 inspectionType="onsite"
 sessionId={session.id}
 capturedBy={profile?.id}
 claimCoords={claim?.claim_latitude != null && claim?.claim_longitude != null ? { lat: claim.claim_latitude, lng: claim.claim_longitude } : null}
 claimAddress={claim?.claim_address || undefined}
 initialCoords={session.geo_latitude && session.geo_longitude ? { lat: session.geo_latitude, lng: session.geo_longitude } : null}
 initialDistance={session.geo_distance_meters}
 initialStatus={(session.geo_status as "pending" | "verified" | "out_of_range" | "failed") || "pending"}
 disabled={session.status === "completed" || session.status === "cancelled"}
 onCapture={(result) => {
 updateMutation.mutate({
 id: session.id,
 input: {
 geo_latitude: result.coords.lat,
 geo_longitude: result.coords.lng,
 geo_captured_at: new Date().toISOString(),
 geo_captured_by: profile?.id,
 geo_distance_meters: result.distance,
 geo_status: result.status,
 geo_map_url: result.mapUrl,
 },
 });
 }}
 />
 )}
 </div>
 )}

{/* ── TAB: ACTA DE INSPECCION ── */}
 {activeTab === "acta" && (
 <div className="mt-4">
 {session.status === "scheduled" ? (
 <div className="app-panel">
 <h3 className="app-section-title">
 Acta de Inspeccion
 </h3>
 <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
 <p className="app-body text-amber-950 dark:text-amber-100">
 Inicia la inspeccion para acceder al formulario del Acta.
 </p>
 </div>
 </div>
 ) : (
 <ActaForm session={session} readOnly={session.status !== "active"} />
 )}
 </div>
 )}

 {/* ── TAB: DANOS ── */}
 {activeTab === "danos" && (
 <div className="mt-4">
 {session.status === "scheduled" ? (
 <NotStartedNotice />
 ) : (
 <DamagesTab sessionId={session.id} propertyClassification={session.property_risk?.risk_class} countryId={session.claim?.country_id} sessionStatus={session.status} />
 )}
 </div>
 )}

 {/* ── TAB: EVIDENCIAS ── */}
 {activeTab === "evidencias" && (
 <div className="mt-4">
 {session.status === "scheduled" ? (
 <NotStartedNotice />
 ) : (
 <EvidencesTab sessionId={session.id} sessionStatus={session.status} />
 )}
 </div>
 )}

 {/* ── TAB: CROQUIS ── */}
 {activeTab === "croquis" && (
 <div className="mt-4">
 {session.status === "scheduled" ? (
 <NotStartedNotice />
 ) : (
 <SketchesTab sessionId={session.id} sessionStatus={session.status} magicLinkToken={session.magic_link_token || undefined} />
 )}
 </div>
 )}

 {/* ── TAB: FIRMAS ── */}
 {activeTab === "firmas" && (
 <div className="mt-4">
 {session.status === "scheduled" ? (
 <NotStartedNotice />
 ) : (
 <SignaturesTab sessionId={session.id} sessionStatus={session.status} magicLinkToken={session.magic_link_token || undefined} inspectionType={session.inspection_type} signatureWaiverReason={session.signature_waiver_reason} />
 )}
 </div>
 )}

 {/* ── TAB: INFORME ── */}
 {activeTab === "informe" && (
 <div className="mt-4">
 {isFullLoading ? (
 <div className="flex items-center justify-center py-12 app-body text-muted-foreground">
 Cargando informe...
 </div>
 ) : fullSession ? (
 <ReportTab
 session={fullSession}
 profile={profile}
 claimNumber={claim?.claim_number ?? undefined}
 claimLiquidationNumber={claim?.liquidation_number ?? undefined}
 claimAddress={claim?.claim_address ?? undefined}
 insuredName={claim?.claims_participants?.find(p => p.type === "insured")?.full_name ?? undefined}
 insuredRut={claim?.claims_participants?.find(p => p.type === "insured")?.rut ?? undefined}
 insuredPhone={claim?.claims_participants?.find(p => p.type === "insured")?.cell_phone ?? undefined}
 insuredEmail={claim?.claims_participants?.find(p => p.type === "insured")?.email ?? undefined}
 claimCause={claim?.claim_cause?.name ?? undefined}
 claimDate={claim?.claim_date ?? undefined}
 commune={claim?.commune?.name ?? undefined}
 cancellationReason={allCancellationReasons?.find(r => r.id === fullSession.cancellation_reason_id)?.name || null}
 cancellationNotes={fullSession.cancellation_notes}
 cancelledAt={fullSession.cancelled_at}
 />
 ) : null}
 </div>
 )}

 {/* ── TAB: CONEXIONES ── */}
 {activeTab === "conexiones" && (
 <div className="mt-4">
 <ConnectionLogsTab sessionId={session.id} />
 </div>
 )}

 {/* ── TAB: EVENTOS ── */}
 {activeTab === "eventos" && (
 <div className="mt-4">
 <EventLogsTab sessionId={session.id} />
 </div>
 )}

 </div>

 {/* Panel overlay de Comunicación — flotante, no roba espacio */}
 {session.inspection_type === "remote" && (
 <div className={cn("chat-overlay", !chatPanelOpen && "chat-overlay-minimized")}>
 <div className="chat-overlay-panel">
 {chatPanelOpen && (
 <div className="flex items-center justify-between mb-3 pb-2 border-b">
 <h3 className="app-body font-semibold text-muted-foreground flex items-center gap-2">
 <MessageSquare className="h-4 w-4" />
 Comunicación
 </h3>
 <div className="flex items-center gap-1">
 {videoCallOpen && session.status === "active" && (
 <Button
 variant="ghost"
 size="sm"
 className="h-7 text-xs text-rose-500 hover:text-rose-600"
 onClick={async () => {
 const ok = await confirmAction({
 title: "Finalizar videollamada",
 description: "¿Finalizar la videollamada? Esto también desconectará al asegurado.",
 destructive: true,
 confirmLabel: "Desconectar",
 });
 if (!ok) return;
 setVideoCallOpen(false);
 const logId = inspectorLogIdRef.current;
 if (logId) {
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "disconnected",
 logId,
 disconnectReason: "hangup",
 });
 inspectorLogIdRef.current = null;
 }
 }}
 >
 Desconectar
 </Button>
 )}

 </div>
 </div>
 )}

 {chatPanelOpen && !videoCallOpen && session.status === "active" && profile?.id && (
 <div className="shrink-0 mb-3 p-3 rounded-lg border border-border bg-muted/30 text-center">
 <p className="app-body text-muted-foreground mb-2">Videollamada desconectada</p>
 <Button
 onClick={() => {
 setVideoCallOpen(true);
 // Crear log de conexión del inspector
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "connecting",
 }).then((logId) => {
 if (logId) inspectorLogIdRef.current = logId;
 });
 }}
 className="gap-2"
 >
 <Video className="h-4 w-4" />
 Conectar videollamada
 </Button>
 </div>
 )}

 {videoCallOpen && session.status === "active" && profile?.id && (
 <div className={cn("rounded-lg overflow-hidden border border-border", chatPanelOpen ? "h-48 shrink-0 mb-3" : "flex-1 min-h-0")}>
 <LiveVideoCall
 sessionId={session.id}
 userId={profile.id}
 role="inspector"
 compact
 minimized={!chatPanelOpen}
 onHangup={() => {
 setVideoCallOpen(false);
 // Marcar log como desconectado
 const logId = inspectorLogIdRef.current;
 if (logId) {
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "disconnected",
 logId,
 disconnectReason: "hangup",
 });
 inspectorLogIdRef.current = null;
 }
 }}
 onKicked={(reason) => {
 setVideoCallOpen(false);
 const logId = inspectorLogIdRef.current;
 if (logId) {
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "kicked",
 logId,
 disconnectReason: reason,
 });
 inspectorLogIdRef.current = null;
 }
 }}
 onMediaPermission={(result) => {
 // Crear log de conexión del inspector con permisos
 if (!inspectorLogIdRef.current) {
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "success",
 cameraPermission: result.camera,
 microphonePermission: result.microphone,
 }).then((id) => {
 if (id) inspectorLogIdRef.current = id;
 });
 } else {
 // Actualizar permisos si ya existe el log
 logConnectionEvent({
 sessionId: session.id,
 role: "adjuster",
 status: "success",
 logId: inspectorLogIdRef.current,
 cameraPermission: result.camera,
 microphonePermission: result.microphone,
 });
 }
 }}
 onScreenshotSaved={() => {
 queryClient.invalidateQueries({ queryKey: ["evidences", session.id] });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
 }}
 onPeerJoined={() => showAlert({ title: "Asegurado conectado", description: "El asegurado se ha conectado a la videollamada.", type: "info" })}
 onPeerRejected={() => showAlert({ title: "Conexión rechazada", description: "Otra persona intentó conectarse a la videollamada y fue rechazada. Ya hay un asegurado en sesión.", type: "info" })}
 onRecordingSaved={() => {
 queryClient.invalidateQueries({ queryKey: ["evidences", session.id] });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
 if (session.magic_link_token) queryClient.invalidateQueries({ queryKey: ["magic-link-live", session.magic_link_token] });
 showAlert({ title: "Grabación guardada", description: "La grabación de sesión se guardó como evidencia.", type: "info" });
 }}
 />
 </div>
 )}

 {chatPanelOpen && (
 <div className="flex-1 overflow-hidden min-h-0">
 <ChatTab sessionId={session.id} compact />
 </div>
 )}
 </div>

 {chatPanelOpen && (
 <button
 type="button"
 onClick={() => setChatPanelOpen(false)}
 className="absolute right-0 top-0 h-full w-4 z-10 flex items-center justify-center bg-primary/80 text-primary-foreground hover:bg-primary transition-colors rounded-r-2xl"
 title="Colapsar chat"
 >
 <ChevronRight className="h-5 w-5" />
 </button>
 )}
 </div>
 )}

 {/* Botón flotante para reabrir videollamada — solo inspecciones remotas activas */}
 {!videoCallOpen && session.inspection_type === "remote" && session.status === "active" && (
 <button
 onClick={() => {
 setChatPanelOpen(true);
 setVideoCallOpen(true);
 }}
 className="fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:scale-105 transition-transform"
 title="Reanudar videollamada"
 >
 <Video className="h-5 w-5" />
 </button>
 )}

 {/* Barra lateral colapsada para reabrir chat — solo para inspecciones remotas */}
 {!chatPanelOpen && session.inspection_type === "remote" && (
 <button
 onClick={() => setChatPanelOpen(true)}
 className="fixed top-20 right-0 z-40 flex h-[calc(100vh-180px)] w-4 items-center justify-center rounded-l-lg bg-primary/80 text-primary-foreground shadow-lg hover:bg-primary transition-colors"
 title="Abrir chat"
 >
 <ChevronLeft className="h-5 w-5" />
 </button>
 )}

 </div>

 {/* Modal: mapa del siniestro (solo lectura) — liquid glass */}
 {mapViewOpen && claim?.claim_latitude != null && claim?.claim_longitude != null && (
 <Dialog open={mapViewOpen} onOpenChange={setMapViewOpen}>
 <DialogContent className="modal-xl ring-1 ring-violet-500/20 shadow-2xl shadow-violet-500/10" showCloseButton>
 <div className="modal-header px-5 pt-4 pb-3 border-b border-border/40">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
 <MapPin className="h-4 w-4 text-violet-600 dark:text-violet-400" />
 </div>
 <div className="flex-1 min-w-0">
 <DialogTitle className="app-section-title mb-0">Ubicación del Siniestro</DialogTitle>
 <DialogDescription className="modal-subtitle truncate">
 {claim?.claim_address || "Ubicación confirmada"}
 </DialogDescription>
 </div>
 <div className="flex flex-col items-end gap-0.5 shrink-0">
 <span className="text-[10px] font-mono text-muted-foreground">Lat {Number(claim.claim_latitude).toFixed(6)}</span>
 <span className="text-[10px] font-mono text-muted-foreground">Lng {Number(claim.claim_longitude).toFixed(6)}</span>
 </div>
 </div>
 </div>
 <div className="h-125 relative">
 <MapContainer
 center={[claim.claim_latitude, claim.claim_longitude]}
 zoom={16}
 className="h-full w-full"
 scrollWheelZoom={false}
 >
 <TileLayer
 url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
 />
 <Marker position={[claim.claim_latitude, claim.claim_longitude]} />
 </MapContainer>
 </div>
 </DialogContent>
 </Dialog>
 )}

 {/* Popup flotante: Ubicación capturada por el asegurado (esquina inferior derecha) */}
{geoCapturedModalOpen && geoCapturedData && (
 <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-emerald-500/30 bg-white dark:bg-zinc-900 shadow-2xl shadow-emerald-500/10 overflow-hidden">
   {/* Header */}
   <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-emerald-500/5">
     <div className="flex items-center gap-2 min-w-0">
       <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 shrink-0">
         <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
       </div>
       <div className="min-w-0">
         <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">Ubicación capturada</p>
         <p className="text-[10px] text-muted-foreground truncate">
           {geoCapturedData.distance != null ? `${geoCapturedData.distance} m del siniestro` : "Sin distancia"}
         </p>
       </div>
     </div>
     <button
       type="button"
       onClick={() => setGeoCapturedModalOpen(false)}
       className="p-1 rounded-md hover:bg-muted/40 text-muted-foreground shrink-0"
       title="Cerrar"
     >
       <XCircle className="h-4 w-4" />
     </button>
   </div>
   {/* Mapa */}
   <div ref={geoMapRef} className="h-48 relative">
     <MapContainer
       center={[geoCapturedData.lat, geoCapturedData.lng]}
       zoom={16}
       className="h-full w-full"
       scrollWheelZoom={false}
     >
       <TileLayer
         url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
       />
       <Marker position={[geoCapturedData.lat, geoCapturedData.lng]} />
     </MapContainer>
   </div>
   {/* Footer con botones */}
   <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40">
     <Button
       variant="outline"
       size="sm"
       className="h-7 text-[11px] flex-1"
       disabled={geoRecapturing}
       onClick={handleRequestRecapture}
     >
       {geoRecapturing ? (
         <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Habilitando...</>
       ) : (
         "Solicitar recaptura"
       )}
     </Button>
     <Button
       size="sm"
       className="h-7 text-[11px] flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
       disabled={geoSavingEvidence}
       onClick={saveGeoMapEvidence}
     >
       {geoSavingEvidence ? (
         <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Guardando...</>
       ) : (
         <><Camera className="h-3 w-3 mr-1" /> Guardar evidencia</>
       )}
     </Button>
   </div>
 </div>
)}

{/* Modal de Cancelación */}
 <Dialog open={cancelModalOpen} onOpenChange={(open) => { if (!open && cancelMutation.isPending) return; setCancelModalOpen(open); }}>
 <DialogContent className="modal-sm" showCloseButton={!cancelMutation.isPending}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2">
 <XCircle className="h-4 w-4 text-rose-500" />
 Cancelar Inspección
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Registra el motivo de cancelación. Se generará un informe de cancelación.
 </DialogDescription>
 </div>
 <div className="modal-body modal-grid">
 <div className="modal-field">
 <Label className="app-field-label">Motivo de cancelación *</Label>
 <Select disabled={cancelMutation.isPending} value={cancelReasonId || null} onValueChange={(v) => setCancelReasonId(v ?? "")}>
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
 <SelectContent>
 {desistidaReasons?.map((r) => (
 <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Notas adicionales</Label>
 <textarea
 disabled={cancelMutation.isPending}
 value={cancelNotes}
 onChange={(e) => setCancelNotes(e.target.value)}
 rows={3}
 className="app-input resize-none"
 placeholder="Detalle del motivo de cancelación..."
 />
 </div>
 </div>
 <div className="modal-footer">
 <Button variant="outline" size="sm" disabled={cancelMutation.isPending} onClick={() => setCancelModalOpen(false)} className="pg-btn-platinum">
 Cerrar
 </Button>
 <Button
 size="sm"
 disabled={!cancelReasonId || cancelMutation.isPending}
 onClick={() => cancelMutation.mutate({
 id: session.id,
 claimId: session.claim_id,
 insActionId: session.claim_action_id,
 reasonId: cancelReasonId,
 notes: cancelNotes || undefined,
 })}
 className="pg-btn-platinum"
 >
 {cancelMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelando...</> : "Cancelar"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Modal de Reagendamiento */}
 <Dialog open={rescheduleModalOpen} onOpenChange={(open) => { if (!open && rescheduleMutation.isPending) return; setRescheduleModalOpen(open); }}>
 <DialogContent className="modal-lg" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2">
 <RotateCcw className="h-4 w-4 text-sky-500" />
 Reagendar Inspección
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 La inspección actual se cancelará y se creará una nueva agendada.
 </DialogDescription>
 </div>
 <div className="modal-body modal-grid">
 <div className="modal-grid-2">
 <div className="modal-field">
 <Label className="app-field-label">Inspector *</Label>
 <Select disabled={rescheduleMutation.isPending} value={rescheduleInspectorId || null} onValueChange={(v) => setRescheduleInspectorId(v ?? "")}>
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Seleccionar...">
 {allInspectors.find((i) => i.id === rescheduleInspectorId)?.full_name || allInspectors.find((i) => i.id === rescheduleInspectorId)?.email || "Seleccionar..."}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 {allInspectors.map((i) => (
 <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Tipo *</Label>
 <Select disabled={rescheduleMutation.isPending} value={rescheduleType} onValueChange={(v) => setRescheduleType(v as "onsite" | "remote")}>
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="onsite">Presencial (3h)</SelectItem>
 <SelectItem value="remote">Remota (1h)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Disponibilidad del inspector — mismo formato que coordinación */}
 <div className="modal-field">
 <Label className="app-field-label flex items-center gap-1.5">
 <CalendarClock className="h-3.5 w-3.5" />
 Fecha y hora *
 </Label>
 <CoordScheduler
 inspectorId={rescheduleInspectorId}
 inspectionType={rescheduleType}
 value={rescheduleSelectedDatetime || undefined}
 onChange={(iso) => setRescheduleSelectedDatetime(iso)}
 readOnly={rescheduleMutation.isPending}
 daysToIssue={inspectionMaxDate?.maxDays ?? 2}
 maxDate={rescheduleMaxDate}
 excludeSessionId={session?.id}
 />
 </div>

 <div className="modal-field">
 <Label className="app-field-label">Motivo de reagendamiento *</Label>
 <Select disabled={rescheduleMutation.isPending} value={cancelReasonId || null} onValueChange={(v) => setCancelReasonId(v ?? "")}>
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
 <SelectContent>
 {fallidaReasons?.map((r) => (
 <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Notas</Label>
 <textarea
 disabled={rescheduleMutation.isPending}
 value={cancelNotes}
 onChange={(e) => setCancelNotes(e.target.value)}
 rows={2}
 className="app-input resize-none"
 placeholder="Notas del reagendamiento..."
 />
 </div>
 </div>
 <div className="modal-footer">
 <Button variant="outline" size="sm" disabled={rescheduleMutation.isPending} onClick={() => setRescheduleModalOpen(false)} className="pg-btn-platinum">
 Cerrar
 </Button>
 <Button
 size="sm"
 disabled={!cancelReasonId || !rescheduleSelectedDatetime || !rescheduleInspectorId || rescheduleMutation.isPending}
 onClick={() => {
 rescheduleMutation.mutate({
 currentId: session.id,
 claimId: session.claim_id,
 insActionId: session.claim_action_id,
 reasonId: cancelReasonId,
 notes: cancelNotes || undefined,
 newOptions: { inspectionType: rescheduleType, scheduledAt: rescheduleSelectedDatetime, inspectorId: rescheduleInspectorId || undefined },
 });
 }}
 className="pg-btn-platinum"
 >
 {rescheduleMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reagendando...</> : "Reagendar"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Modal de Mover Fecha */}
 <Dialog open={moveDateModalOpen} onOpenChange={(open) => { if (!open && moveDateMutation.isPending) return; setMoveDateModalOpen(open); }}>
 <DialogContent className="modal-b-lg" showCloseButton>
 <div className="modal-b-header">
 <DialogTitle className="modal-b-title">
 <Clock className="h-5 w-5" />
 Mover Fecha
 </DialogTitle>
 <DialogDescription className="modal-b-subtitle">
 Cambiar la fecha/hora de la inspección sin crear una nueva coordinación. El inspector no cambia.
 </DialogDescription>
 </div>
 <div className="modal-b-body space-y-4">
 <div>
 <label className="app-field-label app-body">Inspector</label>
 <p className="app-body font-medium py-1">
 {allInspectors.find((i) => i.id === session.inspector_id)?.full_name
 || allInspectors.find((i) => i.id === session.inspector_id)?.email
 || "Sin inspector asignado"}
 </p>
 </div>
 <div>
 <label className="app-field-label app-body">Nueva fecha y hora *</label>
 <CoordScheduler
 inspectorId={session.inspector_id || ""}
 inspectionType={(session.inspection_type as "onsite" | "remote") || "onsite"}
 value={moveSelectedDatetime || undefined}
 onChange={(iso) => setMoveSelectedDatetime(iso)}
 readOnly={moveDateMutation.isPending}
 daysToIssue={inspectionMaxDate?.maxDays ?? 2}
 maxDate={rescheduleMaxDate}
 excludeSessionId={session.id}
 />
 </div>
 </div>
 <div className="modal-b-footer">
 <Button
 size="sm"
 className="pg-btn-platinum"
 disabled={moveDateMutation.isPending}
 onClick={() => setMoveDateModalOpen(false)}
 >
 Cancelar
 </Button>
 <Button
 size="sm"
 className="pg-btn-platinum"
 disabled={!moveSelectedDatetime || moveDateMutation.isPending}
 onClick={() => {
 moveDateMutation.mutate({
 sessionId: session.id,
 scheduledAt: moveSelectedDatetime,
 });
 }}
 >
 {moveDateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Moviendo...</> : "Guardar"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
