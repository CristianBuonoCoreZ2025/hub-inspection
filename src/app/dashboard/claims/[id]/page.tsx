"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaimById, getClaimParticipants, deleteClaim, updateClaimStatus } from "@/services/claims";
import { getUsers } from "@/services/users";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBusinessLines, getInsuranceProducts, getBrokers, getAdvisors, getHousingDestinations, getPropertyClassifications, getDamageClassifications, getLookupCatalog, getEvents } from "@/services/catalogs";
import { createInspectionSession } from "@/services/inspections";
import type { ClaimsParticipant } from "@/types";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ClipboardCheck,
  MapPin,
  User,
  Phone,
  Mail,
  Shield,
  FileText,
  Clock,
  Lock,
  Users,
  Building,
  Briefcase,
  FolderOpen,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuditLogSection from "./audit-log-section";
import EditClaimForm from "./edit-claim-form";

const statusConfig: Record<string, { label: string; className: string }> = {
  created: { label: "Creado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Programado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  in_progress: { label: "En Progreso", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  pending_info: { label: "Pendiente Info", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  in_review: { label: "En Revisión", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  signed: { label: "Firmado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  closed: { label: "Cerrado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getParticipant(claim: { claims_participants?: { type: string; full_name: string | null; first_name: string | null; last_name: string | null; rut: string | null; email: string | null; phone: string | null; cell_phone: string | null; address: string | null; country: string | null; region: string | null; city: string | null; commune: string | null }[] }, type: string) {
  return claim.claims_participants?.find((p) => p.type === type);
}

function resolveName(id: string | null | undefined, catalog?: { id: string; name: string }[]) {
  if (!id) return "—";
  return catalog?.find((c) => c.id === id)?.name || id;
}

const tabs = [
  { id: "siniestro", label: "Siniestro", icon: FileText },
  { id: "asegurado", label: "Asegurado", icon: User },
  { id: "participantes", label: "Participantes", icon: Users },
  { id: "incidente", label: "Incidente", icon: MapPin },
  { id: "asignaciones", label: "Asignaciones", icon: Briefcase },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
  { id: "inspeccion", label: "Inspección", icon: Video },
];

export default function ClaimDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("siniestro");
  const [isEditing, setIsEditing] = useState(false);

  const { data: rawClaim, isLoading } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => getClaimById(id),
  });

  const { data: participants } = useQuery({
    queryKey: ["claim-participants", id],
    queryFn: () => getClaimParticipants(id),
    enabled: !!id,
  });

  const claim = rawClaim
    ? { ...rawClaim, claims_participants: participants ?? [] }
    : undefined;

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

  const { data: eventsCatalog } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const createInspectionMutation = useMutation({
    mutationFn: createInspectionSession,
    onSuccess: (session) => {
      toast.success("Inspección creada");
      router.push(`/dashboard/inspecciones/${session.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaim,
    onSuccess: () => {
      toast.success("Siniestro eliminado");
      router.push("/dashboard/claims");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => updateClaimStatus(id, "closed"),
    onSuccess: () => {
      toast.success("Caso cerrado");
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const status = statusConfig[claim?.status || "created"] || statusConfig.created;

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
          <div>
            <h1 className="text-xl font-semibold">Siniestro {claim.claim_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={status.className}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(claim.claim_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="btn-create btn-sm"
                onClick={() => createInspectionMutation.mutate(claim.id)}
                disabled={createInspectionMutation.isPending}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Inspeccionar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="btn-save btn-sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {claim.status === "signed" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-neutral btn-sm"
                  onClick={() => {
                    if (confirm("¿Cerrar este caso? No se podrá revertir.")) closeMutation.mutate();
                  }}
                  disabled={closeMutation.isPending}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar caso
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="btn-danger btn-sm"
                onClick={() => { if (confirm("¿Eliminar este siniestro?")) deleteMutation.mutate(claim.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs — solo en modo vista */}
      {!isEditing && (
        <div className="border-b">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            users: (users ?? []).map((u) => ({ id: u.id, full_name: u.full_name, email: u.email })),
          }}
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      ) : (
      /* Tab content — modo vista */
      <div className="min-h-[400px]">
        {/* ═══ TAB: SINIESTRO ═══ */}
        {activeTab === "siniestro" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Datos del Siniestro
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                  <DataField label="N° Siniestro" value={claim.claim_number} />
                  <DataField label="N° Póliza" value={claim.policy_number} />
                  <DataField label="Item Póliza" value={claim.policy_item} />
                  <DataField label="N° Ref. Cliente" value={claim.client_reference} />
                  <DataField label="N° Siniestro Cía" value={claim.company_report_number} />
                  <DataField label="N° Liquidación" value={claim.liquidation_number} />
                  <DataField label="Fecha Siniestro" value={formatDate(claim.claim_date)} />
                  <DataField label="Fecha Denuncio" value={formatDate(claim.report_date)} />
                  <DataField label="Fecha Asignación" value={formatDate(claim.assignment_date)} />
                  <DataField label="Tipo" value={resolveName(claim.claim_type_id, claimTypesCatalog)} />
                  <DataField label="Causal" value={resolveName(claim.claim_cause_id, claimCausesCatalog)} />
                  <DataField label="Evento" value={resolveName(claim.event, eventsCatalog)} />
                </div>
              </div>

              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Datos de la Póliza
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                  <DataField label="Moneda" value={claim.policy_currency || "—"} />
                  <DataField label="Monto Asegurado" value={claim.policy_amount?.toString() || "—"} />
                  <DataField label="Prima" value={claim.policy_premium?.toString() || "—"} />
                  <DataField label="Inicio Vigencia" value={formatDate(claim.policy_start_date)} />
                  <DataField label="Término Vigencia" value={formatDate(claim.policy_end_date)} />
                </div>
              </div>

              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Resumen
                </h3>
                <p className="text-[13px] text-foreground leading-relaxed">{claim.summary || "Sin resumen."}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Información de Recovery
                </h3>
                <div className="space-y-3 text-[13px]">
                  <DataField label="Recupero Legal" value={claim.recovery_type_legal ? "Sí" : "No"} />
                  <DataField label="Recupero Material" value={claim.recovery_type_material ? "Sí" : "No"} />
                  <DataField label="Comentarios" value={claim.recovery_comments || "—"} />
                </div>
              </div>

              <AuditLogSection claimId={claim.id} />
            </div>
          </div>
        )}

        {/* ═══ TAB: ASEGURADO ═══ */}
        {activeTab === "asegurado" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Asegurado
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <DataField label="Nombre" value={insured?.first_name || insured?.full_name || "—"} />
                <DataField label="Apellido" value={insured?.last_name || "—"} />
                <DataField label="RUT" value={insured?.rut || "—"} />
                <DataField label="Email" value={insured?.email || "—"} />
                <DataField label="Teléfono" value={insured?.phone || "—"} />
                <DataField label="Celular" value={insured?.cell_phone || "—"} />
              </div>
            </div>
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Dirección
              </h3>
              <div className="space-y-3 text-[13px]">
                <DataField label="Dirección" value={insured?.address || "—"} />
                <DataField label="País" value={insured?.country || "—"} />
                <DataField label="Región" value={insured?.region || "—"} />
                <DataField label="Ciudad" value={insured?.city || "—"} />
                <DataField label="Comuna" value={insured?.commune || "—"} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: PARTICIPANTES ═══ */}
        {activeTab === "participantes" && (
          <div className="space-y-6">
            {contractor && (
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contratante</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
                  <DataField label="Nombre" value={contractor.full_name} />
                  <DataField label="RUT" value={contractor.rut || "—"} />
                  <DataField label="Email" value={contractor.email || "—"} />
                  <DataField label="Celular" value={contractor.cell_phone || "—"} />
                  <DataField label="Dirección" value={contractor.address || "—"} />
                  <DataField label="Ciudad" value={contractor.city || "—"} />
                  <DataField label="Comuna" value={contractor.commune || "—"} />
                </div>
              </div>
            )}
            {beneficiary && (
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Beneficiario</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
                  <DataField label="Nombre" value={beneficiary.full_name} />
                  <DataField label="RUT" value={beneficiary.rut || "—"} />
                  <DataField label="Email" value={beneficiary.email || "—"} />
                  <DataField label="Celular" value={beneficiary.cell_phone || "—"} />
                  <DataField label="Dirección" value={beneficiary.address || "—"} />
                  <DataField label="Ciudad" value={beneficiary.city || "—"} />
                  <DataField label="Comuna" value={beneficiary.commune || "—"} />
                </div>
              </div>
            )}
            {contact && (
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Persona de Contacto</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
                  <DataField label="Nombre" value={contact.full_name} />
                  <DataField label="Email" value={contact.email || "—"} />
                  <DataField label="Teléfono" value={contact.phone || "—"} />
                  <DataField label="Celular" value={contact.cell_phone || "—"} />
                </div>
              </div>
            )}
            {!contractor && !beneficiary && !contact && (
              <div className="app-panel text-center py-10">
                <p className="text-muted-foreground text-[13px]">No hay participantes adicionales registrados.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: INCIDENTE ═══ */}
        {activeTab === "incidente" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ubicación del Incidente
              </h3>
              <div className="space-y-3 text-[13px]">
                <DataField label="Dirección" value={claim.claim_address || "—"} />
                <DataField label="País" value={claim.claim_country || "—"} />
                <DataField label="Región" value={claim.claim_region || "—"} />
                <DataField label="Ciudad" value={claim.claim_city || "—"} />
                <DataField label="Comuna" value={claim.claim_commune || "—"} />
              </div>
            </div>
            <div className="space-y-6">
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tipo de Siniestro</h3>
                <div className="space-y-3 text-[13px]">
                  <DataField label="Tipo Construcción" value={resolveName(claim.construction_type_id, constructionTypesCatalog)} />
                  <DataField label="Destino" value={resolveName(claim.destination_housing_id, housingDestinationsCatalog)} />
                  <DataField label="Clasif. Daño" value={resolveName(claim.damage_classification_id, damageClassificationsCatalog)} />
                  <DataField label="Habitabilidad" value={resolveName(claim.habitability_id, habitabilityCatalog)} />
                  <DataField label="Dueño = Asegurado" value={claim.owner_same_as_insured ? "Sí" : "No"} />
                </div>
              </div>
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumen del Incidente</h3>
                <p className="text-[13px] text-foreground leading-relaxed">{claim.summary || "Sin resumen."}</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: ASIGNACIONES ═══ */}
        {activeTab === "asignaciones" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PersonCard label="Inspector" person={inspector} icon={User} />
            <PersonCard label="Ajustador" person={adjuster} icon={User} />
            <PersonCard label="Auditor" person={auditor} icon={User} />
            <PersonCard label="Despachador" person={dispatcher} icon={User} />
            <PersonCard label="Asistente" person={assistant} icon={User} />
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Intermediarios
              </h3>
              <div className="space-y-3 text-[13px]">
                <DataField label="Corredor" value={resolveName(claim.broker_id, brokersCatalog)} />
                <DataField label="Asesor" value={resolveName(claim.advisor_id, advisorsCatalog)} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: DOCUMENTOS ═══ */}
        {activeTab === "documentos" && (
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documentos de Soporte
            </h3>
            <div className="border rounded-xl border-dashed p-10 text-center">
              <p className="text-muted-foreground text-[13px]">Arrastra archivo(s) o haz clic para seleccionarlos.</p>
              <p className="text-muted-foreground text-xs mt-1">Acepta archivos PDF, Word y Excel de hasta 10 MB.</p>
            </div>
            <table className="w-full mt-4 text-[13px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Nombre de documento</th>
                  <th className="text-left py-2 px-3">Tipo de documento</th>
                  <th className="text-left py-2 px-3">Nombre de archivo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="text-center text-muted-foreground py-6">No hay documentos cargados.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ TAB: INSPECCIÓN ═══ */}
        {activeTab === "inspeccion" && (
          <div className="app-panel text-center py-12">
            <Video className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Inspección Remota</h3>
            <p className="text-muted-foreground text-[13px] mb-4 max-w-md mx-auto">
              Inicia una inspección remota en vivo con el asegurado. Se generará una sala de videollamada y un magic link de acceso.
            </p>
            <Button
              className="btn-create btn-sm"
              onClick={() => createInspectionMutation.mutate(claim.id)}
              disabled={createInspectionMutation.isPending}
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {createInspectionMutation.isPending ? "Creando..." : "Iniciar Inspección"}
            </Button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</span>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function PersonCard({ label, person, icon: Icon }: { label: string; person?: { full_name: string | null; email: string | null; phone: string | null } | undefined; icon: React.ElementType }) {
  return (
    <div className="app-panel">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </h3>
      {person ? (
        <div className="space-y-2 text-[13px]">
          <p className="font-medium">{person.full_name || "—"}</p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span>{person.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{person.phone || "—"}</span>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-[13px]">Sin asignar</p>
      )}
    </div>
  );
}
