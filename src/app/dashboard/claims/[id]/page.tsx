"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatUserDateTime as formatDateTime, formatUserDate as formatDate } from "@/lib/timezone";
import { getClaimById, getClaimParticipants, updateClaimStatus } from "@/services/claims";
import { getClaimActions, getActionTemplatesByClaimStatus, createClaimAction, getClaimActionById, updateClaimAction, issueClaimAction, reviewClaimAction, approveClaimAction, rejectClaimAction } from "@/services/claim-actions";
import { getActionHistory } from "@/services/claim-action-history";
import { getGestionScreensForClaimAction } from "@/services/gestion-screens";
import { getUsers } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { CorreoIcon } from "@/components/icons/topbar-icons";
import { getCountries } from "@/services/countries";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBusinessLines, getInsuranceProducts, getBrokers, getAdvisors, getHousingDestinations, getPropertyClassifications, getDamageClassifications, getLookupCatalog, getCurrencies, getEvents, getCountryById, getRegionById, getCityById, getCommuneById } from "@/services/catalogs";
import type { ClaimsParticipant, ActionTemplate } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRecentClaims } from "@/hooks/use-recent-claims";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import {
 ArrowLeft,
 Pencil,
 MapPin,
 User,
 Shield,
 FileText,
 Users,
 Briefcase,
 FolderOpen,
 ClipboardList,
 History,
 Plus,
 Eye,
 CheckCircle,
 AlertTriangle,
 Trash2,
 XCircle,
 Undo2,
 Send,
 Image as ImageIcon,
 ArrowUpDown,
 ArrowUp,
 ArrowDown,
 Inbox,
 MailCheck,
 RotateCw,
} from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import AuditLogSection from "./audit-log-section";
import ClaimDocumentsTab from "./claim-documents-tab";
import ClaimImagesTab from "./claim-images-tab";
import EditClaimForm from "./edit-claim-form";
import GestionScreenSwitcher from "./gestion-screens";
import WorkflowView from "./workflow-view";
import { EmailComposeModal } from "@/components/claims/email-compose-modal";
import { EmailPreviewModal } from "@/components/claims/email-preview-modal";
import { getEmailLogsByClaim, type EmailLog } from "@/services/email-logs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";

