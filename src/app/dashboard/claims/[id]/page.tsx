"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaimById, getClaimParticipants, updateClaimStatus } from "@/services/claims";
import { getClaimActions } from "@/services/claim-actions";
import { getUsers } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBusinessLines, getInsuranceProducts, getBrokers, getAdvisors, getHousingDestinations, getPropertyClassifications, getDamageClassifications, getLookupCatalog, getEvents, getCountryById, getRegionById, getCityById, getCommuneById } from "@/services/catalogs";
import type { ClaimsParticipant } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  ClipboardCheck,
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuditLogSection from "./audit-log-section";
import EditClaimForm from "./edit-claim-form";

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

export default function ClaimDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { canEdit, canCreate, canView } = usePermissions();
  const [activeTab, setActiveTab] = useState("siniestro");
  const [isEditing, setIsEditing] = useState(false);

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
    queryKey: ["claim-actions", id],
    queryFn: () => getClaimActions(id),
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
                  disabled={closeMutation.isPending}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar caso
                </Button>
              )}
            </>
          )}
        </div>
      </div>

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
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      ) : (
      /* Tab content — modo vista */
      <div className="min-h-[400px]">
        {/* ═══ TAB: SINIESTRO ═══ */}
        {activeTab === "siniestro" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-2">
              <div className="app-panel">
                <div className="app-data-grid">
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
                <div className="app-data-grid">
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
                <div className="app-data-grid">
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
                  <Briefcase className="h-4 w-4" />
                  Asignación
                </h3>
                <div className="app-data-grid">
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

            {/* Columna derecha: Datos de la Póliza */}
            <div className="space-y-2">
              <div className="app-panel">
                <h3 className="app-section-title">
                  <Shield className="h-4 w-4" />
                  Datos de la Póliza
                </h3>
                <div className="space-y-2 text-[12px]">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <DataField label="N° Póliza" value={claim.policy_number} />
                    <DataField label="Item Póliza" value={claim.policy_item} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    <DataField label="Moneda" value={resolveName(claim.currency_id, currencyCatalog)} />
                    <DataField label="Monto Asegurado" value={claim.policy_amount?.toString() || "—"} />
                    <DataField label="Prima" value={claim.policy_premium?.toString() || "—"} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <DataField label="Inicio Vigencia" value={formatDate(claim.policy_start_date)} />
                    <DataField label="Término Vigencia" value={formatDate(claim.policy_end_date)} />
                  </div>
                </div>
              </div>
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
                <DataField label="Nombre" value={insured?.first_name || insured?.full_name || "—"} />
                <DataField label="Apellido" value={insured?.last_name || "—"} />
                <DataField label="RUT" value={insured?.rut || "—"} />
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
                  <DataField label="Nombre" value={contractor.first_name || contractor.full_name || "—"} />
                  <DataField label="Apellido" value={contractor.last_name || "—"} />
                  <DataField label="RUT" value={contractor.rut || "—"} />
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
                  <DataField label="Nombre" value={beneficiary.first_name || beneficiary.full_name || "—"} />
                  <DataField label="Apellido" value={beneficiary.last_name || "—"} />
                  <DataField label="RUT" value={beneficiary.rut || "—"} />
                  <DataField label="Email" value={beneficiary.email || "—"} />
                  <DataField label="Teléfono" value={uniquePhones(beneficiary.phone, beneficiary.cell_phone) || "—"} />
                  <DataField label="Dirección" value={beneficiary.address || "—"} />
                  <DataField label="Ciudad" value={beneficiary.city || "—"} />
                  <DataField label="Comuna" value={beneficiary.commune || "—"} />
                </div>
              </div>
            )}

            {/* Persona de Contacto */}
            {contact && (
              <div className="app-panel">
                <h3 className="app-section-title">Persona de Contacto</h3>
                <div className="app-data-grid-4">
                  <DataField label="Nombre" value={contact.full_name} />
                  <DataField label="Email" value={contact.email || "—"} />
                  <DataField label="Teléfono" value={uniquePhones(contact.phone, contact.cell_phone) || "—"} />
                </div>
              </div>
            )}

            {!insured && !contractor && !beneficiary && !contact && (
              <div className="app-panel text-center py-10">
                <p className="text-muted-foreground text-[13px]">No hay participantes registrados.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: INCIDENTE ═══ */}
        {activeTab === "incidente" && (
          <div className="space-y-2">
            {/* Incidente */}
            <div className="app-panel">
              <h3 className="app-section-title">
                <FileText className="h-4 w-4" />
                Incidente
              </h3>
              <div className="app-data-grid">
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

            {/* Dirección del Siniestro */}
            <div className="app-panel">
              <h3 className="app-section-title">
                <MapPin className="h-4 w-4" />
                Dirección del Siniestro
              </h3>
              <div className="app-data-grid">
                <div className="col-span-full">
                  <DataField label="Dirección" value={claim.claim_address || "—"} />
                </div>
                <DataField label="País" value={countryName?.name || "—"} />
                <DataField label="Región" value={regionName?.name || "—"} />
                <DataField label="Ciudad" value={cityName?.name || "—"} />
                <DataField label="Comuna" value={communeName?.name || "—"} />
              </div>
            </div>

            {/* Recupero */}
            <div className="app-panel">
              <h3 className="app-section-title">
                <Briefcase className="h-4 w-4" />
                Recupero
              </h3>
              <div className="app-data-grid">
                <DataField label="Recupero Legal" value={claim.recovery_type_legal ? "Sí" : "No"} />
                <DataField label="Recupero Material" value={claim.recovery_type_material ? "Sí" : "No"} />
                <DataField label="Comentarios" value={claim.recovery_comments || "—"} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: DOCUMENTOS ═══ */}
        {activeTab === "documentos" && (
          <div className="app-panel">
            <h3 className="app-section-title">
              <FolderOpen className="h-4 w-4" />
              Documentos de Soporte
            </h3>
            <div className="border rounded-xl border-dashed p-10 text-center">
              <p className="text-muted-foreground text-[13px]">Arrastra archivo(s) o haz clic para seleccionarlos.</p>
              <p className="text-muted-foreground text-xs mt-1">Acepta archivos PDF, Word y Excel de hasta 10 MB.</p>
            </div>
            <div className="app-data-table-wrap mt-4">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th>Nombre de documento</th>
                    <th>Tipo de documento</th>
                    <th>Nombre de archivo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground py-6">No hay documentos cargados.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: GESTIONES ═══ */}
        {activeTab === "gestiones" && (
          <div className="app-panel">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Gestiones del Siniestro
              </h3>
            </div>
            {(() => {
              // Inspecciones (sesiones)
              const inspections = (claim.inspection_sessions || []).map((s) => ({
                id: s.id,
                tipo: "Inspección",
                referencia: s.inspection_number || "—",
                estado: s.status,
                detalle: s.inspection_type === "remote" ? "Remota" : "Presencial",
                fecha: s.scheduled_at || s.started_at || s.created_at,
                href: `/dashboard/inspecciones/${s.id}`,
                esAccion: false,
              }));

              // Acciones (claim_actions)
              const actions = (claimActions || []).map((a) => ({
                id: a.id,
                tipo: a.action_feature?.name || a.name || "Acción",
                referencia: a.code || "—",
                estado: a.action_status?.code || "todo",
                detalle: a.description || a.name || "—",
                fecha: a.issued_on || a.created_on,
                href: null as string | null,
                esAccion: true,
              }));

              const gestiones = [...inspections, ...actions].sort((a, b) => {
                const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
                const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
                return fb - fa;
              });

              const statusLabels: Record<string, string> = {
                scheduled: "Agendada", active: "En curso", completed: "Completada",
                cancelled: "Cancelada", signed: "Firmada",
                todo: "Pendiente", issued: "Emitida", reviewed: "Revisada",
                approved: "Aprobada", dispatched: "Despachada", rejected: "Rechazada",
              };
              const statusColors: Record<string, string> = {
                scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
                completed: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
                signed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
                todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                issued: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                reviewed: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
                approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
                dispatched: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
                rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
              };

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
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Detalle</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th className="w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gestiones.map((g) => (
                        <tr
                          key={g.id}
                          className={g.href ? "cursor-pointer hover:bg-muted/40" : ""}
                          onClick={() => g.href && router.push(g.href)}
                        >
                          <td className="font-medium">{g.tipo}</td>
                          <td className="font-mono text-primary">{g.referencia}</td>
                          <td className="max-w-[250px] truncate text-muted-foreground">{g.detalle}</td>
                          <td><Badge className={statusColors[g.estado] || ""}>{statusLabels[g.estado] || g.estado}</Badge></td>
                          <td>{g.fecha ? formatDateTime(g.fecha) : "—"}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {g.esAccion
                              ? <ClipboardList className="h-4 w-4 text-muted-foreground" />
                              : <ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
                          </td>
                        </tr>
                      ))}
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
    </div>
  );
}

function DataField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="app-data-field">
      <span className="app-data-label">{label}</span>
      <p className="app-data-value">{value || "—"}</p>
    </div>
  );
}


