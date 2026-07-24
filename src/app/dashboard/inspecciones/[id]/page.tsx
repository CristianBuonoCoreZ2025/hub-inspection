"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
 getInspectionSessionById,
 updateInspectionSession,
 rescheduleInspectionViaCIN,
 cancelInspectionViaCIN,
 getInspectorSchedule,
} from "@/services/inspections";
import { updateClaimStatus } from "@/services/claims";
import { getLookupCatalog } from "@/services/catalogs";
import { getUsers } from "@/services/users";
import { usePermissions } from "@/hooks/use-permissions";

const GeoCapture = dynamic(() => import("@/components/inspection/geo-capture").then((m) => ({ default: m.GeoCapture })), { ssr: false });
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
 ArrowLeft,
 ClipboardCheck,
 XCircle,
 FileText,
 MapPin,
 User,
 Clock,
 ShieldCheck,
 MessageSquare,
 Video,
 RotateCcw,
 CalendarClock,
 Play,
 AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MagicLinkSender } from "@/components/ui/magic-link-sender";
// Tabs components no longer used — replaced with flat tab style matching claims page
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
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
import { LiveVideoCall } from "@/components/inspection/live-video-call";

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
 completed: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
 cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDate(dateStr: string | null) {
 if (!dateStr) return "—";
 return new Date(dateStr).toLocaleDateString("es-CL", {
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 });
}

