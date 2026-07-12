"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaimById, getClaimParticipants, updateClaimStatus } from "@/services/claims";
import { getClaimActions, getActionTemplatesByClaimStatus, createClaimAction, getClaimActionById, updateClaimAction, issueClaimAction, reviewClaimAction, approveClaimAction, rejectClaimAction } from "@/services/claim-actions";
import { getActionHistory } from "@/services/claim-action-history";
import { getGestionScreensForClaimAction } from "@/services/gestion-screens";
import { getUsers } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBusinessLines, getInsuranceProducts, getBrokers, getAdvisors, getHousingDestinations, getPropertyClassifications, getDamageClassifications, getLookupCatalog, getEvents, getCountryById, getRegionById, getCityById, getCommuneById } from "@/services/catalogs";
import type { ClaimsParticipant, ActionTemplate } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  User,
  Shield,
  FileText,
  Lock,
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
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AuditLogSection from "./audit-log-section";
import ClaimDocumentsTab from "./claim-documents-tab";
import EditClaimForm from "./edit-claim-form";
import GestionScreenSwitcher from "./gestion-screens";
import WorkflowView from "./workflow-view";

const statusConfig: Record<string, { label: string; className: string }> = {
  created: { label: "Creación", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  adjustment: { label: "Liquidación", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  dispatchment: { label: "Despacho", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  closed: { label: "Cierre", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  reopened: { label: "Reapertura", className: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
  const [activeTab, setActiveTab] = useState("siniestro");
  const [isEditing, setIsEditing] = useState(false);
  const [openGestionModal, setOpenGestionModal] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [gestionSubTab, setGestionSubTab] = useState<"lista" | "workflow">("lista");
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
  const [openEditGestionModal, setOpenEditGestionModal] = useState(false);
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

  const { data: claimActions } = useQuery({
    queryKey: ["claim-actions", id, showRejected],
    queryFn: () => getClaimActions(id, showRejected),
    enabled: !!id,
    staleTime: 0,
  });

  const claim = rawClaim
    ? { ...rawClaim, claims_participants: participants ?? [] }
    : undefined;

  // Plantillas disponibles según el estado del siniestro (carga solo al abrir modal)
  const { data: availableTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ["action-templates-by-status", claim?.status_id, claim?.business_line_id],
    queryFn: () => getActionTemplatesByClaimStatus(claim!.status_id!, claim!.business_line_id || undefined),
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
    if (code === "PCA") {
      return actions.some((a) => a.action_template?.code === "RES" && a.action_status?.code && CLOSED_STATUSES.has(a.action_status.code));
    }
    if (code === "RTA") {
      return actions.some((a) => a.action_template?.code === "NSA");
    }
    return true;
  });

  const editingActionId = editingGestion?.id;
  const { data: editingAction } = useQuery({
    queryKey: ["claim-action", editingActionId],
    queryFn: () => getClaimActionById(editingActionId!),
    enabled: !!editingActionId && openEditGestionModal,
  });

  const { data: editingScreens } = useQuery({
    queryKey: ["gestion-screens", editingActionId],
    queryFn: async () => editingAction ? getGestionScreensForClaimAction(editingAction) : [],
    enabled: !!editingAction,
  });

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
    onSuccess: () => {
      toast.success("Gestión creada");
      queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
      setOpenGestionModal(false);
      setSelectedTemplate(null);
      setGestionDescription("");
      setExpectedDate(new Date().toISOString().split("T")[0]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateGestionDataMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: Record<string, unknown> }) =>
      updateClaimAction(actionId, { action_data: { ...editingAction?.action_data, ...data } }),
    onSuccess: () => {
      toast.success("Gestión actualizada");
      queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
      queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutaciones para avanzar el workflow
  const { profile } = useAuth();

  const issueMut = useMutation({
    mutationFn: () => issueClaimAction(editingActionId!, profile?.id, editingAction?.action_data || undefined),
    onSuccess: () => {
      toast.success("Gestión emitida");
      queryClient.invalidateQueries({ queryKey: ["claim-actions", id] });
      queryClient.invalidateQueries({ queryKey: ["claim-action", editingActionId] });
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
    queryKey: ["lookup-catalog", "currency"],
    queryFn: () => getLookupCatalog("currency"),
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
    mutationFn: () => updateClaimStatus(id, codeToId["closed"]!),
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
            <h1 className="text-xl font-semibold">
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
                  className="btn-save btn-sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
              {canEdit("claims") && currentStatusCode === "closed" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-neutral btn-sm"
                  onClick={() => {
                    if (confirm("¿Cerrar este caso? No se podrá revertir.")) closeMutation.mutate();
                  }}
                  disabled={closeMutation.isPending || !claim?.policy_id}
                  title={!claim?.policy_id ? "Asigna una póliza al siniestro primero" : undefined}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar caso
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Banner: Sin póliza asignada */}
      {!isEditing && !claim?.policy_id && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
              Siniestro sin póliza asignada
            </p>
            <p className="text-[12px] text-amber-700 dark:text-amber-300 mt-0.5">
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
            users: (users ?? []).map((u) => ({ id: u.id, full_name: u.full_name, email: u.email })),
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
                <p className="text-muted-foreground text-[13px]">No hay participantes registrados.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: INCIDENTE ═══ */}
        {activeTab === "incidente" && (
          <div className="space-y-2">
            {/* Dirección del Siniestro */}
            <div className="app-panel">
              <h3 className="app-section-title">
                <MapPin className="h-4 w-4" />
                Dirección del Siniestro
              </h3>
              <div className="app-data-grid-4">
                <DataField label="Dirección" value={claim.claim_address || "—"} />
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
                  <DataField label="Nombre" value={contact.first_name || contact.full_name || "—"} />
                  <DataField label="Apellido" value={contact.last_name || "—"} />
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
                <DataField label="Destino" value={resolveName(claim.destination_housing_id, housingDestinationsCatalog)} />
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

        {/* ═══ TAB: GESTIONES ═══ */}
        {activeTab === "gestiones" && (
          <div className="app-panel">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {/* Sub-tabs: Lista / Workflow */}
                <div className="flex items-center gap-1 bg-muted/40 rounded-md p-0.5">
                  <button
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${gestionSubTab === "lista" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setGestionSubTab("lista")}
                  >
                    Lista
                  </button>
                  <button
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${gestionSubTab === "workflow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
                    Rechazadas
                  </ToggleChip>
                )}
                {canEdit("claims") && gestionSubTab === "lista" && (
                  <Button
                    size="sm"
                    className="btn-create btn-footer"
                    onClick={() => setOpenGestionModal(true)}
                    disabled={!claim?.policy_id}
                    title={!claim?.policy_id ? "Asigna una póliza al siniestro primero" : undefined}
                  >
                    <Plus className="h-3.5 w-3.5" />
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
              // Mapa de claim_action_id → inspection_session_id para enlazar gestiones de inspección
              const inspectionByActionId = new Map<string, string>();
              for (const s of (claim.inspection_sessions || [])) {
                if (s.claim_action_id) inspectionByActionId.set(s.claim_action_id, s.id);
              }

              const actions = (claimActions || []).map((a) => ({
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
              }));

              const gestiones = actions.sort((a, b) => {
                const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
                const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
                return fb - fa;
              });

              if (gestiones.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground text-[13px]">
                    No hay gestiones registradas.
                  </div>
                );
              }

              return (
                <div className="app-data-table-wrap">
                  <table className="app-data-table">
                    <thead>
                      <tr>
                        <th className="w-[90px]">Código</th>
                        <th>Nombre Gestión</th>
                        <th>Fecha Ejecución</th>
                        <th>Días Restantes</th>
                        <th className="w-[110px] text-center">Estado</th>
                        <th className="w-[80px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gestiones.map((g) => {
                        const daysLeft = g.fecha
                          ? Math.ceil((new Date(g.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;

                        // ── Semáforo: siempre 3 espacios (E, R, A) ──
                        // state: "done" | "active" | "alert" | "late" | "rejected" | "pending" | "none"
                        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : null;

                        type LightState = "done" | "active" | "alert" | "late" | "rejected" | "pending" | "none";

                        const lightStyles: Record<LightState, { dot: string; label: string }> = {
                          done:     { dot: "bg-emerald-500",             label: "text-emerald-600 dark:text-emerald-400" },
                          active:   { dot: "bg-amber-400",              label: "text-amber-600 dark:text-amber-400" },
                          alert:    { dot: "bg-amber-400",              label: "text-amber-600 dark:text-amber-400" },
                          late:     { dot: "bg-red-500",                label: "text-red-600 dark:text-red-400" },
                          rejected: { dot: "bg-rose-500",               label: "text-rose-600 dark:text-rose-400" },
                          pending:  { dot: "bg-slate-300 dark:bg-slate-600", label: "text-muted-foreground" },
                          none:     { dot: "bg-transparent border border-dashed border-slate-200 dark:border-slate-700", label: "text-muted-foreground/40" },
                        };

                        let lights: { letter: string; state: LightState; title: string }[];

                        if (!g.esAccion) {
                          // Inspecciones: una sola luz en el primer espacio
                          const st = g.estado;
                          const inspState: LightState =
                            st === "rejected" || st === "cancelled" ? "rejected" :
                            st === "completed" || st === "signed" ? "done" :
                            st === "active" || st === "scheduled" ? "active" : "pending";
                          const inspTitle =
                            st === "rejected" || st === "cancelled" ? "Rechazada" :
                            st === "completed" || st === "signed" ? "Completada" :
                            st === "active" || st === "scheduled" ? "En curso" : "Pendiente";
                          lights = [
                            { letter: "I", state: inspState, title: inspTitle },
                            { letter: "R", state: "none", title: "" },
                            { letter: "A", state: "none", title: "" },
                          ];
                        } else {
                          // Gestiones: calcular estado de cada nivel
                          // Emisión (E)
                          let issueState: LightState = "none";
                          let issueTitle = "";
                          if (g.hasIssue) {
                            if (g.estado === "rejected") {
                              issueState = "rejected";
                              issueTitle = "Emisión rechazada";
                            } else if (g.issuedOn && g.issuedBy) {
                              issueState = "done";
                              issueTitle = `Emisión ✓\nPor: ${g.issuedBy}${g.issuedByEmail ? ` (${g.issuedByEmail})` : ""}\nFecha: ${fmtDate(g.issuedOn)}`;
                            } else if (g.estado === "todo") {
                              const createdDate = g.createdOn ? new Date(g.createdOn) : null;
                              const daysSince = createdDate ? Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                              const dti = g.daysToIssue || 0;
                              if (dti > 0 && daysSince > dti) {
                                issueState = "late";
                                issueTitle = `Emisión ATRASADA\n${daysSince} días (plazo: ${dti} días)`;
                              } else if (dti > 0 && daysSince >= dti * 0.7) {
                                issueState = "alert";
                                issueTitle = `Emisión EN ALERTA\n${daysSince}/${dti} días`;
                              } else {
                                issueState = "pending";
                                issueTitle = "Emisión pendiente";
                              }
                            } else {
                              issueState = "pending";
                              issueTitle = "Emisión pendiente";
                            }
                          }

                          // Revisión (R)
                          let reviewState: LightState = "none";
                          let reviewTitle = "";
                          if (g.hasReview) {
                            if (g.reviewedOn && g.reviewedBy) {
                              reviewState = "done";
                              reviewTitle = `Revisión ✓\nPor: ${g.reviewedBy}${g.reviewedByEmail ? ` (${g.reviewedByEmail})` : ""}\nFecha: ${fmtDate(g.reviewedOn)}`;
                            } else if (g.estado === "issued") {
                              reviewState = "active";
                              reviewTitle = "Revisión en curso";
                            } else if (g.estado === "todo" || g.estado === "rejected") {
                              reviewState = "pending";
                              reviewTitle = "Revisión pendiente";
                            } else {
                              reviewState = "done";
                              reviewTitle = "Revisión completada";
                            }
                          }

                          // Aprobación (A)
                          let approveState: LightState = "none";
                          let approveTitle = "";
                          if (g.hasApprove) {
                            if (g.approvedOn && g.approvedBy) {
                              approveState = "done";
                              approveTitle = `Aprobación ✓\nPor: ${g.approvedBy}${g.approvedByEmail ? ` (${g.approvedByEmail})` : ""}\nFecha: ${fmtDate(g.approvedOn)}`;
                            } else if (g.estado === "reviewed") {
                              approveState = "active";
                              approveTitle = "Aprobación en curso";
                            } else if (g.estado === "todo" || g.estado === "rejected") {
                              approveState = "pending";
                              approveTitle = "Aprobación pendiente";
                            } else {
                              approveState = "pending";
                              approveTitle = "Aprobación pendiente";
                            }
                          }

                          lights = [
                            { letter: "E", state: issueState, title: issueTitle },
                            { letter: "R", state: reviewState, title: reviewTitle },
                            { letter: "A", state: approveState, title: approveTitle },
                          ];
                        }

                        return (
                          <tr key={g.id}>
                            <td className="font-mono text-[10px] text-primary tabular-nums whitespace-nowrap">
                              <span>{shortActionCode(g.codigo)}</span>
                              <span className={`ml-1 inline-flex items-center justify-center rounded px-0.5 text-[8px] font-bold ${
                                g.origin === "W" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}>{g.origin}</span>
                            </td>
                            <td className="font-medium text-[11px]">{g.nombre}</td>
                            <td className="text-[11px] text-muted-foreground">{g.fecha ? formatDateTime(g.fecha) : "—"}</td>
                            <td className="text-[11px]">
                              {daysLeft !== null && daysLeft < 0 ? (
                                <span className="text-red-600 font-medium">{daysLeft}</span>
                              ) : daysLeft !== null ? (
                                <span className="text-muted-foreground">{daysLeft}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-center">
                              <div className="inline-flex items-center gap-1.5">
                                {lights.map((light, i) => {
                                  const sty = lightStyles[light.state];
                                  return (
                                    <div
                                      key={i}
                                      className="flex flex-col items-center gap-0.5 cursor-help"
                                      title={light.title}
                                    >
                                      <div
                                        className={`flex items-center justify-center rounded-full ${sty.dot} ${light.state === "active" ? "animate-pulse" : ""} transition-all`}
                                        style={{ width: 16, height: 16 }}
                                      />
                                      <span className={`text-[8px] font-bold leading-none ${sty.label}`}>
                                        {light.letter}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                {g.href && (
                                  <Button size="sm" className="btn-icon w-6 h-6" onClick={() => router.push(g.href!)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                )}
                                {g.esAccion && g.screenType && g.screenType !== "inspeccion" && (
                                  <Button
                                    size="sm"
                                    className="btn-icon w-6 h-6"
                                    onClick={() => {
                                      setEditingGestion(g);
                                      setOpenEditGestionModal(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
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
          <AuditLogSection claimId={claim.id} users={users} />
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
              Selecciona la gestión a aplicar al siniestro #{claim?.claim_number}.
            </DialogDescription>
          </div>

          <div className="modal-body space-y-3">
            {templatesLoading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Cargando gestiones...</p>
            ) : !chainFilteredTemplates || chainFilteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-1">
                  No hay gestiones disponibles para el estado actual del siniestro.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Algunas gestiones requieren que se complete una gestión previa (ej: Reserva requiere Ingreso de Coberturas cerrado).
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="app-field-label text-[11px]">Tipo de Gestión *</label>
                  <select
                    className="app-input h-8 text-[12px] w-full"
                    value={selectedTemplate?.id || ""}
                    onChange={(e) => {
                      const tpl = chainFilteredTemplates.find((t) => t.id === e.target.value) || null;
                      setSelectedTemplate(tpl);
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {[...chainFilteredTemplates]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="app-field-label text-[11px]">Descripción</label>
                  <textarea
                    className="app-input text-[12px] w-full min-h-[60px] resize-none"
                    placeholder="Descripción de la gestión..."
                    value={gestionDescription}
                    onChange={(e) => setGestionDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="app-field-label text-[11px]">Fecha *</label>
                  <Input
                    type="date"
                    className="app-input h-8 text-[12px]"
                    value={expectedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <Button
              size="sm"
              className="btn-cancel btn-footer"
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
              className="btn-save btn-footer"
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
        <DialogContent className="modal-lg" showCloseButton>
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
              <p className="text-sm text-muted-foreground text-center py-8">Cargando gestión...</p>
            ) : (
              <>
                <GestionScreenSwitcher
                  screens={editingScreens}
                  action={editingAction}
                  onChange={(data) => setEditingActionData((prev) => ({ ...prev, ...data }))}
                  readOnly={["approved", "dispatched", "closed", "rejected"].includes(editingAction.action_status?.code || "todo")}
                  onAdvance={(level) => {
                    const mut = level === "issuer" ? issueMut : level === "reviewer" ? reviewMut : approveMut;
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
                <Button
                  size="sm"
                  className="btn-cancel btn-footer"
                  onClick={() => { setOpenEditGestionModal(false); setEditingGestion(null); setEditingActionData({}); }}
                >
                  Cerrar
                </Button>
                {!isClosed && (
                  <Button
                    size="sm"
                    className="btn-save btn-footer"
                    disabled={updateGestionDataMutation.isPending || Object.keys(editingActionData).length === 0}
                    onClick={() => {
                      if (Object.keys(editingActionData).length > 0) {
                        updateGestionDataMutation.mutate({ actionId: editingAction.id, data: editingActionData });
                      }
                    }}
                  >
                    {updateGestionDataMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
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
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        {showHistory ? "Ocultar historial" : "Ver historial"}
      </button>
      {showHistory && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 max-h-[200px] overflow-y-auto">
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">Cargando historial...</p>
          ) : !history || history.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-2">Sin eventos registrados.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const evt = EVENT_LABELS[entry.event_type] || { label: entry.event_type, icon: History, color: "text-slate-500" };
                const Icon = evt.icon;
                const date = new Date(entry.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
                const userName = entry.performed_by_name || entry.performed_by_profile?.full_name || "Sistema";
                return (
                  <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${evt.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{evt.label}</span>
                        <span className="text-muted-foreground">· {userName}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{date}</div>
                      {entry.comment && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 italic">
                          &ldquo;{entry.comment}&rdquo;
                        </div>
                      )}
                      {entry.previous_responsible_name && entry.new_responsible_name && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
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