// Fix iconos de Leaflet en Next.js (CDN)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const statusConfig: Record<string, { label: string; className: string }> = {
 created: { label: "Creación", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
 adjustment: { label: "Liquidación", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
 dispatchment: { label: "Despacho", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
 closed: { label: "Cierre", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
 reopened: { label: "Reapertura", className: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
};



function uniquePhones(...values: (string | null | undefined)[]): string {
 const seen = new Set<string>();
 const result: string[] = [];
 for (const v of values) {
 if (!v) continue;
 for (const raw of v.split(",")) {
 const trimmed = raw.trim();
 if (!trimmed) continue;
 const normalized = trimmed.replace(/[\s+\-()]/g, "").toLowerCase();
 if (!seen.has(normalized)) {
 seen.add(normalized);
 result.push(trimmed);
 }
 }
 }
 return result.join(", ");
}

function getParticipant(claim: { claims_participants?: { type: string; full_name: string | null; first_name: string | null; last_name: string | null; rut: string | null; email: string | null; phone: string | null; cell_phone: string | null; address: string | null; country: string | null; region: string | null; city: string | null; commune: string | null; linked_to_insured: boolean }[] }, type: string) {
 return claim.claims_participants?.find((p) => p.type === type);
}

// Detectar tipo de persona: sin apellido = legal, con apellido = natural
function personTypeOf(p: { last_name: string | null } | undefined): "natural" | "legal" | null {
 if (!p) return null;
 return (!p.last_name || p.last_name === "") ? "legal" : "natural";
}

// Nombre para mostrar según tipo
function displayFirstName(p: { first_name: string | null; full_name: string | null; last_name: string | null }): string {
 const isLegal = (!p.last_name || p.last_name === "");
 if (isLegal) return p.first_name || p.full_name || "—";
 return p.first_name || "—";
}

function resolveName(id: string | null | undefined, catalog?: { id: string; name: string }[]) {
 if (!id) return "—";
 return catalog?.find((c) => c.id === id)?.name || id;
}

const allTabs = [
 { id: "siniestro", label: "Siniestro", icon: FileText, section: "claims_detalle" },
 { id: "participantes", label: "Participantes", icon: Users, section: "claims_participantes" },
 { id: "incidente", label: "Incidente", icon: MapPin, section: "claims_incidente" },
 { id: "gestiones", label: "Gestiones", icon: ClipboardList, section: "claims_gestiones" },
 { id: "documentos", label: "Documentos", icon: FolderOpen, section: "claims_documentos" },
 { id: "imagenes", label: "Imágenes", icon: ImageIcon, section: "claims_imagenes" },
 { id: "log", label: "Log", icon: History, section: "claims_log" },
];

// Acorta el código de la gestión quitando el prefijo de liquidación.
// "L-000000141-HCOB-005" → "HCOB-005"
function shortActionCode(code: string | null | undefined): string {
 if (!code) return "—";
 // Quitar todo hasta el segundo guion (la parte de la liquidación)
 const parts = code.split("-");
 if (parts.length >= 3) {
 return parts.slice(2).join("-");
 }
 return code;
}

export default function ClaimDetailPage() {
 const router = useRouter();
 const params = useParams();
 const id = params.id as string;
 const queryClient = useQueryClient();
 const { canEdit, canView } = usePermissions();

 // Mutación para reenviar un correo fallido desde la lista de emails
 const resendEmailMutation = useMutation({
   mutationFn: async (emailLogId: string) => {
     const res = await fetch("/api/email/resend", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ emailLogId }),
     });
     const json = await res.json();
     if (!res.ok) throw new Error(json.error || "Error reenviando e-mail");
     return json;
   },
   onSuccess: () => {
     toast.success("Correo reenviado");
     queryClient.invalidateQueries({ queryKey: ["email-logs-by-claim", id] });
   },
   onError: (err: Error) => toast.error(err.message),
 });
 useRealtime("claims", [["claim", id], ["claims"]]);
 useRealtime("claim_actions", [["claim-actions", id], ["claim-action"]]);
 useRealtime("claims_participants", [["claim-participants", id]]);
 const [activeTab, setActiveTab] = useState("siniestro");
 const [isEditing, setIsEditing] = useState(false);
 const [openGestionModal, setOpenGestionModal] = useState(false);
 const [showRejected, setShowRejected] = useState(false);
 const [gestionSubTab, setGestionSubTab] = useState<"lista" | "workflow">("lista");
 const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
 const [openEditGestionModal, setOpenEditGestionModal] = useState(false);
 // Email compose/preview
 const [emailComposeAction, setEmailComposeAction] = useState<{
   id: string;
   company_id: string;
   claim_id: string;
   action_template_id: string;
   action_data?: Record<string, unknown> | null;
   gestion_codigo?: string;
   gestion_nombre?: string;
 } | null>(null);
 const [emailPreviewLog, setEmailPreviewLog] = useState<EmailLog | null>(null);
 const [editingGestion, setEditingGestion] = useState<{
 id: string;
 tipo: string;
 codigo: string;
 nombre: string;
 estado: string;
 fecha: string | undefined;
 expectedDate: string | null;
 createdOn: string | undefined;
 daysToIssue: number;
 hasIssue: boolean;
 hasReview: boolean;
 hasApprove: boolean;
 issuedOn: string | null;
 issuedBy: string | null;
 issuedByEmail: string | null;
 reviewedOn: string | null;
 reviewedBy: string | null;
 reviewedByEmail: string | null;
 approvedOn: string | null;
 approvedBy: string | null;
 approvedByEmail: string | null;
 href: string | null;
 esAccion: boolean;
 esAutomatica: boolean;
 screenType: string | null;
 origin: string;
 } | null>(null);
 const [editingActionData, setEditingActionData] = useState<Record<string, unknown>>({});
 const [expectedDate, setExpectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
 const [gestionDescription, setGestionDescription] = useState<string>("");
 const [gestionSort, setGestionSort] = useState<{ key: "codigo" | "nombre" | "fecha" | "dias" | "estado"; direction: "asc" | "desc" } | null>(null);
 const [mapOpen, setMapOpen] = useState(false);

 // Filtrar tabs por permisos de sub-sección (con fallback al padre)
 const tabs = allTabs.filter(t => canView(t.section));

 const { data: rawClaim, isLoading } = useQuery({
 queryKey: ["claim", id],
 queryFn: () => getClaimById(id),
 });

 const { data: participants } = useQuery({
 queryKey: ["claim-participants", id],
 queryFn: () => getClaimParticipants(id),
 enabled: !!id,
 });

 // Sync workflow: al cargar el claim, crear gestiones faltantes del workflow
 useQuery({
 queryKey: ["sync-workflow", id],
 queryFn: async () => {
 const res = await fetch("/api/workflows/sync-claim", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ claimId: id }),
 });
 if (!res.ok) return null;
 const data = await res.json();
 // Si se crearon gestiones nuevas, invalidar el cache de claim-actions
 if (data.created > 0) {
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 }
 return data;
 },
 enabled: !!id,
 staleTime: 30000, // No re-sync cada vez que se navega entre tabs
 refetchOnWindowFocus: false,
 });

 const { data: claimActions } = useQuery({
 queryKey: ["claim-actions", id, showRejected],
 queryFn: () => getClaimActions(id, showRejected),
 enabled: !!id,
 staleTime: 0,
 });

 // Cargar email logs del siniestro (para badges de contador en la grilla de gestiones)
 const { data: emailLogsByClaim } = useQuery({
 queryKey: ["email-logs-by-claim", id],
 queryFn: () => (id ? getEmailLogsByClaim(id) : Promise.resolve([])),
 enabled: !!id && activeTab === "gestiones" && gestionSubTab === "lista",
 staleTime: 0,
 });

 const claim = rawClaim
 ? { ...rawClaim, claims_participants: participants ?? [] }
 : undefined;

 // Plantillas disponibles según el estado del siniestro (carga solo al abrir modal)
 const { data: availableTemplates, isLoading: templatesLoading } = useQuery({
 queryKey: ["action-templates-by-status", claim?.status_id, claim?.business_line_id, claim?.event_id, claim?.insurance_company_id],
 queryFn: () => getActionTemplatesByClaimStatus({
  claimStatusId: claim!.status_id!,
  businessLineId: claim!.business_line_id || null,
  eventId: claim!.event_id || null,
  insuranceCompanyId: claim!.insurance_company_id || null,
 }),
 enabled: !!claim?.status_id && openGestionModal,
 });

 // ── Filtrar templates según dependencias de cadena ──
 // RES requiere COB cerrada | PCA requiere RES cerrada | RTA requiere NSA existente
 const CLOSED_STATUSES = new Set(["issued", "reviewed", "approved", "dispatched"]);
 const chainFilteredTemplates = (availableTemplates || []).filter((tpl) => {
 const code = tpl.code;
 if (!code) return true;
 const actions = claimActions || [];
 if (code === "RES") {
 return actions.some((a) => a.action_template?.code === "COB" && a.action_status?.code && CLOSED_STATUSES.has(a.action_status.code));
 }
 if (code === "AJU") {
 return actions.some((a) => a.action_template?.code === "RES" && a.action_status?.code && CLOSED_STATUSES.has(a.action_status.code));
 }
 if (code === "RTA") {
 return actions.some((a) => a.action_template?.code === "SOL");
 }
 return true;
 });

 const editingActionId = editingGestion?.id;
 const { data: editingAction, error: editingActionError } = useQuery({
 queryKey: ["claim-action", editingActionId],
 queryFn: () => getClaimActionById(editingActionId!),
 enabled: !!editingActionId && openEditGestionModal,
 });

 const { data: editingScreens, error: editingScreensError } = useQuery({
 queryKey: ["gestion-screens", editingActionId],
 queryFn: async () => editingAction ? getGestionScreensForClaimAction(editingAction) : [],
 enabled: !!editingAction,
 });

 // Debug temporal — diagnosticar por qué se queda en "Cargando gestión..."
 useEffect(() => {
 if (openEditGestionModal && editingActionId) {
 console.log("[EditGestion Modal] estado:", {
 editingActionId,
 editingAction: editingAction ? "cargado" : "null/undefined",
 editingActionError: editingActionError?.message || null,
 editingScreens: editingScreens ? `array[${editingScreens.length}]` : "undefined",
 editingScreensError: editingScreensError?.message || null,
 hasScreenSnapshot: editingAction?.screen_snapshot ? "SÍ" : "NO",
 hasActionFeature: editingAction?.action_feature ? "SÍ" : "NO",
 });
 }
 }, [openEditGestionModal, editingActionId, editingAction, editingScreens, editingActionError, editingScreensError]);

 const createGestionMutation = useMutation({
 mutationFn: (template: ActionTemplate) =>
 createClaimAction({
 claim_id: id,
 action_template_id: template.id,
 action_features_id: template.action_features_id,
 action_type_id: template.action_type_id || undefined,
 name: template.name,
 description: gestionDescription || template.description || undefined,
 is_blocker: template.is_blocker,
 line_business_id: template.line_business_id || undefined,
 expected_date: expectedDate || undefined,
 }),
 onSuccess: (createdAction) => {
 toast.success("Gestión creada");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 setOpenGestionModal(false);
 // Abrir directamente la pantalla de la gestión recién creada
 setEditingActionData({});
 setEditingGestion({
 id: createdAction.id,
 tipo: createdAction.action_feature?.name || createdAction.name || "Acción",
 codigo: createdAction.code || createdAction.name?.slice(0, 10) || "—",
 nombre: createdAction.name || "—",
 estado: createdAction.action_status?.code || "todo",
 fecha: createdAction.issued_on || createdAction.created_on,
 expectedDate: createdAction.expected_date,
 createdOn: createdAction.created_on,
 daysToIssue: createdAction.action_template?.days_to_issue ?? 0,
 hasIssue: createdAction.action_feature?.has_issue ?? false,
 hasReview: createdAction.action_feature?.has_review ?? false,
 hasApprove: createdAction.action_feature?.has_approve ?? false,
 issuedOn: null,
 issuedBy: null,
 issuedByEmail: null,
 reviewedOn: null,
 reviewedBy: null,
 reviewedByEmail: null,
 approvedOn: null,
 approvedBy: null,
 approvedByEmail: null,
 href: null,
 esAccion: true,
 esAutomatica: createdAction.is_automatic,
 screenType: createdAction.action_feature?.has_specific_screen ? (createdAction.action_feature?.screen?.code || "generica") : null,
 origin: createdAction.origin || "M",
 });
 setOpenEditGestionModal(true);
 setSelectedTemplate(null);
 setGestionDescription("");
 setExpectedDate(new Date().toISOString().split("T")[0]);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
 const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const pendingDataRef = useRef<Record<string, unknown>>({});
 const editingActionIdRef = useRef<string | null>(null);
 const savedActionDataRef = useRef<Record<string, unknown> | null>(null);

 const updateGestionDataMutation = useMutation({
 meta: { autosave: true },
 mutationFn: ({ actionId, data }: { actionId: string; data: Record<string, unknown> }) => {
 // Usar el action_data del cache actual, no del closure stale
 const cached = queryClient.getQueryData<{ action_data?: Record<string, unknown> }>(["claim-action", actionId]);
 const baseData = cached?.action_data || savedActionDataRef.current || {};
 const merged = { ...baseData, ...data };
 savedActionDataRef.current = merged;
 return updateClaimAction(actionId, { action_data: merged });
 },
 onSuccess: (_data, vars) => {
 setAutoSaveState("saved");
 // Actualizar cache sin refetch para evitar flicker
 queryClient.setQueryData(["claim-action", vars.actionId], (old: unknown) => {
 if (!old) return old;
 return { ...(old as Record<string, unknown>), action_data: savedActionDataRef.current };
 });
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 setTimeout(() => setAutoSaveState("idle"), 2000);
 },
 onError: (err: Error) => {
 setAutoSaveState("idle");
 toast.error(err.message);
 },
 });

 // Autoguardado tipo Excel: guarda 500ms después de la última pulsación
 const triggerAutoSave = useCallback((data: Record<string, unknown>, actionId: string) => {
 if (Object.keys(data).length === 0) return;
 if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
 setAutoSaveState("saving");
 pendingDataRef.current = data;
 editingActionIdRef.current = actionId;
 autoSaveTimerRef.current = setTimeout(() => {
 updateGestionDataMutation.mutate({ actionId, data });
 pendingDataRef.current = {};
 }, 500);
 }, [updateGestionDataMutation]);

 // Al desmontar o cerrar el modal, guardar cambios pendientes
 const flushPendingSave = useCallback(() => {
 if (autoSaveTimerRef.current) {
 clearTimeout(autoSaveTimerRef.current);
 autoSaveTimerRef.current = null;
 }
 const actionId = editingActionIdRef.current;
 const data = pendingDataRef.current;
 if (actionId && Object.keys(data).length > 0) {
 updateGestionDataMutation.mutate({ actionId, data });
 pendingDataRef.current = {};
 }
 }, [updateGestionDataMutation]);

 // Mutaciones para avanzar el workflow
 const { profile } = useAuth();

 const issueMut = useMutation({
 mutationFn: () => issueClaimAction(
 editingActionId!,
 profile?.id,
 { ...(editingAction?.action_data || {}), ...editingActionData }
 ),
 onSuccess: () => {
 toast.success("Gestión emitida");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
 queryClient.invalidateQueries({ queryKey: ["claim", id] });
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions", id] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const reviewMut = useMutation({
 mutationFn: () => reviewClaimAction(editingActionId!, profile?.id),
 onSuccess: () => {
 toast.success("Gestión revisada");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const approveMut = useMutation({
 mutationFn: () => approveClaimAction(editingActionId!, profile?.id),
 onSuccess: () => {
 toast.success("Gestión aprobada");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const rejectMut = useMutation({
 mutationFn: ({ stage, comment }: { stage: "issue" | "review" | "approve"; comment?: string }) =>
 rejectClaimAction(editingActionId!, stage, profile?.id, comment),
 onSuccess: () => {
 toast.success("Nivel rechazado");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
 },
 onError: (err: Error) => toast.error(err.message),
 });


 const { data: users } = useQuery({
 queryKey: ["users"],
 queryFn: () => getUsers(),
 });

 const { data: claimTypesCatalog } = useQuery({
 queryKey: ["claim-types"],
 queryFn: () => getClaimTypes(),
 });

 const { data: claimCausesCatalog } = useQuery({
 queryKey: ["claim-causes"],
 queryFn: () => getClaimCauses(),
 });

 const { data: insuranceCompaniesCatalog } = useQuery({
 queryKey: ["insurance-companies"],
 queryFn: () => getInsuranceCompanies(),
 });

 const { data: businessLinesCatalog } = useQuery({
 queryKey: ["business-lines"],
 queryFn: () => getBusinessLines(),
 });

 const { data: insuranceProductsCatalog } = useQuery({
 queryKey: ["insurance-products"],
 queryFn: () => getInsuranceProducts(),
 });

 const { data: brokersCatalog } = useQuery({
 queryKey: ["brokers"],
 queryFn: () => getBrokers(),
 });

 const { data: advisorsCatalog } = useQuery({
 queryKey: ["advisors"],
 queryFn: () => getAdvisors(),
 });

 const { data: housingDestinationsCatalog } = useQuery({
 queryKey: ["housing-destinations"],
 queryFn: () => getHousingDestinations(),
 });

 const { data: propertyClassificationsCatalog } = useQuery({
 queryKey: ["property-classifications"],
 queryFn: () => getPropertyClassifications(),
 });

 const { data: damageClassificationsCatalog } = useQuery({
 queryKey: ["damage-classifications"],
 queryFn: () => getDamageClassifications(),
 });

 const { data: constructionTypesCatalog } = useQuery({
 queryKey: ["lookup-catalog", "construction_type"],
 queryFn: () => getLookupCatalog("construction_type"),
 });

 const { data: habitabilityCatalog } = useQuery({
 queryKey: ["lookup-catalog", "habitability"],
 queryFn: () => getLookupCatalog("habitability"),
 });

 const { data: currencyCatalog } = useQuery({
 queryKey: ["currencies"],
 queryFn: () => getCurrencies(),
 });

 const { data: eventsCatalog } = useQuery({
 queryKey: ["events"],
 queryFn: () => getEvents(),
 });

 const { data: companiesCatalog } = useQuery({
 queryKey: ["companies"],
 queryFn: () => getCompanies(),
 });

 const { data: countriesCatalog } = useQuery({
 queryKey: ["countries"],
 queryFn: () => getCountries(),
 });

 // Geo lookups (resolve FK names)
 const { data: countryName } = useQuery({
 queryKey: ["country-by-id", claim?.country_id],
 queryFn: () => getCountryById(claim!.country_id!),
 enabled: !!claim?.country_id,
 });
 const { data: regionName } = useQuery({
 queryKey: ["region-by-id", claim?.region_id],
 queryFn: () => getRegionById(claim!.region_id!),
 enabled: !!claim?.region_id,
 });
 const { data: cityName } = useQuery({
 queryKey: ["city-by-id", claim?.city_id],
 queryFn: () => getCityById(claim!.city_id!),
 enabled: !!claim?.city_id,
 });
 const { data: communeName } = useQuery({
 queryKey: ["commune-by-id", claim?.commune_id],
 queryFn: () => getCommuneById(claim!.commune_id!),
 enabled: !!claim?.commune_id,
 });

 const closeMutation = useMutation({
 mutationFn: () => updateClaimStatus(id, codeToId["closed"]!, profile?.id),
 onSuccess: () => {
 toast.success("Caso cerrado");
 queryClient.invalidateQueries({ queryKey: ["claim", id] });
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const { statusCode, codeToId } = useClaimStatuses();
 const currentStatusCode = statusCode(claim?.status_id) ?? "created";
 const status = statusConfig[currentStatusCode] || statusConfig.created;

 const inspector = users?.find((u) => u.id === claim?.inspector_id);
 const adjuster = users?.find((u) => u.id === claim?.adjuster_id);
 const auditor = users?.find((u) => u.id === claim?.auditor_id);
 const dispatcher = users?.find((u) => u.id === claim?.dispatcher_id);
 const assistant = users?.find((u) => u.id === claim?.assistant_id);

 const insured = claim ? getParticipant(claim, "insured") : undefined;
 const contractor = claim ? getParticipant(claim, "contractor") : undefined;
 const beneficiary = claim ? getParticipant(claim, "beneficiary") : undefined;
 const contact = claim ? getParticipant(claim, "contact") : undefined;

 // ── Registrar visita en recientes (topbar) ──
 const { record } = useRecentClaims();
 useEffect(() => {
 if (!claim?.id) return;
 const bl = businessLinesCatalog?.find((b) => b.id === claim.business_line_id);
 const country = countriesCatalog?.find((c) => c.id === claim.country_id);
 const claimType = claimTypesCatalog?.find((ct) => ct.id === claim.claim_type_id);
 record({
 id: claim.id,
 liquidationNumber: claim.liquidation_number ?? null,
 clientReference: claim.client_reference ?? null,
 insuredName: insured?.full_name ?? null,
 businessLineName: bl?.name ?? null,
 claimTypeIcon: claimType?.icon ?? null,
 countryCode: country?.code ?? null,
 });
 // Solo registrar cuando cambia el id del claim (no en cada render)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [claim?.id]);

 if (isLoading) {
 return (
 <div className="app-page">
 <div className="flex items-center justify-center py-20">
 <p className="text-muted-foreground">Cargando siniestro...</p>
 </div>
 </div>
 );
 }

 if (!claim) {
 return (
 <div className="app-page">
 <div className="flex items-center justify-center py-20">
 <p className="text-muted-foreground">Siniestro no encontrado</p>
 </div>
 </div>
 );
 }

 return (
 <div className="app-page">
 {/* Header */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/claims")}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div className="flex items-center gap-3">
 <h1 className="app-page-title">
 Siniestro {claim.liquidation_number || "—"}
 {claim.client_reference && (
 <span className="text-muted-foreground font-normal"> / Ref.Cliente {claim.client_reference}</span>
 )}
 </h1>
 <Badge className={status.className}>{status.label}</Badge>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {!isEditing && (
 <>
 {canEdit("claims") && (
 <Button
 variant="outline"
 size="sm"
 className="pg-btn-platinum hidden sm:inline-flex"
 onClick={() => setIsEditing(true)}
 >
 Editar
 </Button>
 )}
 {canEdit("claims") && currentStatusCode === "closed" && (
 <Button
 variant="outline"
 size="sm"
 className="pg-btn-platinum hidden sm:inline-flex"
 onClick={() => {
 if (confirm("¿Cerrar este caso? No se podrá revertir.")) closeMutation.mutate();
 }}
 disabled={closeMutation.isPending || !claim?.policy_id}
 title={!claim?.policy_id ? "Asigna una póliza al siniestro primero" : undefined}
 >
 Cerrar
 </Button>
 )}
 </>
 )}
 </div>
 </div>

 {/* Banner: Sin póliza asignada */}
 {!isEditing && !claim?.policy_id && (
 <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-xl p-4 flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
 <div className="flex-1">
 <p className="app-title text-amber-900 dark:text-amber-200">
 Siniestro sin póliza asignada
 </p>
 <p className="app-body text-amber-700 dark:text-amber-300 mt-0.5">
 No se pueden ejecutar gestiones ni cambiar el estado del siniestro hasta que se asigne una póliza.
 Edita el siniestro para seleccionar una póliza existente o crear una nueva.
 </p>
 </div>
 </div>
 )}

 {/* Tabs — solo en modo vista */}
 {!isEditing && (
 <div className="app-tab-bar">
 <div className="app-tab-bar-inner">
 {tabs.map((t) => {
 const Icon = t.icon;
 const isActive = activeTab === t.id;
 return (
 <button
 key={t.id}
 onClick={() => setActiveTab(t.id)}
 className={`app-tab ${isActive ? "app-tab-active" : ""}`}
 >
 <Icon className="h-4 w-4" />
 {t.label}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Modo edición */}
 {isEditing ? (
 <EditClaimForm
 claim={claim}
 participants={claim.claims_participants as ClaimsParticipant[]}
 catalogs={{
 claimTypes: claimTypesCatalog ?? [],
 claimCauses: claimCausesCatalog ?? [],
 insuranceCompanies: insuranceCompaniesCatalog ?? [],
 businessLines: businessLinesCatalog ?? [],
 insuranceProducts: insuranceProductsCatalog ?? [],
 brokers: brokersCatalog ?? [],
 advisors: advisorsCatalog ?? [],
 housingDestinations: housingDestinationsCatalog ?? [],
 propertyClassifications: propertyClassificationsCatalog ?? [],
 damageClassifications: damageClassificationsCatalog ?? [],
 constructionTypes: constructionTypesCatalog ?? [],
 habitability: habitabilityCatalog ?? [],
 events: eventsCatalog ?? [],
 currencies: currencyCatalog ?? [],
 users: (users ?? []).map((u) => ({ id: u.id, full_name: u.full_name || "", email: u.email || "" })),
 companies: (companiesCatalog ?? []).map((c) => ({ id: c.id, name: c.name ?? "" })),
 countries: (countriesCatalog ?? []).map((c) => ({ id: c.id, name: c.name })),
 }}
 onCancel={(tab) => { setActiveTab(tab); setIsEditing(false); }}
 onSaved={(tab) => { setActiveTab(tab); setIsEditing(false); }}
 initialTab={activeTab}
 />
 ) : (
 /* Tab content — modo vista */
 <div className="min-h-[400px]">
 {/* ═══ TAB: SINIESTRO ═══ */}
 {activeTab === "siniestro" && (
 <div className="space-y-2">
 <div className="app-panel">
 <div className="app-data-grid-4">
 <DataField label="N° Liquidación" value={claim.liquidation_number} />
 <DataField label="N° Ref. Cliente" value={claim.client_reference} />
 <DataField label="N° Siniestro (Cía)" value={claim.claim_number} />
 </div>
 </div>
 <div className="app-panel">
 <h3 className="app-section-title">
 <FileText className="h-4 w-4" />
 Datos del Siniestro
 </h3>
 <div className="app-data-grid-4">
 <DataField label="País del Siniestro" value={resolveName(claim.country_id, countriesCatalog)} />
 <DataField label="Empresa (Cliente)" value={resolveName(claim.company_id, companiesCatalog)} />
 <DataField label="Compañía de Seguros" value={resolveName(claim.insurance_company_id, insuranceCompaniesCatalog)} />
 <DataField label="Fecha Siniestro" value={formatDate(claim.claim_date)} />
 <DataField label="Fecha Denuncio" value={formatDate(claim.report_date)} />
 <DataField label="Fecha Asignación" value={formatDate(claim.assignment_date)} />
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 <Shield className="h-4 w-4" />
 Clasificación
 </h3>
 <div className="app-data-grid-4">
 <DataField label="Tipo de Siniestro" value={resolveName(claim.claim_type_id, claimTypesCatalog)} />
 <DataField label="Línea de Negocios" value={resolveName(claim.business_line_id, businessLinesCatalog)} />
 <DataField label="Ramo/Producto" value={resolveName(claim.insurance_product_id, insuranceProductsCatalog)} />
 <DataField label="Causal" value={resolveName(claim.claim_cause_id, claimCausesCatalog)} />
 <DataField label="Evento" value={resolveName(claim.event_id, eventsCatalog)} />
 <DataField label="Corredor" value={resolveName(claim.broker_id, brokersCatalog)} />
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 <Shield className="h-4 w-4" />
 Datos de la Póliza
 </h3>
 <div className="app-data-grid-4">
 <DataField label="N° Póliza" value={claim.policy_number} />
 <DataField label="Item Póliza" value={claim.policy_item} />
 <DataField label="Moneda" value={resolveName(claim.currency_id, currencyCatalog)} />
 <DataField label="Monto Asegurado" value={claim.policy_amount?.toString() || "—"} />
 <DataField label="Prima" value={claim.policy_premium?.toString() || "—"} />
 <DataField label="Inicio Vigencia" value={formatDate(claim.policy_start_date)} />
 <DataField label="Término Vigencia" value={formatDate(claim.policy_end_date)} />
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 <Briefcase className="h-4 w-4" />
 Asignación
 </h3>
 <div className="app-data-grid-4">
 <DataField label="Inspector" value={inspector?.full_name || "—"} />
 <DataField label="Ajustador / Liquidador" value={adjuster?.full_name || "—"} />
 <DataField label="Auditor" value={auditor?.full_name || "—"} />
 <DataField label="Despachador" value={dispatcher?.full_name || "—"} />
 <DataField label="Asistente" value={assistant?.full_name || "—"} />
 <DataField label="Asesor" value={resolveName(claim.advisor_id, advisorsCatalog)} />
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 <FileText className="h-4 w-4" />
 Resumen
 </h3>
 <p className="app-body-text">{claim.summary || "Sin resumen."}</p>
 </div>
 </div>
 )}

 {/* ═══ TAB: ASEGURADO ═══ */}
 {/* ═══ TAB: PARTICIPANTES ═══ */}
 {activeTab === "participantes" && (
 <div className="space-y-2">
 {/* Asegurado */}
 <div className="app-panel">
 <h3 className="app-section-title">
 <User className="h-4 w-4" />
 Asegurado
 </h3>
 <div className="app-data-grid-4">
 <DataField label="RUT" value={insured?.rut || "—"} />
 <DataField label="Tipo" value={personTypeOf(insured) === "legal" ? "Persona Jurídica" : "Persona Natural"} />
 {personTypeOf(insured) === "legal" ? (
 <DataField label="Razón Social" value={displayFirstName(insured!)} />
 ) : (
 <>
 <DataField label="Nombre" value={displayFirstName(insured!)} />
 <DataField label="Apellido" value={insured?.last_name || "—"} />
 </>
 )}
 <DataField label="Email" value={insured?.email || "—"} />
 <DataField label="Teléfono" value={uniquePhones(insured?.phone, insured?.cell_phone) || "—"} />
 <DataField label="Dirección" value={insured?.address || "—"} />
 <DataField label="País" value={insured?.country || "—"} />
 <DataField label="Región" value={insured?.region || "—"} />
 <DataField label="Ciudad" value={insured?.city || "—"} />
 <DataField label="Comuna" value={insured?.commune || "—"} />
 </div>
 </div>

 {/* Contratante */}
 {contractor && (
 <div className="app-panel">
 <h3 className="app-section-title">Contratante</h3>
 <div className="app-data-grid-4">
 <DataField label="RUT" value={contractor.rut || "—"} />
 <DataField label="Tipo" value={personTypeOf(contractor) === "legal" ? "Persona Jurídica" : "Persona Natural"} />
 {personTypeOf(contractor) === "legal" ? (
 <DataField label="Razón Social" value={displayFirstName(contractor)} />
 ) : (
 <>
 <DataField label="Nombre" value={displayFirstName(contractor)} />
 <DataField label="Apellido" value={contractor.last_name || "—"} />
 </>
 )}
 <DataField label="Email" value={contractor.email || "—"} />
 <DataField label="Teléfono" value={uniquePhones(contractor.phone, contractor.cell_phone) || "—"} />
 <DataField label="Dirección" value={contractor.address || "—"} />
 <DataField label="Ciudad" value={contractor.city || "—"} />
 <DataField label="Comuna" value={contractor.commune || "—"} />
 </div>
 </div>
 )}

 {/* Beneficiario */}
 {beneficiary && (
 <div className="app-panel">
 <h3 className="app-section-title">Beneficiario</h3>
 <div className="app-data-grid-4">
 <DataField label="RUT" value={beneficiary.rut || "—"} />
 <DataField label="Tipo" value={personTypeOf(beneficiary) === "legal" ? "Persona Jurídica" : "Persona Natural"} />
 {personTypeOf(beneficiary) === "legal" ? (
 <DataField label="Razón Social" value={displayFirstName(beneficiary)} />
 ) : (
 <>
 <DataField label="Nombre" value={displayFirstName(beneficiary)} />
 <DataField label="Apellido" value={beneficiary.last_name || "—"} />
 </>
 )}
 <DataField label="Email" value={beneficiary.email || "—"} />
 <DataField label="Teléfono" value={uniquePhones(beneficiary.phone, beneficiary.cell_phone) || "—"} />
 <DataField label="Dirección" value={beneficiary.address || "—"} />
 <DataField label="Ciudad" value={beneficiary.city || "—"} />
 <DataField label="Comuna" value={beneficiary.commune || "—"} />
 </div>
 </div>
 )}

 {!insured && !contractor && !beneficiary && (
 <div className="app-panel text-center py-10">
 <p className="text-muted-foreground app-body">No hay participantes registrados.</p>
 </div>
 )}
 </div>
 )}

 {/* ═══ TAB: INCIDENTE ═══ */}
 {activeTab === "incidente" && (
 <div className="space-y-2">
 {/* Dirección del Siniestro */}
 <div className="app-panel">
 <div className="flex items-start justify-between gap-2">
 <h3 className="app-section-title flex items-center gap-2">
 <MapPin className="h-4 w-4" />
 Dirección del Siniestro
 </h3>
 {claim.claim_latitude && claim.claim_longitude && (
 <button
 type="button"
 className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
 title="Ver en mapa"
 onClick={() => setMapOpen(true)}
 >
 <MapPin className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 <div className="app-data-grid-4">
 <DataField label="Dirección" value={claim.claim_address || "—"} />
 <DataField label="Tipo" value={resolveName(claim.destination_housing_id, housingDestinationsCatalog)} />
 <DataField label="País" value={countryName?.name || "—"} />
 <DataField label="Región" value={regionName?.name || "—"} />
 <DataField label="Ciudad" value={cityName?.name || "—"} />
 <DataField label="Comuna" value={communeName?.name || "—"} />
 </div>
 </div>

 {/* Persona de Contacto */}
 {contact && (
 <div className="app-panel">
 <h3 className="app-section-title">
 <User className="h-4 w-4" />
 Persona de Contacto
 </h3>
 <div className="app-data-grid-4">
 <DataField label="RUT" value={contact.rut || "—"} />
 <DataField label="Tipo" value={personTypeOf(contact) === "legal" ? "Persona Jurídica" : "Persona Natural"} />
 {personTypeOf(contact) === "legal" ? (
 <DataField label="Razón Social" value={displayFirstName(contact)} />
 ) : (
 <>
 <DataField label="Nombre" value={displayFirstName(contact)} />
 <DataField label="Apellido" value={contact.last_name || "—"} />
 </>
 )}
 <DataField label="Email" value={contact.email || "—"} />
 <DataField label="Teléfono" value={uniquePhones(contact.phone, contact.cell_phone) || "—"} />
 </div>
 </div>
 )}

 {/* Incidente */}
 <div className="app-panel">
 <h3 className="app-section-title">
 <FileText className="h-4 w-4" />
 Incidente
 </h3>
 <div className="app-data-grid-4">
 <DataField label="Causal del Siniestro" value={resolveName(claim.claim_cause_id, claimCausesCatalog)} />
 <DataField label="Tipo de Construcción" value={resolveName(claim.construction_type_id, constructionTypesCatalog)} />
 <DataField label="Habitabilidad" value={resolveName(claim.habitability_id, habitabilityCatalog)} />
 <DataField label="Clasificación del Daño" value={resolveName(claim.damage_classification_id, damageClassificationsCatalog)} />
 <DataField label="Asegurado/Propietario" value={claim.owner_same_as_insured ? "Propietario" : "Arrendatario"} />
 </div>
 <div className="mt-3 pt-3 border-t border-border/40">
 <span className="app-data-label">Resumen</span>
 <p className="app-body-text mt-0.5">{claim.summary || "Sin resumen."}</p>
 </div>
 </div>

 {/* Recupero */}
 <div className="app-panel">
 <h3 className="app-section-title">
 <Briefcase className="h-4 w-4" />
 Recupero
 </h3>
 <div className="app-data-grid-4">
 <DataField label="Recupero Legal" value={claim.recovery_type_legal ? "Sí" : "No"} />
 <DataField label="Recupero Material" value={claim.recovery_type_material ? "Sí" : "No"} />
 <DataField label="Comentarios" value={claim.recovery_comments || "—"} />
 </div>
 </div>
 </div>
 )}

 {/* ═══ TAB: DOCUMENTOS ═══ */}
 {activeTab === "documentos" && (
 <ClaimDocumentsTab claimId={id} policyId={claim?.policy_id ?? null} />
 )}

 {/* ═══ TAB: IMÁGENES ═══ */}
 {activeTab === "imagenes" && (
 <ClaimImagesTab claimId={id} claimStatusId={claim?.status_id ?? null} />
 )}

 {/* ═══ TAB: GESTIONES ═══ */}
 {activeTab === "gestiones" && (
 <div className="app-panel">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-3">
 {/* Sub-tabs: Lista / Workflow — glass */}
 <div className="app-sub-tab-bar">
 <button
 className={cn("app-sub-tab", gestionSubTab === "lista" && "app-sub-tab-active")}
 onClick={() => setGestionSubTab("lista")}
 >
 Lista
 </button>
 <button
 className={cn("app-sub-tab", gestionSubTab === "workflow" && "app-sub-tab-active")}
 onClick={() => setGestionSubTab("workflow")}
 >
 Workflow
 </button>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {gestionSubTab === "lista" && (
 <ToggleChip
 active={showRejected}
 onClick={(v) => setShowRejected(v)}
 >
 Rechazadas/Deshab.
 </ToggleChip>
 )}
 {canEdit("claims") && gestionSubTab === "lista" && (
 <Button
 size="sm"
 className="pg-btn-platinum hidden sm:inline-flex"
 onClick={() => setOpenGestionModal(true)}
 disabled={!claim?.policy_id}
 title={!claim?.policy_id ? "Asigna una póliza al siniestro primero" : undefined}
 >
 Nuevo
 </Button>
 )}
 </div>
 </div>
 {gestionSubTab === "workflow" ? (
 <WorkflowView
 actions={claimActions || []}
 onOpenAction={(actionId) => {
 const a = (claimActions || []).find(x => x.id === actionId);
 if (a) {
 setEditingActionData({});
 setEditingGestion({
 id: a.id,
 tipo: a.action_feature?.name || a.name || "Acción",
 codigo: a.code || a.name?.slice(0, 10) || "—",
 nombre: a.name || "—",
 estado: a.action_status?.code || "todo",
 fecha: a.issued_on || a.created_on,
 expectedDate: a.expected_date,
 createdOn: a.created_on,
 daysToIssue: a.action_template?.days_to_issue ?? 0,
 hasIssue: a.action_feature?.has_issue ?? false,
 hasReview: a.action_feature?.has_review ?? false,
 hasApprove: a.action_feature?.has_approve ?? false,
 issuedOn: a.issued_on,
 issuedBy: a.issuer?.full_name || null,
 issuedByEmail: a.issuer?.email || null,
 reviewedOn: a.reviewed_on,
 reviewedBy: a.reviewer?.full_name || null,
 reviewedByEmail: a.reviewer?.email || null,
 approvedOn: a.approved_on,
 approvedBy: a.approver?.full_name || null,
 approvedByEmail: a.approver?.email || null,
 href: null,
 esAccion: true,
 screenType: a.action_feature?.has_specific_screen ? (a.action_feature?.screen?.code || "generica") : null,
 esAutomatica: a.is_automatic,
 origin: a.origin || "M",
 });
 setOpenEditGestionModal(true);
 }
 }}
 />
 ) : (() => {
 // Mapa de claim_action_id → inspection_session_id y estado para enlazar gestiones de inspección
 const inspectionByActionId = new Map<string, string>();
 const inspectionStatusByActionId = new Map<string, string>();
 for (const s of (claim.inspection_sessions || [])) {
 if (s.claim_action_id) {
 inspectionByActionId.set(s.claim_action_id, s.id);
 inspectionStatusByActionId.set(s.claim_action_id, s.status);
 }
 }

 // Mapa de claim_action_id → email logs (para filas hijas en la grilla)
 const emailsByActionId = new Map<string, EmailLog[]>();
 for (const log of (emailLogsByClaim || [])) {
   const arr = emailsByActionId.get(log.claim_action_id) || [];
   arr.push(log);
   emailsByActionId.set(log.claim_action_id, arr);
 }

 const actions = (claimActions || []).map((a) => ({
 id: a.id,
 tipo: a.action_feature?.name || a.name || "Acción",
 codigo: a.code || a.name?.slice(0, 10) || "—",
 nombre: a.name || "—",
 estado: a.action_status?.code || "todo",
 isActive: a.is_active,
 fecha: a.issued_on || a.created_on,
 expectedDate: a.expected_date,
 createdOn: a.created_on,
 updatedOn: a.updated_on,
 daysToIssue: a.action_template?.days_to_issue ?? 0,
 daysToReview: a.action_template?.days_to_review ?? 0,
 daysToApprove: a.action_template?.days_to_approve ?? 0,
 hasIssue: a.action_feature?.has_issue ?? false,
 hasReview: a.action_feature?.has_review ?? false,
 hasApprove: a.action_feature?.has_approve ?? false,
 // Datos de quién completó cada nivel
 issuedOn: a.issued_on,
 issuedBy: a.issuer?.full_name || null,
 issuedByEmail: a.issuer?.email || null,
 reviewedOn: a.reviewed_on,
 reviewedBy: a.reviewer?.full_name || null,
 reviewedByEmail: a.reviewer?.email || null,
 approvedOn: a.approved_on,
 approvedBy: a.approver?.full_name || null,
 approvedByEmail: a.approver?.email || null,
 // Si es una gestión de inspección, enlazar al detalle de inspección
 href: inspectionByActionId.has(a.id) ? `/dashboard/inspecciones/${inspectionByActionId.get(a.id)}` : null,
 esAccion: true,
 screenType: a.action_feature?.has_specific_screen ? (a.action_feature?.screen?.code || "generica") : null,
 esAutomatica: a.is_automatic,
 origin: a.origin || "M",
 templateCode: a.action_template?.code || null,
 coordResult: (a.action_data as { coord_result?: string } | null)?.coord_result || null,
 // Color directo desde action_feature (migración 261 — consolidado desde characteristic)
 color: a.action_feature?.color || null,
 }));

 const gestiones = [...actions].sort((a, b) => {
 if (gestionSort) {
 const getVal = (g: typeof a) => {
 switch (gestionSort.key) {
 case "codigo":
 return g.codigo || "";
 case "nombre":
 return g.nombre || "";
 case "fecha":
 return g.fecha ? new Date(g.fecha).getTime() : 0;
 case "dias": {
 const d = g.fecha ? Math.ceil((new Date(g.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
 return d === null ? Number.MAX_SAFE_INTEGER : d;
 }
 case "estado":
 return g.estado || "";
 default:
 return 0;
 }
 };
 const av = getVal(a);
 const bv = getVal(b);
 if (av < bv) return gestionSort.direction === "asc" ? -1 : 1;
 if (av > bv) return gestionSort.direction === "asc" ? 1 : -1;
 return 0;
 }
 const fa = a.createdOn ? new Date(a.createdOn).getTime() : 0;
 const fb = b.createdOn ? new Date(b.createdOn).getTime() : 0;
 return fa - fb;
 });

 if (gestiones.length === 0) {
 return (
 <div className="text-center py-8 text-muted-foreground app-body">
 No hay gestiones registradas.
 </div>
 );
 }

 const renderSortHeader = (sortKey: "codigo" | "nombre" | "fecha" | "dias" | "estado", label: string, className?: string, center?: boolean) => {
 const isActive = gestionSort?.key === sortKey;
 const dir = isActive ? gestionSort.direction : null;
 const nextDir = dir === "asc" ? "desc" : "asc";
 return (
 <th
 className={cn(className, center && "text-center", "cursor-pointer select-none hover:bg-muted/50")}
 onClick={() => setGestionSort({ key: sortKey, direction: nextDir })}
 >
 <span className="inline-flex items-center gap-1">
 {label}
 {isActive ? (
 dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
 ) : (
 <ArrowUpDown className="h-3 w-3 opacity-40" />
 )}
 </span>
 </th>
 );
 };

 return (
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 {renderSortHeader("codigo", "Código", "w-[110px]")}
 {renderSortHeader("nombre", "Nombre Gestión")}
 {renderSortHeader("fecha", "Fecha Ejecución")}
 {renderSortHeader("dias", "Días Restantes")}
 {renderSortHeader("estado", "Estado", "w-[110px]", true)}
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {gestiones.map((g) => {
 const daysLeft = g.fecha
 ? Math.ceil((new Date(g.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
 : null;

 // ── Semáforo: siempre 3 espacios (E, R, A) ──
 // Las luces ahora se renderizan con GestionStatusLights (tooltip interactivo)

 return (
 <tr
 key={g.id}
 className={`cursor-pointer hover:bg-muted/30 transition-colors ${g.isActive === false ? "opacity-50" : ""}`}
 onClick={() => {
 if (g.href) {
 router.push(g.href);
 } else if (g.esAccion && g.screenType && g.screenType !== "inspeccion") {
 setEditingActionData({});
 setEditingGestion(g);
 setOpenEditGestionModal(true);
 }
 }}
 >
 <td className="whitespace-nowrap pr-1">
 <div className="flex items-center gap-1">
 <GestionCodeCell g={g} />
 <span
 className={`app-origin-badge app-origin-${
 g.origin === "W" ? "w" : g.origin === "A" ? "a" : g.origin === "M" ? "m" : "default"
 }`}
 title={g.origin === "W" ? "Workflow" : g.origin === "A" ? "Automática" : g.origin === "M" ? "Manual" : "—"}
 >
 {g.origin}
 </span>
 </div>
 </td>
 <td className="font-medium app-body">
 <div className="flex items-center gap-2">
 {g.nombre}
 {g.href && inspectionStatusByActionId.get(g.id) === "cancelled" && (
 <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
 Cancelada
 </span>
 )}
 {g.templateCode === "CIN" && g.coordResult && (
 <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
   g.coordResult === "desistida"
     ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
     : g.coordResult === "reagendada"
     ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
     : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
 }`}>
 {g.coordResult === "coordinada" && "Coordinada"}
 {g.coordResult === "reagendada" && "Reagendada"}
 {g.coordResult === "desistida" && "Desistida"}
 </span>
 )}
 </div>
 </td>
 <td className="app-body text-muted-foreground">{g.fecha ? formatDateTime(g.fecha) : "—"}</td>
 <td className="app-body">
 {daysLeft !== null && daysLeft < 0 ? (
 <span className="text-red-600 font-medium">{daysLeft}</span>
 ) : daysLeft !== null ? (
 <span className="text-muted-foreground">{daysLeft}</span>
 ) : (
 "—"
 )}
 </td>
 <td className="text-center">
 <GestionStatusLights g={g} />
 </td>
 <td>
 <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
 {g.href && (
 <Button size="sm" className="btn-icon-sm" onClick={() => router.push(g.href!)}>
 <Eye className="h-3 w-3" />
 </Button>
 )}
 {g.esAccion && g.screenType && g.screenType !== "inspeccion" && (
 <Button
 size="sm"
 className="btn-icon-sm"
 onClick={() => {
 setEditingActionData({});
 setEditingGestion(g);
 setOpenEditGestionModal(true);
 }}
 >
 <Pencil className="h-3 w-3" />
 </Button>
 )}
 {/* Botón de correo con menú funcional estilo Mantine — reemplaza el botón MailIcon original */}
 {(() => {
   const emails = emailsByActionId.get(g.id) || [];
   const openCompose = (e: { stopPropagation: () => void }) => {
     e.stopPropagation();
     const action = claimActions?.find((a) => a.id === g.id);
     setEmailComposeAction({
       id: g.id,
       company_id: claim?.company_id || "",
       claim_id: id || "",
       action_template_id: action?.action_template_id || "",
       action_data: action?.action_data as Record<string, unknown> | null,
       gestion_codigo: shortActionCode(g.codigo),
       gestion_nombre: g.nombre,
     });
   };

   // Sin correos: botón directo que abre redactar (sin dropdown)
   if (emails.length === 0) {
     return (
       <button
         type="button"
         onClick={openCompose}
         className="btn-icon-sm relative"
         title="Redactar correo"
       >
         <CorreoIcon size={20} />
       </button>
     );
   }

   // Con correos: dropdown con redactar + lista
   return (
     <DropdownMenu>
       <DropdownMenuTrigger
         render={
           <button
             type="button"
             onClick={(e) => e.stopPropagation()}
             className="btn-icon-sm relative"
             title={`${emails.length} correo${emails.length > 1 ? "s" : ""}`}
           >
             <CorreoIcon size={20} />
             <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] font-bold leading-none">
               {emails.length}
             </span>
           </button>
         }
       />
       <DropdownMenuContent align="end" arrow className="w-64 p-1.5 dropdown-emerge" sideOffset={4}>
         {/* Item 1: Redactar Correo */}
         <DropdownMenuItem
           onClick={openCompose}
           className="cursor-pointer"
         >
           <div className="flex items-center justify-center h-6 w-6 rounded bg-linear-to-br from-sky-500 to-indigo-600 text-white shrink-0">
             <Plus className="h-3.5 w-3.5" />
           </div>
           <div className="flex flex-col min-w-0">
             <span className="app-body font-medium">Redactar Correo</span>
             <span className="text-[10px] text-muted-foreground">Crear un nuevo correo desde esta gestión</span>
           </div>
         </DropdownMenuItem>

         <DropdownMenuSeparator />

         {/* Item 2: Correos enviados (n) — submenu con la lista */}
         <DropdownMenuSub>
           <DropdownMenuSubTrigger className="cursor-pointer">
             <div className="flex items-center justify-center h-6 w-6 rounded bg-linear-to-br from-amber-400 to-orange-600 text-white shrink-0">
               <Inbox className="h-3.5 w-3.5" />
             </div>
             <div className="flex flex-col min-w-0 flex-1">
               <span className="app-body font-medium">Correos enviados</span>
               <span className="text-[10px] text-muted-foreground">
                 {emails.length} correo{emails.length > 1 ? "s" : ""}
               </span>
             </div>
             <span className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
               {emails.length}
             </span>
           </DropdownMenuSubTrigger>
           <DropdownMenuSubContent className="w-72 p-0 overflow-hidden" sideOffset={4}>
             {/* Header del submenu — 2 líneas compactas */}
             <div className="app-email-submenu-header">
               <div className="app-email-submenu-title">Correos Enviados</div>
               <div className="app-email-submenu-meta">
                 <span className="app-email-submenu-meta-code">{g.codigo}</span>
                 <span className="app-email-submenu-meta-count">{emails.length} enviado{emails.length !== 1 ? "s" : ""}</span>
               </div>
             </div>
             {/* Lista de correos */}
             <div className="app-email-submenu-list">
               {emails.map((log) => {
                 const emailCode = `EML-${String(log.correlativo).padStart(3, "0")}`;
                 const statusTone = log.status === "sent" ? "emerald" : log.status === "queued" ? "amber" : "rose";
                 const statusLabel = log.status === "sent" ? "Enviado" : log.status === "queued" ? "En cola" : "Error";
                 const Icon = log.status === "sent" ? MailCheck : log.status === "queued" ? History : AlertTriangle;
                 const iconTone = log.status === "sent" ? "from-emerald-400 to-emerald-600" : log.status === "queued" ? "from-amber-400 to-amber-600" : "from-rose-400 to-rose-600";
                 return (
                   <DropdownMenuItem
                     key={log.id}
                     onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setEmailPreviewLog(log); }}
                     className="cursor-pointer py-2 border-b border-border/30 last:border-0"
                   >
                     <div className={cn("flex items-center justify-center h-6 w-6 rounded bg-linear-to-br text-white shrink-0", iconTone)}>
                       <Icon className="h-3 w-3" />
                     </div>
                     <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                       <div className="flex items-center justify-between gap-2">
                         <span className="font-mono app-body text-primary font-medium">{emailCode}</span>
                         <div className="flex items-center gap-1.5">
                           {log.status === "failed" && (
                             <button
                               type="button"
                               onClick={(e: { stopPropagation: () => void }) => {
                                 e.stopPropagation();
                                 resendEmailMutation.mutate(log.id);
                               }}
                               disabled={resendEmailMutation.isPending && resendEmailMutation.variables === log.id}
                               title="Reenviar correo"
                               className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                             >
                               <RotateCw className={`h-3 w-3 ${resendEmailMutation.isPending && resendEmailMutation.variables === log.id ? "animate-spin" : ""}`} />
                             </button>
                           )}
                           <span className="text-[10px] text-muted-foreground tabular-nums">
                             {new Date(log.sent_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                           </span>
                         </div>
                       </div>
                       <p className="app-body truncate">{log.subject || "(sin asunto)"}</p>
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[10px] text-muted-foreground truncate">{log.to_address.join(", ") || "—"}</span>
                         <StatusBadge tone={statusTone} label={statusLabel} size="sm" dot />
                       </div>
                     </div>
                   </DropdownMenuItem>
                 );
               })}
             </div>
           </DropdownMenuSubContent>
         </DropdownMenuSub>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 })()}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 );
 })()}
 </div>
 )}

 {/* ═══ TAB: LOG ═══ */}
 {activeTab === "log" && (
 <AuditLogSection
 claimId={claim.id}
 users={users}
 catalogs={{
 companies: companiesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 claimTypes: claimTypesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 claimCauses: claimCausesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 insuranceCompanies: insuranceCompaniesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 businessLines: businessLinesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 insuranceProducts: insuranceProductsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 brokers: brokersCatalog?.map((c) => ({ id: c.id, name: c.name })),
 advisors: advisorsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 events: eventsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 housingDestinations: housingDestinationsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 propertyClassifications: propertyClassificationsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 damageClassifications: damageClassificationsCatalog?.map((c) => ({ id: c.id, name: c.name })),
 constructionTypes: constructionTypesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 habitability: habitabilityCatalog?.map((c) => ({ id: c.id, name: c.name })),
 currencies: currencyCatalog?.map((c) => ({ id: c.id, name: c.name })),
 countries: countriesCatalog?.map((c) => ({ id: c.id, name: c.name })),
 }}
 />
 )}

 </div>
 )}

 {/* ═══ MODAL: Nueva Gestión ═══ */}
 <Dialog open={openGestionModal} onOpenChange={setOpenGestionModal}>
 <DialogContent className="modal-md" showCloseButton>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <ClipboardList className="h-4 w-4" />
 </div>
 Nueva Gestión
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Selecciona la gestión a aplicar al siniestro {claim?.liquidation_number || "—"} / {claim?.client_reference || "—"}.
 </DialogDescription>
 </div>

 <div className="modal-body space-y-3">
 {templatesLoading ? (
 <p className="text-muted-foreground app-body py-8 text-center">Cargando gestiones...</p>
 ) : !chainFilteredTemplates || chainFilteredTemplates.length === 0 ? (
 <div className="text-center py-8">
 <p className="app-body text-muted-foreground mb-1">
 No hay gestiones disponibles para el estado actual del siniestro.
 </p>
 <p className="app-body text-muted-foreground">
 Algunas gestiones requieren que se complete una gestión previa (ej: Reserva requiere Ingreso de Coberturas cerrado).
 </p>
 </div>
 ) : (
 <>
 <div>
 <label className="app-field-label app-body">Tipo de Gestión *</label>
 <Select
 value={selectedTemplate?.id || "__none"}
 onValueChange={(v) => {
 const id = v === "__none" ? "" : (v ?? "");
 const tpl = chainFilteredTemplates.find((t) => t.id === id) || null;
 setSelectedTemplate(tpl);
 }}
 items={[
 { value: "__none", label: "Seleccionar..." },
 ...chainFilteredTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
 ]}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar...">
 {(val: string) => {
 if (!val || val === "__none") return "Seleccionar...";
 const tpl = chainFilteredTemplates.find((t) => t.id === val);
 return tpl ? tpl.name : "Seleccionar...";
 }}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar...</SelectItem>
 {chainFilteredTemplates.map((tpl) => {
 // Indicador de especificidad del match
 const tags: string[] = [];
 if (tpl.line_business_id) {
 const lineName = businessLinesCatalog?.find(b => b.id === tpl.line_business_id)?.name;
 tags.push(lineName || "Línea");
 }
 if (tpl.event_id) {
 const eventName = eventsCatalog?.find(e => e.id === tpl.event_id)?.name;
 tags.push(eventName || "Evento");
 }
 if (tpl.insurance_company_id) {
 const ciaName = insuranceCompaniesCatalog?.find(c => c.id === tpl.insurance_company_id)?.name;
 tags.push(ciaName || "Cía");
 }
 const matchLabel = tags.length > 0 ? ` · ${tags.join("+")}` : " · General";
 return (
 <SelectItem key={tpl.id} value={tpl.id}>
 {tpl.name}<span className="app-body text-muted-foreground">{matchLabel}</span>
 </SelectItem>
 );
 })}
 </SelectContent>
 </Select>
 </div>

 <div>
 <label className="app-field-label app-body">Descripción</label>
 <textarea
 className="app-input w-full min-h-[60px] resize-none"
 placeholder="Descripción de la gestión..."
 value={gestionDescription}
 onChange={(e) => setGestionDescription(e.target.value)}
 />
 </div>

 <div>
 <label className="app-field-label app-body">Fecha *</label>
 <DatePicker
 value={expectedDate}
 onChange={(value) => setExpectedDate(value)}
 className="w-[130px]"
 />
 </div>
 </>
 )}
 </div>

 <div className="modal-footer">
 <Button
 size="sm"
 className="pg-btn-platinum"
 onClick={() => {
 setOpenGestionModal(false);
 setSelectedTemplate(null);
 setGestionDescription("");
 setExpectedDate(new Date().toISOString().split("T")[0]);
 }}
 >
 Cancelar
 </Button>
 <Button
 size="sm"
 className="pg-btn-platinum"
 disabled={!selectedTemplate || createGestionMutation.isPending}
 onClick={() => selectedTemplate && createGestionMutation.mutate(selectedTemplate)}
 >
 {createGestionMutation.isPending ? "Guardando..." : "Guardar"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {/* ═══ MODAL: Editar Gestión ═══ */}
 <Dialog open={openEditGestionModal} onOpenChange={setOpenEditGestionModal}>
 <DialogContent className="modal-xl" showCloseButton>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <ClipboardList className="h-4 w-4" />
 </div>
 {editingGestion?.nombre || "Editar Gestión"}
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 {editingGestion?.codigo && `Código: ${shortActionCode(editingGestion.codigo)}`}
 </DialogDescription>
 </div>

 <div className="modal-body">
 {!editingAction || !editingScreens ? (
 <div className="text-center py-8 space-y-2">
 <p className="app-body text-muted-foreground">Cargando gestión...</p>
 {(editingActionError || editingScreensError) && (
 <p className="app-body text-red-500">
 Error: {editingActionError?.message || editingScreensError?.message}
 </p>
 )}
 <p className="app-body text-muted-foreground">
 action: {editingAction ? "OK" : "—"} | screens: {editingScreens ? `[${editingScreens.length}]` : "—"}
 </p>
 </div>
 ) : (
 <>
 <GestionScreenSwitcher
 screens={editingScreens}
 claim={claim}
 action={{ ...editingAction, action_data: { ...editingAction.action_data, ...editingActionData } }}
 onChange={(data) => {
 const merged = { ...editingActionData, ...data };
 setEditingActionData(merged);
 if (editingActionId) triggerAutoSave(merged, editingActionId);
 }}
 readOnly={(() => {
 const statusCode = editingAction.action_status?.code || "todo";
 const statusIsClosed = ["issued", "reviewed", "approved", "dispatched", "closed", "rejected"].includes(statusCode);
 if (statusIsClosed) return true;
 // Determinar responsable según la etapa actual
 const currentResponsibleId =
 statusCode === "todo" ? editingAction.issuer_id :
 statusCode === "issued" ? editingAction.reviewer_id :
 statusCode === "reviewed" ? editingAction.approver_id :
 null;
 // Si no hay responsable asignado, permitir edición (LevelCard auto-asignará
 // al usuario si es candidato; si no lo es, no podrá grabar de todas formas
 // porque los botones de emitir/rechazar validan por responsable).
 if (!currentResponsibleId) return false;
 // Si hay responsable y NO es el usuario actual → readOnly
 return currentResponsibleId !== profile?.id;
 })()}
 onAdvance={(level) => {
 const mut = level === "issuer" ? issueMut : level === "reviewer" ? reviewMut : approveMut;
 // Flush autoguardado pendiente antes de emitir
 if (autoSaveTimerRef.current) {
 clearTimeout(autoSaveTimerRef.current);
 autoSaveTimerRef.current = null;
 }
 if (Object.keys(editingActionData).length > 0) {
 updateGestionDataMutation.mutate(
 { actionId: editingAction.id, data: editingActionData },
 { onSuccess: () => mut.mutate() }
 );
 } else {
 mut.mutate();
 }
 }}
 onReject={(level, comment) => {
 const stage = level === "issuer" ? "issue" : level === "reviewer" ? "review" : "approve";
 rejectMut.mutate({ stage, comment });
 }}
 />
 <ActionHistoryView actionId={editingAction.id} />
 </>
 )}
 </div>

 {editingAction && (() => {
 const statusCode = editingAction.action_status?.code || "todo";
 const isClosed = ["approved", "dispatched", "closed", "rejected"].includes(statusCode);

 return (
 <div className="modal-footer">
 {!isClosed && autoSaveState !== "idle" && (
 <span className="app-body text-muted-foreground flex items-center gap-1.5 mr-auto">
 {autoSaveState === "saving" ? (
 <>
 <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
 Guardando...
 </>
 ) : (
 <>
 <CheckCircle className="h-3 w-3 text-emerald-500" />
 Guardado
 </>
 )}
 </span>
 )}
 <Button
 size="sm"
 className="pg-btn-platinum"
 onClick={() => {
 flushPendingSave();
 setOpenEditGestionModal(false);
 setEditingGestion(null);
 setEditingActionData({});
 }}
 >
 Cerrar
 </Button>
 </div>
 );
 })()}
 </DialogContent>
 </Dialog>

 {/* ═══ MODAL: Mapa de ubicación del siniestro ═══ */}
 {claim.claim_latitude && claim.claim_longitude && (
 <Dialog open={mapOpen} onOpenChange={setMapOpen}>
 <DialogContent className="modal-lg" showCloseButton>
 <DialogHeader className="p-4 pb-0">
 <DialogTitle className="app-section-title">Ubicación del siniestro</DialogTitle>
 <DialogDescription className="modal-subtitle">
 {claim.claim_address || "Ubicación confirmada"} — {Number(claim.claim_latitude).toFixed(6)}, {Number(claim.claim_longitude).toFixed(6)}
 </DialogDescription>
 </DialogHeader>
 <div className="h-100">
 <MapContainer
 center={[claim.claim_latitude, claim.claim_longitude]}
 zoom={16}
 className="h-full w-full"
 scrollWheelZoom={false}
 >
 <TileLayer
 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
 />
 <Marker position={[claim.claim_latitude, claim.claim_longitude]} />
 </MapContainer>
 </div>
 </DialogContent>
 </Dialog>
 )}

 {/* ═══ MODAL: Enviar E-mail desde gestión ═══ */}
 {emailComposeAction && (
 <EmailComposeModal
 open={!!emailComposeAction}
 onOpenChange={(v) => { if (!v) setEmailComposeAction(null); }}
 claim={(claim ?? null) as unknown as Record<string, unknown> | null}
 action={emailComposeAction}
 businessLineId={claim?.business_line_id}
 />
 )}

 {/* ═══ MODAL: Preview de E-mail enviado ═══ */}
 <EmailPreviewModal
 open={!!emailPreviewLog}
 onOpenChange={(v) => { if (!v) setEmailPreviewLog(null); }}
 log={emailPreviewLog}
 />
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// Historial de la gestión (timeline de cambios)
// ═══════════════════════════════════════════════════════════════

const EVENT_LABELS: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
 created: { label: "Creada", icon: Plus, color: "text-slate-500" },
 issued: { label: "Emitida", icon: Send, color: "text-blue-500" },
 reviewed: { label: "Revisada", icon: Eye, color: "text-cyan-500" },
 approved: { label: "Aprobada", icon: CheckCircle, color: "text-emerald-500" },
 dispatched: { label: "Despachada", icon: Send, color: "text-indigo-500" },
 rejected_issue: { label: "Emisión rechazada", icon: XCircle, color: "text-rose-500" },
 rejected_review: { label: "Revisión rechazada", icon: XCircle, color: "text-rose-500" },
 rejected_approve: { label: "Aprobación rechazada", icon: XCircle, color: "text-rose-500" },
 rejected_dispatch: { label: "Despacho rechazado", icon: XCircle, color: "text-rose-500" },
 reversed: { label: "Reversada", icon: Undo2, color: "text-amber-500" },
 reassigned_issuer: { label: "Emisor reasignado", icon: User, color: "text-amber-500" },
 reassigned_reviewer: { label: "Revisor reasignado", icon: User, color: "text-amber-500" },
 reassigned_approver: { label: "Aprobador reasignado", icon: User, color: "text-amber-500" },
 data_updated: { label: "Datos actualizados", icon: FileText, color: "text-slate-500" },
 deleted: { label: "Eliminada", icon: Trash2, color: "text-rose-500" },
};

function ActionHistoryView({ actionId }: { actionId: string }) {
 const [showHistory, setShowHistory] = useState(false);
 const { data: history, isLoading } = useQuery({
 queryKey: ["action-history", actionId],
 queryFn: () => getActionHistory(actionId),
 enabled: showHistory,
 });

 return (
 <div className="mt-3">
 <button
 type="button"
 onClick={() => setShowHistory(!showHistory)}
 className="flex items-center gap-1.5 app-body text-muted-foreground hover:text-foreground transition-colors"
 >
 <History className="h-3.5 w-3.5" />
 {showHistory ? "Ocultar historial" : "Ver historial"}
 </button>
 {showHistory && (
 <div className="mt-2 rounded-lg border border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 backdrop-blur-md p-3 max-h-[200px] overflow-y-auto">
 {isLoading ? (
 <p className="app-body text-muted-foreground text-center py-2">Cargando historial...</p>
 ) : !history || history.length === 0 ? (
 <p className="app-body text-muted-foreground text-center py-2">Sin eventos registrados.</p>
 ) : (
 <div className="space-y-2">
 {history.map((entry) => {
 const evt = EVENT_LABELS[entry.event_type] || { label: entry.event_type, icon: History, color: "text-slate-500" };
 const Icon = evt.icon;
 const date = new Date(entry.created_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
 const userName = entry.performed_by_name || entry.performed_by_profile?.full_name || "Sistema";
 return (
 <div key={entry.id} className="flex items-start gap-2 app-body">
 <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${evt.color}`} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-medium">{evt.label}</span>
 <span className="text-muted-foreground">· {userName}</span>
 </div>
 <div className="app-body text-muted-foreground">{date}</div>
 {entry.comment && (
 <div className="app-body text-rose-600 dark:text-rose-400 mt-0.5 italic">
 &ldquo;{entry.comment}&rdquo;
 </div>
 )}
 {entry.previous_responsible_name && entry.new_responsible_name && (
 <div className="app-body text-muted-foreground mt-0.5">
 {entry.previous_responsible_name} → {entry.new_responsible_name}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// Indicador de niveles de revisión configurados
// ═══════════════════════════════════════════════════════════════

function DataField({ label, value }: { label: string; value: React.ReactNode }) {
 return (
 <div className="app-data-field">
 <span className="app-data-label">{label}</span>
 <p className="app-data-value">{value || "—"}</p>
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// Luces de estado de gestión con tooltip interactivo (hover)
// Muestra: emisor/revisor/aprobador asignado, fechas, días restantes
// ═══════════════════════════════════════════════════════════════

type LightState = "done" | "active" | "alert" | "late" | "rejected" | "pending" | "none";

interface GestionLightData {
 nombre: string;
 codigo: string;
 estado: string;
 createdOn: string | undefined;
 updatedOn: string | null;
 expectedDate: string | null;
 daysToIssue: number;
 daysToReview: number;
 daysToApprove: number;
 hasIssue: boolean;
 hasReview: boolean;
 hasApprove: boolean;
 issuedOn: string | null;
 issuedBy: string | null;
 reviewedOn: string | null;
 reviewedBy: string | null;
 approvedOn: string | null;
 approvedBy: string | null;
}

function GestionStatusLights({ g }: { g: GestionLightData }) {
 const [hoveredLight, setHoveredLight] = useState<number | null>(null);
 const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const lightStyles: Record<LightState, { dot: string; label: string }> = {
 done: { dot: "bg-emerald-100 dark:bg-emerald-900/30", label: "text-emerald-700 dark:text-emerald-300" },
 active: { dot: "bg-amber-100 dark:bg-amber-900/30", label: "text-amber-700 dark:text-amber-300" },
 alert: { dot: "bg-amber-100 dark:bg-amber-900/30", label: "text-amber-700 dark:text-amber-300" },
 late: { dot: "bg-rose-100 dark:bg-rose-900/30", label: "text-rose-700 dark:text-rose-300" },
 rejected: { dot: "bg-rose-100 dark:bg-rose-900/30", label: "text-rose-700 dark:text-rose-300" },
 pending: { dot: "bg-slate-100 dark:bg-slate-800/50", label: "text-slate-600 dark:text-slate-400" },
 none: { dot: "bg-transparent border border-dashed border-slate-200 dark:border-slate-700", label: "text-muted-foreground/40" },
 };

 const handleMouseEnter = (i: number) => {
 if (hoverTimer.current) clearTimeout(hoverTimer.current);
 hoverTimer.current = setTimeout(() => setHoveredLight(i), 200);
 };
 const handleMouseLeave = () => {
 if (hoverTimer.current) clearTimeout(hoverTimer.current);
 setHoveredLight(null);
 };

 // daysSinceCreated: días transcurridos desde la creación.
 // Date.now() es impura pero necesaria para cálculos de plazo.
 // Se calcula en render porque el valor cambia con el tiempo y debe refrescarse.
 const daysSinceCreated = g.createdOn
 // eslint-disable-next-line react-hooks/purity
 ? Math.floor((Date.now() - new Date(g.createdOn).getTime()) / (1000 * 60 * 60 * 24))
 : 0;

 const levels: { letter: string; state: LightState; level: "issue" | "review" | "approve" }[] = [];

 let issueState: LightState = "none";
 if (g.hasIssue) {
 if (g.estado === "rejected") {
 issueState = "rejected";
 } else if (g.issuedOn && g.issuedBy) {
 issueState = "done";
 } else if (g.estado === "todo") {
 const dti = g.daysToIssue || 0;
 if (dti > 0 && daysSinceCreated > dti) {
 issueState = "late";
 } else if (dti > 0 && daysSinceCreated >= dti * 0.7) {
 issueState = "alert";
 } else {
 issueState = "pending";
 }
 } else {
 issueState = "pending";
 }
 }
 levels.push({ letter: "E", state: issueState, level: "issue" });

 let reviewState: LightState = "none";
 if (g.hasReview) {
 if (g.reviewedOn && g.reviewedBy) {
 reviewState = "done";
 } else if (g.estado === "issued") {
 reviewState = "active";
 } else if (g.estado === "todo" || g.estado === "rejected") {
 reviewState = "pending";
 } else {
 reviewState = "done";
 }
 }
 levels.push({ letter: "R", state: reviewState, level: "review" });

 let approveState: LightState = "none";
 if (g.hasApprove) {
 if (g.approvedOn && g.approvedBy) {
 approveState = "done";
 } else if (g.estado === "reviewed") {
 approveState = "active";
 } else if (g.estado === "todo" || g.estado === "rejected") {
 approveState = "pending";
 } else {
 approveState = "pending";
 }
 }
 levels.push({ letter: "A", state: approveState, level: "approve" });

 return (
 <div className="inline-flex items-center gap-1.5">
 {levels.map((light, i) => {
 const sty = lightStyles[light.state];
 const isNone = light.state === "none";
 const tooltipContent = isNone ? null : (
 <GestionLevelTooltip g={g} level={light.level} state={light.state} />
 );
 return (
 <Popover
 key={i}
 open={hoveredLight === i && !isNone}
 onOpenChange={(open) => { if (!open) setHoveredLight(null); }}
 >
 <PopoverTrigger
 nativeButton={false}
 render={
 <div
 className="flex flex-col items-center gap-0.5"
 onMouseEnter={() => !isNone && handleMouseEnter(i)}
 onMouseLeave={handleMouseLeave}
 >
 <span
 className={`inline-flex items-center justify-center rounded-full w-5 h-5 gestion-light-pill ${isNone ? "bg-transparent border border-dashed border-slate-200 dark:border-slate-700 text-muted-foreground/40" : `${sty.dot} ${sty.label}`} ${light.state === "active" ? "animate-pulse" : ""} transition-all`}
 >
 {light.letter}
 </span>
 </div>
 }
 />
 {tooltipContent && (
 <PopoverContent
 side="bottom"
 sideOffset={4}
 align="center"
 className="gestion-light-tooltip"
 onMouseEnter={() => setHoveredLight(i)}
 onMouseLeave={handleMouseLeave}
 >
 {tooltipContent}
 </PopoverContent>
 )}
 </Popover>
 );
 })}
 </div>
 );
}

function GestionLevelTooltip({ g, level, state }: { g: GestionLightData; level: "issue" | "review" | "approve"; state: LightState }) {
 const levelLabel = level === "issue" ? "Emisión" : level === "review" ? "Revisión" : "Aprobación";
 const Icon = level === "issue" ? Send : level === "review" ? Eye : CheckCircle;

 const responsible = level === "issue" ? g.issuedBy : level === "review" ? g.reviewedBy : g.approvedBy;
 const completedOn = level === "issue" ? g.issuedOn : level === "review" ? g.reviewedOn : g.approvedOn;
 const daysLimit = level === "issue" ? g.daysToIssue : level === "review" ? g.daysToReview : g.daysToApprove;

 // daysSinceCreated: Date.now() es impura pero necesaria para cálculos de plazo.
 const daysSinceCreated = g.createdOn
 // eslint-disable-next-line react-hooks/purity
 ? Math.floor((Date.now() - new Date(g.createdOn).getTime()) / (1000 * 60 * 60 * 24))
 : 0;
 const daysLeft = daysLimit > 0 ? daysLimit - daysSinceCreated : null;

 const stateText =
 state === "done" ? "Completada" :
 state === "active" ? "En curso" :
 state === "late" ? "Atrasada" :
 state === "alert" ? "En alerta" :
 state === "pending" ? "Pendiente" :
 state === "rejected" ? "Rechazada" : "—";

 const stateClass =
 state === "done" ? "gestion-light-tooltip-value-done" :
 state === "late" ? "gestion-light-tooltip-value-late" :
 state === "alert" ? "gestion-light-tooltip-value-alert" :
 state === "active" ? "gestion-light-tooltip-value-active" :
 "gestion-light-tooltip-value-pending";

 return (
 <div>
 <div className="gestion-light-tooltip-header">
 <Icon className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="gestion-light-tooltip-title">{levelLabel}</span>
 <span className={`gestion-light-tooltip-value ${stateClass} ml-auto`}>{stateText}</span>
 </div>

 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Responsable</span>
 <span className="gestion-light-tooltip-value">
 {responsible || "Por asignar"}
 </span>
 </div>

 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Creada</span>
 <span className="gestion-light-tooltip-value">
 {g.createdOn ? formatDate(g.createdOn) : "—"}
 </span>
 </div>

 {state === "done" && completedOn && (
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Completada</span>
 <span className="gestion-light-tooltip-value">
 {formatDate(completedOn)}
 </span>
 </div>
 )}

 {state !== "done" && daysLimit > 0 && (
 <>
 <div className="gestion-light-tooltip-divider" />
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Plazo</span>
 <span className="gestion-light-tooltip-value">{daysLimit} días</span>
 </div>
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Transcurridos</span>
 <span className="gestion-light-tooltip-value">{daysSinceCreated} días</span>
 </div>
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Restantes</span>
 <span className={`gestion-light-tooltip-value ${stateClass}`}>
 {daysLeft !== null && daysLeft < 0 ? `${Math.abs(daysLeft)} días de atraso` : `${daysLeft} días`}
 </span>
 </div>
 </>
 )}

 {g.expectedDate && (
 <>
 <div className="gestion-light-tooltip-divider" />
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Fecha esp.</span>
 <span className="gestion-light-tooltip-value">{formatDate(g.expectedDate)}</span>
 </div>
 </>
 )}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// Tooltip del código de gestión (hover)
// Muestra: nombre completo, código, fechas de creación/actualización
// ═══════════════════════════════════════════════════════════════

function GestionCodeTooltip({ nombre, codigo, createdOn, updatedOn, origin, hasIssue, hasReview, hasApprove, issuedBy, issuedOn, reviewedBy, reviewedOn, approvedBy, approvedOn, daysToIssue, daysToReview, daysToApprove, expectedDate }: {
 nombre: string;
 codigo: string;
 createdOn: string | undefined;
 updatedOn: string | null;
 origin: string;
 hasIssue: boolean;
 hasReview: boolean;
 hasApprove: boolean;
 issuedBy: string | null;
 issuedOn: string | null;
 reviewedBy: string | null;
 reviewedOn: string | null;
 approvedBy: string | null;
 approvedOn: string | null;
 daysToIssue: number;
 daysToReview: number;
 daysToApprove: number;
 expectedDate: string | null;
}) {
 // Fecha máxima = fecha esperada (expected_date) del último nivel que tiene la gestión
 const lastLevelDate =
 hasApprove ? (issuedOn && reviewedOn && approvedOn ? null : expectedDate) :
 hasReview ? (issuedOn && reviewedOn ? null : expectedDate) :
 hasIssue ? (issuedOn ? null : expectedDate) :
 expectedDate;

 // Responsables por nivel (solo los que tiene la gestión)
 const levels: { label: string; who: string | null; when: string | null }[] = [];
 if (hasIssue) {
 levels.push({ label: "Emisor", who: issuedBy, when: issuedOn });
 }
 if (hasReview) {
 levels.push({ label: "Revisor", who: reviewedBy, when: reviewedOn });
 }
 if (hasApprove) {
 levels.push({ label: "Aprobador", who: approvedBy, when: approvedOn });
 }

 // Plazo del último nivel
 const lastLevelPlazo =
 hasApprove ? daysToApprove :
 hasReview ? daysToReview :
 hasIssue ? daysToIssue : 0;
 const lastLevelLabel =
 hasApprove ? "Aprobación" :
 hasReview ? "Revisión" :
 hasIssue ? "Emisión" : "";

 const originText =
 origin === "W" ? "Generada por workflow" :
 origin === "A" ? "Generada automáticamente" :
 origin === "M" ? "Generada manualmente" : "";

 return (
 <div className="gestion-light-tooltip">
 <div className="gestion-light-tooltip-header">
 <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="gestion-light-tooltip-title">{shortActionCode(codigo)}</span>
 </div>
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Gestión</span>
 <span className="gestion-light-tooltip-value font-medium">{nombre}</span>
 </div>

 {levels.length > 0 && (
 <>
 <div className="gestion-light-tooltip-divider" />
 {levels.map((lvl) => (
 <div key={lvl.label} className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">{lvl.label}</span>
 <span className="gestion-light-tooltip-value">
 {lvl.who || "Por asignar"}
 {lvl.when && <span className="gestion-light-tooltip-sub"> · {formatDate(lvl.when)}</span>}
 </span>
 </div>
 ))}
 </>
 )}

 {lastLevelLabel && lastLevelPlazo > 0 && (
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Plazo {lastLevelLabel}</span>
 <span className="gestion-light-tooltip-value">{lastLevelPlazo} días</span>
 </div>
 )}

 {lastLevelDate && (
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Fecha esp.</span>
 <span className="gestion-light-tooltip-value">{formatDate(lastLevelDate)}</span>
 </div>
 )}

 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Creada</span>
 <span className="gestion-light-tooltip-value">{createdOn ? formatDateTime(createdOn) : "—"}</span>
 </div>
 <div className="gestion-light-tooltip-row">
 <span className="gestion-light-tooltip-label">Actualizada</span>
 <span className="gestion-light-tooltip-value">{updatedOn ? formatDateTime(updatedOn) : "—"}</span>
 </div>

 {originText && (
 <p className="gestion-code-tooltip-legend">
 <span className="gestion-code-tooltip-legend-badge">{origin}</span>{" "}
 {originText}
 </p>
 )}
 </div>
 );
}

// Celda del código de gestión con tooltip al hover
function GestionCodeCell({ g }: { g: {
 nombre: string;
 codigo: string;
 createdOn: string | undefined;
 updatedOn: string | null;
 color: string | null;
 isActive: boolean;
 origin: string;
 hasIssue: boolean;
 hasReview: boolean;
 hasApprove: boolean;
 issuedBy: string | null;
 issuedOn: string | null;
 reviewedBy: string | null;
 reviewedOn: string | null;
 approvedBy: string | null;
 approvedOn: string | null;
 daysToIssue: number;
 daysToReview: number;
 daysToApprove: number;
 expectedDate: string | null;
} }) {
 const [open, setOpen] = useState(false);
 const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 const handleMouseEnter = () => {
 if (hoverTimer.current) clearTimeout(hoverTimer.current);
 hoverTimer.current = setTimeout(() => setOpen(true), 200);
 };
 const handleMouseLeave = () => {
 if (hoverTimer.current) clearTimeout(hoverTimer.current);
 setOpen(false);
 };

 const code = shortActionCode(g.codigo);
 const hexColor = g.color;

 return (
 <div className="flex items-center gap-1.5">
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger
 nativeButton={false}
 render={
 <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
 {hexColor ? (
 <div
 className="app-gestion-code"
 style={{ "--gestion-color": hexColor } as React.CSSProperties}
 >
 <div className="app-gestion-code-glow" />
 <span>{code}</span>
 </div>
 ) : (
 <span className="app-gestion-code-plain text-primary tabular-nums">{code}</span>
 )}
 </div>
 }
 />
 <PopoverContent
 side="bottom"
 sideOffset={4}
 align="start"
 className="gestion-light-tooltip-popover"
 onMouseEnter={() => setOpen(true)}
 onMouseLeave={handleMouseLeave}
 >
 <GestionCodeTooltip
 nombre={g.nombre}
 codigo={g.codigo}
 createdOn={g.createdOn}
 updatedOn={g.updatedOn}
 origin={g.origin}
 hasIssue={g.hasIssue}
 hasReview={g.hasReview}
 hasApprove={g.hasApprove}
 issuedBy={g.issuedBy}
 issuedOn={g.issuedOn}
 reviewedBy={g.reviewedBy}
 reviewedOn={g.reviewedOn}
 approvedBy={g.approvedBy}
 approvedOn={g.approvedOn}
 daysToIssue={g.daysToIssue}
 daysToReview={g.daysToReview}
 daysToApprove={g.daysToApprove}
 expectedDate={g.expectedDate}
 />
 </PopoverContent>
 </Popover>
 {g.isActive === false && (
 <span className="inline-flex items-center justify-center rounded px-0.5 app-body font-bold bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" title="Gestión deshabilitada">OFF</span>
 )}
 </div>
 );
}