function formatDateTime(dateStr: string | null) {
 if (!dateStr) return "—";
 return new Date(dateStr).toLocaleString("es-CL", {
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
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
 const sessionId = params.id as string;
 const { canView } = usePermissions();
 const { profile } = useAuth();
 const [activeTab, setActiveTab] = useState("resumen");
 const [cancelModalOpen, setCancelModalOpen] = useState(false);
 const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
 const [cancelReasonId, setCancelReasonId] = useState<string>("");
 const [cancelNotes, setCancelNotes] = useState<string>("");
 const [rescheduleDate, setRescheduleDate] = useState<string>("");
 const [rescheduleTime, setRescheduleTime] = useState<string>("");
 const [rescheduleType, setRescheduleType] = useState<"onsite" | "remote">("onsite");
 const [rescheduleInspectorId, setRescheduleInspectorId] = useState<string>("");
 const [chatPanelOpen, setChatPanelOpen] = useState(false);
 const [videoCallOpen, setVideoCallOpen] = useState(false);
 const autoVideoOpenedRef = useRef(false);
 const { codeToId } = useClaimStatuses();

 const { data: session, isLoading, isError, error } = useQuery({
 queryKey: ["inspection-session", sessionId],
 queryFn: () => getInspectionSessionById(sessionId),
 retry: false,
 refetchInterval: (query) => {
 const s = query.state.data as InspectionSession | undefined;
 return s?.inspection_type === "remote" && s?.status === "active" ? 2000 : false;
 },
 });

 useEffect(() => {
 if (session && session.inspection_type === "remote" && session.status === "active" && !autoVideoOpenedRef.current) {
 autoVideoOpenedRef.current = true;
 setChatPanelOpen(true);
 setVideoCallOpen(true);
 }
 }, [session]);

 const { data: users } = useQuery({
 queryKey: ["users"],
 queryFn: () => getUsers(),
 });
 // Inspectores: rol principal o rol secundario inspector
 const inspectors = users?.filter((u) => u.role === "inspector" || u.secondary_roles?.some((r) => r.role === "inspector")) || [];

 // Helper para buscar nombre de usuario sin depender del filtro de inspectores
 const userName = (id?: string | null) => {
   if (!id) return null;
   const u = users?.find((u) => u.id === id);
   return u?.full_name || u?.email || null;
 };

 // Query: agenda del inspector para la fecha seleccionada (reagendamiento)
 const rescheduleDateForQuery = rescheduleDate ? new Date(`${rescheduleDate}T00:00:00`) : null;
 const { data: rescheduleSchedule, isLoading: rescheduleScheduleLoading } = useQuery({
 queryKey: ["inspector-schedule", rescheduleInspectorId, rescheduleDate],
 queryFn: () => {
 if (!rescheduleDateForQuery) return [];
 const start = new Date(rescheduleDateForQuery);
 const end = new Date(rescheduleDateForQuery);
 end.setDate(end.getDate() + 1);
 return getInspectorSchedule(rescheduleInspectorId, start.toISOString(), end.toISOString());
 },
 enabled: !!rescheduleInspectorId && !!rescheduleDate && rescheduleModalOpen,
 });

 // Generar slots para reagendamiento
 const RESCHEDULE_SLOT_MIN = rescheduleType === "onsite" ? 120 : 30;
 const generateRescheduleSlots = () => {
 const slots: { time: string; label: string; available: boolean; extra: boolean; bookedInfo?: string }[] = [];
 const DAY_START = 6, DAY_END = 22, NORMAL_START = 9, NORMAL_END = 18;
 const totalMin = (DAY_END - DAY_START) * 60;
 const now = new Date();
 const isToday = rescheduleDate === now.toISOString().split("T")[0];
 for (let offset = 0; offset + RESCHEDULE_SLOT_MIN <= totalMin; offset += RESCHEDULE_SLOT_MIN) {
 const startHour = DAY_START + Math.floor(offset / 60);
 const startMin = offset % 60;
 const endHour = DAY_START + Math.floor((offset + RESCHEDULE_SLOT_MIN) / 60);
 const endMin = (offset + RESCHEDULE_SLOT_MIN) % 60;
 const timeStr = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
 const endStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
 // Si es hoy, saltar slots que ya pasaron
 if (isToday) {
 const slotStartCheck = new Date(`${rescheduleDate}T${timeStr}:00`);
 if (slotStartCheck <= now) continue;
 }
 const isExtra = startHour < NORMAL_START || startHour >= NORMAL_END;
 const slotStart = new Date(`${rescheduleDate}T${timeStr}:00`);
 const slotEnd = new Date(`${rescheduleDate}T${endStr}:00`);
 const booked = rescheduleSchedule?.find((s) => {
 const sStart = new Date(s.scheduled_at);
 const sDuration = s.inspection_type === "onsite" ? 120 : 30;
 const sEnd = new Date(sStart.getTime() + sDuration * 60000);
 return sStart < slotEnd && sEnd > slotStart;
 });
 slots.push({
 time: timeStr,
 label: `${timeStr} - ${endStr}`,
 available: !booked,
 extra: isExtra,
 bookedInfo: booked ? `${booked.claim.claim_number}` : undefined,
 });
 }
 return slots;
 };
 const rescheduleSlots = rescheduleDate && rescheduleInspectorId ? generateRescheduleSlots() : [];

 // Cargar motivos: fallida para reagendar, desistida para cancelar
 // Se cargan siempre para poder mostrar el motivo de sesiones canceladas
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
 toast.success("Estado actualizado");
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
 onError: (err: Error) => toast.error(err.message),
 });

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
 toast.success("Inspección cancelada (desistida). Se generó gestión CIN de desistimiento.");
 queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
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
 if (session?.claim_id) router.push(`/dashboard/claims/${session.claim_id}`);
 },
 onError: (err: Error) => toast.error(err.message),
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
 toast.success("Inspección reagendada. Se generó gestión CIN para re-coordinar.");
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
 setRescheduleModalOpen(false);
 setCancelReasonId("");
 setCancelNotes("");
 setRescheduleDate("");
 setRescheduleTime("");
 setRescheduleInspectorId("");
 // Volver al siniestro — el usuario debe completar la nueva CIN
 if (session?.claim_id) router.push(`/dashboard/claims/${session.claim_id}`);
 },
 onError: (err: Error) => toast.error(err.message),
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

 type ClaimData = {
 claim_number?: string | null;
 client_reference?: string | null;
 claim_address?: string | null;
 claim_latitude?: number | null;
 claim_longitude?: number | null;
 policy_number?: string | null;
 claim_date?: string | null;
 liquidation_number?: string | null;
 broker_executive?: string | null;
 inspector_id?: string | null;
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
 const coordOtrosContactos = findCoord(["coord_cont", "coord_contacto"]);
 const coordComentarios = findCoord(["coord_com"]);

 const allTabs = [
 { id: "resumen", label: "Resumen", icon: FileText, section: "inspecciones_detalle" },
 { id: "acta", label: "Acta", icon: ClipboardCheck, section: "inspecciones_acta" },
 { id: "danos", label: "Daños", icon: ShieldCheck, section: "inspecciones_danos" },
 { id: "evidencias", label: "Evidencias", icon: MapPin, section: "inspecciones_evidencias" },
 { id: "croquis", label: "Croquis", icon: MapPin, section: "inspecciones_croquis" },
 { id: "firmas", label: "Firmas", icon: User, section: "inspecciones_firmas" },
 { id: "informe", label: "Informe", icon: FileText, section: "inspecciones_informe" },
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
 onClick={() => {
 setActiveTab(t.id);
 syncTabMutation.mutate({ id: session.id, tab: t.id });
 }}
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
 <div className="mt-4 app-stack">
 {/* Información General */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Información General
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-2 app-body">
 <div>
 <span className="app-data-label">N° Interno</span>
 <p className="font-mono font-semibold text-primary">
 {claim?.liquidation_number ? (
 <Link href={`/dashboard/claims/${session.claim_id}`} className="hover:underline">
 {claim.liquidation_number as string}
 </Link>
 ) : (
 "—"
 )}
 </p>
 </div>
 <div>
 <span className="app-data-label">Ref. Cliente</span>
 <p className="font-medium">{(claim?.client_reference as string) || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">N° Siniestro Cía</span>
 <p className="font-medium">{claim?.claim_number as string}</p>
 </div>
 <div>
 <span className="app-data-label">N° Poliza</span>
 <p className="font-medium">{claim?.policy_number as string}</p>
 </div>
 <div>
 <span className="app-data-label">Compañia</span>
 <p className="font-medium">{claim?.insurance_company?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Inspector</span>
 <p className="font-medium">{userName(session.inspector_id || claim?.inspector_id) || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Gestión</span>
 <p className="font-medium">{session?.action_template?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Fecha Siniestro</span>
 <p className="font-medium">{formatDate(claim?.claim_date as string | null)}</p>
 </div>
 </div>
 </div>

 {/* Asegurado */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Asegurado
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-2 app-body">
 <div>
 <span className="app-data-label">RUT</span>
 <p className="font-medium">{insuredParticipant?.rut || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Tipo</span>
 <p className="font-medium">
 {insuredParticipant?.person_type === "legal" ? "Persona Jurídica" : insuredParticipant?.person_type === "natural" ? "Persona Natural" : "—"}
 </p>
 </div>
 <div>
 <span className="app-data-label">Nombre</span>
 <p className="font-medium">{insuredParticipant?.first_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Apellido</span>
 <p className="font-medium">{insuredParticipant?.last_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Email</span>
 <p className="font-medium">{insuredParticipant?.email || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Teléfono</span>
 <p className="font-medium">{insuredParticipant?.cell_phone || insuredParticipant?.phone || "—"}</p>
 </div>
 <div className="col-span-2">
 <span className="app-data-label">Dirección</span>
 <p className="font-medium">{insuredParticipant?.address || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">País</span>
 <p className="font-medium">{insuredParticipant?.country || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Región</span>
 <p className="font-medium">{insuredParticipant?.region || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Ciudad</span>
 <p className="font-medium">{insuredParticipant?.city || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Comuna</span>
 <p className="font-medium">{insuredParticipant?.commune || "—"}</p>
 </div>
 </div>
 </div>

 {/* Datos del Siniestro — contacto y dirección del claim (NO se tocan) */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Datos del Siniestro
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2 app-body">
 <div>
 <span className="app-data-label">Nombre contacto</span>
 <p className="font-medium">{contactParticipant?.full_name || insuredParticipant?.full_name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Email</span>
 <p className="font-medium">{contactParticipant?.email || insuredParticipant?.email || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Teléfono</span>
 <p className="font-medium">{contactParticipant?.cell_phone || contactParticipant?.phone || insuredParticipant?.cell_phone || insuredParticipant?.phone || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Dirección del Siniestro</span>
 <p className="font-medium">{claim?.claim_address || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">País</span>
 <p className="font-medium">{claim?.country?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Región</span>
 <p className="font-medium">{claim?.region?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Ciudad</span>
 <p className="font-medium">{claim?.city?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Comuna</span>
 <p className="font-medium">{claim?.commune?.name || "—"}</p>
 </div>
 </div>
 </div>

 {/* Datos de la Coordinación — anexos capturados al agendar (CIN) */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Datos de la Coordinación
 </h3>
 <div className="grid grid-cols-3 gap-x-4 gap-y-2 app-body">
 <div>
 <span className="app-data-label">Tipo de Inspección</span>
 <p className="font-medium">{session.inspection_type === "remote" ? "Remota" : session.inspection_type === "onsite" ? "Presencial" : "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Fecha Agendada</span>
 <p className="font-medium">{session.scheduled_at ? formatDateTime(session.scheduled_at) : "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Inspector</span>
 <p className="font-medium">{userName(session.inspector_id) || "—"}</p>
 </div>
 {coordAclaracionDireccion && (
 <div>
 <span className="app-data-label">Aclaración Dirección</span>
 <p className="font-medium whitespace-pre-wrap">{coordAclaracionDireccion}</p>
 </div>
 )}
 {coordOtrosContactos && (
 <div>
 <span className="app-data-label">Otros Contactos</span>
 <p className="font-medium whitespace-pre-wrap">{coordOtrosContactos}</p>
 </div>
 )}
 {coordComentarios && (
 <div>
 <span className="app-data-label">Comentarios</span>
 <p className="font-medium whitespace-pre-wrap">{coordComentarios}</p>
 </div>
 )}
 {session.inspector_observations && (
 <div className="col-span-3">
 <span className="app-data-label">Observaciones del Inspector</span>
 <p className="font-medium whitespace-pre-wrap mt-0.5">{session.inspector_observations}</p>
 </div>
 )}
 </div>
 </div>

 {/* Aviso: capturar geo antes de iniciar (presencial) */}
 {session.inspection_type === "onsite" && session.status === "scheduled" &&
 (!session.geo_status || session.geo_status === "pending" || session.geo_status === "failed") && (
 <div className="app-panel border-amber-500/30 bg-amber-500/5">
 <div className="flex items-center gap-2">
 <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
 <p className="app-body text-amber-700 dark:text-amber-400">
 Para iniciar la inspección presencial, primero debes <strong>capturar tu geolocalización</strong> en el lugar del siniestro (ver panel más abajo).
 </p>
 </div>
 </div>
 )}

 {/* Estado de la Sesion + Acciones */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Estado de la Sesion
 </h3>
 <div className="flex items-start gap-4">
 <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-2 app-body flex-1 min-w-0">
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
 </div>

 {/* Botones de acción horizontales (solo si está scheduled) */}
 {session.status === "scheduled" && (
 <div className="flex flex-row items-start gap-1.5 shrink-0">
 <Button
 size="sm"
 className="pg-btn-platinum h-7 w-7 p-0"
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
 const now = new Date();
 const dateStr = now.toISOString().split("T")[0];
 const timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
 updateMutation.mutate({
 id: session.id,
 input: {
 status: "active",
 started_at: now.toISOString(),
 inspection_date: dateStr,
 inspection_time: timeStr,
 },
 });
 }}
 >
 <Play className="h-3.5 w-3.5" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="pg-btn-platinum h-7 w-7 p-0"
 title="Reagendar (genera CIN de re-coordinación)"
 onClick={() => {
 const claimData = session?.claim as Record<string, unknown> | undefined;
 if (claimData?.inspector_id) {
 setRescheduleInspectorId(claimData.inspector_id as string);
 }
 setRescheduleModalOpen(true);
 }}
 >
 <CalendarClock className="h-3.5 w-3.5" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="pg-btn-platinum h-7 w-7 p-0"
 title="Cancelar (genera CIN desistida, INS rechazada)"
 onClick={() => setCancelModalOpen(true)}
 >
 <XCircle className="h-3.5 w-3.5" />
 </Button>
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

 {/* Magic link */}
 {session.inspection_type === "remote" && session.magic_link_token && (
 <div className="app-panel">
 <h3 className="app-section-title">
 Magic Link
 </h3>
 <MagicLinkSender
 token={session.magic_link_token}
 sessionId={session.id}
 expiresAt={session.magic_link_expires_at}
 contactName={session.interviewed_name || contactParticipant?.full_name}
 contactEmail={session.interviewed_email || contactParticipant?.email}
 contactPhone={contactParticipant?.cell_phone || contactParticipant?.phone || insuredParticipant?.cell_phone || insuredParticipant?.phone}
 />
 </div>
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
 <SignaturesTab sessionId={session.id} sessionStatus={session.status} magicLinkToken={session.magic_link_token || undefined} />
 )}
 </div>
 )}

 {/* ── TAB: INFORME ── */}
 {activeTab === "informe" && (
 <div className="mt-4">
 <ReportTab
 session={session}
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
 cancellationReason={allCancellationReasons?.find(r => r.id === session.cancellation_reason_id)?.name || null}
 cancellationNotes={session.cancellation_notes}
 cancelledAt={session.cancelled_at}
 />
 </div>
 )}

 </div>

 {/* Panel lateral de Comunicación — solo para inspecciones remotas */}
 {chatPanelOpen && session.inspection_type === "remote" && (
 <div className="w-[340px] shrink-0 hidden lg:flex flex-col">
 <div className="app-panel flex flex-col flex-1" style={{ position: "sticky", top: "80px", maxHeight: "calc(100vh - 100px)" }}>
 <div className="flex items-center justify-between mb-3 pb-2 border-b">
 <h3 className="app-body font-semibold text-muted-foreground flex items-center gap-2">
 <MessageSquare className="h-4 w-4" />
 Comunicación
 </h3>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 onClick={() => setChatPanelOpen(false)}
 >
 <XCircle className="h-3.5 w-3.5" />
 </Button>
 </div>

 {videoCallOpen && session.status === "active" && profile?.id && (
 <div className="h-48 shrink-0 mb-3 rounded-lg overflow-hidden border border-border">
 <LiveVideoCall
 sessionId={session.id}
 userId={profile.id}
 role="inspector"
 compact
 onHangup={() => setVideoCallOpen(false)}
 onScreenshotSaved={() => {
 queryClient.invalidateQueries({ queryKey: ["inspection-evidences", session.id] });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
 }}
 onPeerJoined={() => toast.success("El asegurado se ha conectado a la videollamada")}
 onRecordingSaved={() => {
 queryClient.invalidateQueries({ queryKey: ["inspection-evidences", session.id] });
 queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
 if (session.magic_link_token) queryClient.invalidateQueries({ queryKey: ["magic-link-live", session.magic_link_token] });
 toast.success("Grabación de sesión guardada como evidencia");
 }}
 />
 </div>
 )}

 <div className="flex-1 overflow-hidden">
 <ChatTab sessionId={session.id} compact />
 </div>
 </div>
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

 {/* Botón flotante para reabrir chat — solo para inspecciones remotas */}
 {!chatPanelOpen && session.inspection_type === "remote" && (
 <button
 onClick={() => setChatPanelOpen(true)}
 className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
 title="Abrir chat"
 >
 <MessageSquare className="h-5 w-5" />
 </button>
 )}
 </div>

 {/* Modal de Cancelación */}
 <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
 <DialogContent className="modal-content max-w-[480px]">
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2">
 <XCircle className="h-4 w-4 text-rose-500" />
 Cancelar Inspección
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Registra el motivo de cancelación. Se generará un informe de cancelación.
 </DialogDescription>
 </div>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Motivo de cancelación *</Label>
 <Select value={cancelReasonId || null} onValueChange={(v) => setCancelReasonId(v ?? "")}>
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
 value={cancelNotes}
 onChange={(e) => setCancelNotes(e.target.value)}
 rows={3}
 className="app-input resize-none"
 placeholder="Detalle del motivo de cancelación..."
 />
 </div>
 </div>
 <div className="modal-footer">
 <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)} className="pg-btn-platinum">
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
 Cancelar
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Modal de Reagendamiento */}
 <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
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
 <div className="modal-body space-y-2">
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Inspector *</Label>
 <Select value={rescheduleInspectorId || null} onValueChange={(v) => setRescheduleInspectorId(v ?? "")}>
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Seleccionar...">
 {inspectors.find((i) => i.id === rescheduleInspectorId)?.full_name || inspectors.find((i) => i.id === rescheduleInspectorId)?.email || "Seleccionar..."}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 {inspectors.map((i) => (
 <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Tipo *</Label>
 <Select value={rescheduleType} onValueChange={(v) => setRescheduleType(v as "onsite" | "remote")}>
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="onsite">Presencial (2h)</SelectItem>
 <SelectItem value="remote">Remota (30min)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Fecha *</Label>
 <DatePicker
 value={rescheduleDate}
 onChange={(value) => { setRescheduleDate(value); setRescheduleTime(""); }}
 className="w-[130px]"
 />
 </div>
 </div>

 {/* Disponibilidad del inspector */}
 {rescheduleInspectorId && rescheduleDate ? (
 <div>
 <div className="flex items-center justify-between mb-2">
 <Label className="app-field-label flex items-center gap-1.5">
 <CalendarClock className="h-3.5 w-3.5" />
 Disponibilidad
 </Label>
 <span className="app-body text-muted-foreground">
 {rescheduleType === "onsite" ? "Bloques de 2h" : "Bloques de 30min"} · Normal 9-18 · Extra 6-9 / 18-22
 </span>
 </div>
 {rescheduleScheduleLoading ? (
 <div className="flex items-center justify-center py-4">
 <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
 <span className="ml-2 app-body text-muted-foreground">Cargando...</span>
 </div>
 ) : rescheduleSlots.length === 0 ? (
 <p className="app-body text-muted-foreground text-center py-4">Sin horarios disponibles.</p>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto p-1">
 {rescheduleSlots.map((slot) => (
 <button
 key={slot.time}
 type="button"
 disabled={!slot.available}
 title={slot.bookedInfo ? `Ocupado: ${slot.bookedInfo}` : slot.extra ? "Extra horario" : "Disponible"}
 onClick={() => setRescheduleTime(slot.time)}
 className={`rounded-lg border px-3 py-2 app-body font-medium transition-all text-center ${
 !slot.available
 ? "border-rose-500/20 bg-rose-500/5 text-rose-400 cursor-not-allowed line-through"
 : rescheduleTime === slot.time
 ? slot.extra
 ? "border-amber-500 bg-amber-500 text-white shadow-sm"
 : "border-primary bg-primary text-primary-foreground shadow-sm"
 : slot.extra
 ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/10 cursor-pointer"
 : "border-border bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
 }`}
 >
 {slot.label}
 {slot.extra && slot.available && (
 <span className="block app-body font-normal text-amber-500/70 truncate mt-0.5">extra</span>
 )}
 </button>
 ))}
 </div>
 )}
 </div>
 ) : (
 <div className="rounded-lg border border-dashed border-border p-4 text-center app-body text-muted-foreground">
 Selecciona inspector y fecha para ver la disponibilidad.
 </div>
 )}

 <div className="modal-field">
 <Label className="app-field-label">Motivo de reagendamiento *</Label>
 <Select value={cancelReasonId || null} onValueChange={(v) => setCancelReasonId(v ?? "")}>
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
 value={cancelNotes}
 onChange={(e) => setCancelNotes(e.target.value)}
 rows={2}
 className="app-input resize-none"
 placeholder="Notas del reagendamiento..."
 />
 </div>
 </div>
 <div className="modal-footer">
 <Button variant="outline" size="sm" onClick={() => setRescheduleModalOpen(false)} className="pg-btn-platinum">
 Cerrar
 </Button>
 <Button
 size="sm"
 disabled={!cancelReasonId || !rescheduleDate || !rescheduleTime || !rescheduleInspectorId || rescheduleMutation.isPending}
 onClick={() => {
 const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
 rescheduleMutation.mutate({
 currentId: session.id,
 claimId: session.claim_id,
 insActionId: session.claim_action_id,
 reasonId: cancelReasonId,
 notes: cancelNotes || undefined,
 newOptions: { inspectionType: rescheduleType, scheduledAt, inspectorId: rescheduleInspectorId || undefined },
 });
 }}
 className="pg-btn-platinum"
 >
 Reagendar
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* Info de cancelación si aplica */}
 {session.status === "cancelled" && session.cancelled_at && (
 <div className="app-panel border-rose-500/20 bg-rose-500/5">
 <div className="flex items-start gap-3">
 <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
 <div className="flex-1">
 <h3 className="app-title text-rose-700 dark:text-rose-300">
 Inspección Cancelada
 </h3>
 <p className="app-body text-muted-foreground mt-1">
 {allCancellationReasons?.find(r => r.id === session.cancellation_reason_id)?.name || "Motivo no registrado"}
 </p>
 {session.cancellation_notes && (
 <p className="app-body text-muted-foreground mt-1 italic">
 &ldquo;{session.cancellation_notes}&rdquo;
 </p>
 )}
 <p className="app-body text-muted-foreground mt-2">
 Cancelada el {new Date(session.cancelled_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
