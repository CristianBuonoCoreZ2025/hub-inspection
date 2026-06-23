"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, getClaimsParticipants, createClaimMinimal, deleteClaim } from "@/services/claims";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import {
  getClaimCauses,
  getClaimTypes,
  getInsuranceCompanies,
  getBrokers,
  getAdvisors,
  getBusinessLines,
  getInsuranceProducts,
  getRegions,
  getCities,
  getCommunes,
  getCountries,
  getHousingDestinations,
  getPropertyClassifications,
  getDamageClassifications,
  getLookupCatalog,
  getEvents,
} from "@/services/catalogs";
import { claimCreateMinimalSchema, type ClaimCreateMinimalInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, FileText, ClipboardCheck, Download, X, Check, Upload } from "lucide-react";
import { createInspectionSession } from "@/services/inspections";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SelectItem } from "@/components/ui/select";
import { FormSelect } from "@/components/ui/form-select";
import { cn } from "@/lib/utils";

import type { ClaimStatus } from "@/types";

const statusLabels: Record<ClaimStatus, string> = {
  created: "Creado",
  scheduled: "Agendado",
  in_progress: "En progreso",
  pending_info: "Pendiente info",
  in_review: "En revisión",
  signed: "Firmado",
  closed: "Cerrado",
};

const statusColors: Record<ClaimStatus, string> = {
  created: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  pending_info: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  in_review: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  signed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

type Participant = { type: string; full_name?: string | null; first_name?: string | null; last_name?: string | null; rut?: string | null; email?: string | null; phone?: string | null; cell_phone?: string | null; address?: string | null; country?: string | null; region?: string | null; city?: string | null; commune?: string | null };

function getParticipant(claim: { claims_participants?: Participant[] }, type: string) {
  return claim.claims_participants?.find((p) => p.type === type);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[10px] text-red-500 leading-tight">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h3>
    </div>
  );
}

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "created", label: "Creado" },
  { value: "scheduled", label: "Programado" },
  { value: "in_progress", label: "En Progreso" },
  { value: "pending_info", label: "Pendiente Info" },
  { value: "in_review", label: "En Revisión" },
  { value: "signed", label: "Firmado" },
  { value: "closed", label: "Cerrado" },
];

const wizardSteps = [
  { id: 1, label: "Detalles Siniestro", description: "Ingresa los detalles sobre el reclamo." },
  { id: 2, label: "Detalles Incidente", description: "Ingresa detalles sobre lo que sucedió." },
  { id: 3, label: "Documentos Soporte", description: "Cargue los documentos necesarios." },
];

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [documents, setDocuments] = useState<{ id: string; name: string; type: string; file: File }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  type DocumentRow = { id: string; name: string; type: string; file: File };

  const form = useForm<ClaimCreateMinimalInput>({
    resolver: standardSchemaResolver(claimCreateMinimalSchema),
    defaultValues: {
      companyId: "",
      insuranceCompanyId: "",
      claimNumber: "",
      policyNumber: "",
      clientReference: "",
      claimDate: "",
      assignmentDate: "",
      reportDate: "",
      businessLineId: "",
      insuranceProductId: "",
      eventId: "",
      claimTypeId: "",
      advisorId: "",
      brokerId: "",
      inspectorId: "",
      adjusterId: "",
      claimCauseId: "",
      summary: "",
      constructionTypeId: "",
      habitabilityId: "",
      destinationHousingId: "",
      propertyClassificationId: "",
      ownerSameAsInsured: false,
      damageClassificationId: "",
      insuredName: "",
      lastName: "",
      rut: "",
      insuredEmail: "",
      cellPhone: "",
      insuredPhone: "",
      claimAddress: "",
      claimCountry: "Chile",
      claimRegion: "",
      claimCity: "",
      claimCommune: "",
      contractorName: "",
      contractorLastName: "",
      contractorRut: "",
      contractorEmail: "",
      contractorCellPhone: "",
      contractorAddress: "",
      contractorCountry: "",
      contractorRegion: "",
      contractorCity: "",
      contractorCommune: "",
      beneficiaryName: "",
      beneficiaryLastName: "",
      beneficiaryRut: "",
      beneficiaryEmail: "",
      beneficiaryCellPhone: "",
      beneficiaryAddress: "",
      beneficiaryCountry: "",
      beneficiaryRegion: "",
      beneficiaryCity: "",
      beneficiaryCommune: "",
    },
  });

  const { data: rawClaims, isLoading, error } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
  });

  if (error) {
    toast.error(`Error cargando siniestros: ${(error as Error).message}`);
  }

  const claimIds = rawClaims?.map((c) => c.id) ?? [];
  const { data: participants } = useQuery({
    queryKey: ["claims-participants", claimIds],
    queryFn: () => getClaimsParticipants(claimIds),
    enabled: claimIds.length > 0,
  });

  const claims = rawClaims?.map((claim) => ({
    ...claim,
    claims_participants: participants?.filter((p) => p.claim_id === claim.id) ?? [],
  }));

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const selectedCompanyId = useWatch({ control: form.control, name: "companyId" });
  const selectedClaimCountry = useWatch({ control: form.control, name: "claimCountry" });
  const selectedClaimRegion = useWatch({ control: form.control, name: "claimRegion" });
  const selectedClaimCity = useWatch({ control: form.control, name: "claimCity" });

  const inspectors = users
    ?.filter((u) => u.role === "inspector" && (!selectedCompanyId || u.company_id === selectedCompanyId))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const adjusters = users
    ?.filter((u) => u.role === "adjuster" && (!selectedCompanyId || u.company_id === selectedCompanyId))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  const { data: claimCauses } = useQuery({
    queryKey: ["claim-causes"],
    queryFn: () => getClaimCauses(),
  });

  const { data: claimTypes } = useQuery({
    queryKey: ["claim-types"],
    queryFn: () => getClaimTypes(),
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

  const { data: eventsCatalog } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const { data: habitabilityCatalog } = useQuery({
    queryKey: ["lookup-catalog", "habitability"],
    queryFn: () => getLookupCatalog("habitability"),
  });

  const { data: documentTypesCatalog } = useQuery({
    queryKey: ["lookup-catalog", "document_type"],
    queryFn: () => getLookupCatalog("document_type"),
  });

  const { data: countriesCatalog } = useQuery({
    queryKey: ["countries"],
    queryFn: () => getCountries(),
  });

  const { data: regionsCatalog } = useQuery({
    queryKey: ["regions", selectedClaimCountry],
    queryFn: () => {
      const country = countriesCatalog?.find((c) => c.name === selectedClaimCountry);
      return getRegions(country?.id);
    },
    enabled: !!selectedClaimCountry && !!countriesCatalog,
  });

  const { data: citiesCatalog } = useQuery({
    queryKey: ["cities", selectedClaimRegion],
    queryFn: () => {
      const region = regionsCatalog?.find((r) => r.name === selectedClaimRegion);
      return getCities(region?.id);
    },
    enabled: !!selectedClaimRegion && !!regionsCatalog,
  });

  const { data: communesCatalog } = useQuery({
    queryKey: ["communes", selectedClaimCity],
    queryFn: () => {
      const city = citiesCatalog?.find((c) => c.name === selectedClaimCity);
      return getCommunes(city?.id);
    },
    enabled: !!selectedClaimCity && !!citiesCatalog,
  });

  const selectedBusinessLineId = useWatch({ control: form.control, name: "businessLineId" });
  const filteredInsuranceProducts = insuranceProductsCatalog?.filter(
    (p) => !selectedBusinessLineId || p.business_line_id === selectedBusinessLineId
  );

  const createMutation = useMutation({
    mutationFn: (values: ClaimCreateMinimalInput) =>
      createClaimMinimal(
        {
          claimNumber: values.claimNumber,
          policyNumber: values.policyNumber,
          claimDate: values.claimDate,
          clientReference: values.clientReference || null,
          assignmentDate: values.assignmentDate || null,
          reportDate: values.reportDate || null,
          summary: values.summary,
          inspectorId: values.inspectorId,
          adjusterId: values.adjusterId || null,
          insuranceCompanyId: values.insuranceCompanyId,
          claimTypeId: values.claimTypeId,
          claimCauseId: values.claimCauseId || null,
          businessLineId: values.businessLineId || null,
          insuranceProductId: values.insuranceProductId || null,
          advisorId: values.advisorId || null,
          brokerId: values.brokerId || null,
          eventId: values.eventId || null,
          constructionTypeId: values.constructionTypeId || null,
          habitabilityId: values.habitabilityId || null,
          destinationHousingId: values.destinationHousingId || null,
          damageClassificationId: values.damageClassificationId || null,
          propertyClassificationId: values.propertyClassificationId || null,
          ownerSameAsInsured: values.ownerSameAsInsured,
          company_id: values.companyId,
        },
        {
          insuredName: values.insuredName,
          lastName: values.lastName || null,
          rut: values.rut || null,
          insuredEmail: values.insuredEmail || null,
          insuredPhone: values.insuredPhone || null,
          cellPhone: values.cellPhone,
        },
        {
          claimAddress: values.claimAddress,
          claimCountry: values.claimCountry,
          claimRegion: values.claimRegion || null,
          claimCity: values.claimCity,
          claimCommune: values.claimCommune || null,
        },
        values.contractorName
          ? {
              contractorName: values.contractorName,
              contractorLastName: values.contractorLastName || null,
              contractorRut: values.contractorRut || null,
              contractorEmail: values.contractorEmail || null,
              contractorCellPhone: values.contractorCellPhone || null,
              contractorAddress: values.contractorAddress || null,
              contractorCountry: values.contractorCountry || null,
              contractorRegion: values.contractorRegion || null,
              contractorCity: values.contractorCity || null,
              contractorCommune: values.contractorCommune || null,
            }
          : null,
        values.beneficiaryName
          ? {
              beneficiaryName: values.beneficiaryName,
              beneficiaryLastName: values.beneficiaryLastName || null,
              beneficiaryRut: values.beneficiaryRut || null,
              beneficiaryEmail: values.beneficiaryEmail || null,
              beneficiaryCellPhone: values.beneficiaryCellPhone || null,
              beneficiaryAddress: values.beneficiaryAddress || null,
              beneficiaryCountry: values.beneficiaryCountry || null,
              beneficiaryRegion: values.beneficiaryRegion || null,
              beneficiaryCity: values.beneficiaryCity || null,
              beneficiaryCommune: values.beneficiaryCommune || null,
            }
          : null
      ),
    onSuccess: () => {
      toast.success("Siniestro creado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      form.reset();
      setDocuments([]);
      setStep(1);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaim,
    onSuccess: () => {
      toast.success("Siniestro eliminado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inspectMutation = useMutation({
    mutationFn: createInspectionSession,
    onSuccess: (data) => {
      toast.success("Inspeccion creada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      router.push(`/dashboard/inspecciones/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: ClaimCreateMinimalInput) => {
    createMutation.mutate(values);
  };

  const copyInsuredToContractor = () => {
    form.setValue("contractorName", form.getValues("insuredName") || "");
    form.setValue("contractorLastName", form.getValues("lastName") || "");
    form.setValue("contractorRut", form.getValues("rut") || "");
    form.setValue("contractorEmail", form.getValues("insuredEmail") || "");
    form.setValue("contractorCellPhone", form.getValues("cellPhone") || "");
    form.setValue("contractorAddress", form.getValues("claimAddress") || "");
    form.setValue("contractorCountry", form.getValues("claimCountry") || "");
    form.setValue("contractorRegion", form.getValues("claimRegion") || "");
    form.setValue("contractorCity", form.getValues("claimCity") || "");
    form.setValue("contractorCommune", form.getValues("claimCommune") || "");
  };

  const copyInsuredToBeneficiary = () => {
    form.setValue("beneficiaryName", form.getValues("insuredName") || "");
    form.setValue("beneficiaryLastName", form.getValues("lastName") || "");
    form.setValue("beneficiaryRut", form.getValues("rut") || "");
    form.setValue("beneficiaryEmail", form.getValues("insuredEmail") || "");
    form.setValue("beneficiaryCellPhone", form.getValues("cellPhone") || "");
    form.setValue("beneficiaryAddress", form.getValues("claimAddress") || "");
    form.setValue("beneficiaryCountry", form.getValues("claimCountry") || "");
    form.setValue("beneficiaryRegion", form.getValues("claimRegion") || "");
    form.setValue("beneficiaryCity", form.getValues("claimCity") || "");
    form.setValue("beneficiaryCommune", form.getValues("claimCommune") || "");
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).slice(2),
      name: file.name.replace(/\.[^/.]+$/, ""),
      type: "",
      file,
    }));
    setDocuments((prev) => [...prev, ...newFiles]);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDocument = (id: string, updates: Partial<DocumentRow>) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const filtered = claims?.filter((c) => {
    const textMatch = [c.claim_number, c.liquidation_number, getParticipant(c, 'insured')?.full_name, getParticipant(c, 'insured')?.address].join(" ").toLowerCase().includes(search.toLowerCase());
    const statusMatch = !statusFilter || c.status === statusFilter;
    const dateMatch = (!dateFrom || (c.claim_date && c.claim_date >= dateFrom)) && (!dateTo || (c.claim_date && c.claim_date <= dateTo));
    return textMatch && statusMatch && dateMatch;
  });

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Siniestros</h1>
        <p className="app-page-lead">Gestión de siniestros y seguimiento de casos.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar siniestro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full max-w-[200px] text-[13px]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[130px] text-[13px]"
            placeholder="Desde"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[130px] text-[13px]"
            placeholder="Hasta"
          />
          {(statusFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[13px]"
            onClick={() => {
              const rows = filtered || [];
              const csv = [
                ["N° Ref McLarens","N° Liquidación","N° Siniestro Cía","Asegurado","Dirección","Ciudad","Estado","Fecha"].join(","),
                ...rows.map((c) => [
                  c.claim_number, c.liquidation_number || "", c.company_report_number || "", getParticipant(c, 'insured')?.full_name || "",
                  `"${getParticipant(c, 'insured')?.address || ""}"`, getParticipant(c, 'insured')?.city || "", c.status, c.claim_date || ""
                ].join(",")),
              ].join("\\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `siniestros_${new Date().toISOString().slice(0,10)}.csv`;
              link.click();
            }}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <Button onClick={() => { form.reset(); setDocuments([]); setStep(1); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Siniestro
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        modal="trap-focus"
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            form.reset();
            setStep(1);
            setDocuments([]);
          }
        }}
      >
        <DialogContent className="modal-lg" showCloseButton={true}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <FileText className="h-4 w-4" />
              </div>
              Crear Siniestro
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              Completa los datos para crear el siniestro e iniciar una inspección remota.
            </DialogDescription>
          </div>

          <div className="modal-body">
            <form autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} id="claim-wizard-form">
            {/* Wizard steps */}
            <div className="flex items-center gap-1 mb-4 border-b pb-3">
              {wizardSteps.map((s, idx) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-0.5 flex-1">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                        step > s.id ? "bg-emerald-500 text-white" : step === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                    </div>
                    <span className={cn("text-[10px] font-medium", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </div>
                  {idx < wizardSteps.length - 1 && (
                    <div
                      className={cn(
                        "h-px flex-1 mx-1 transition-colors",
                        step > s.id ? "bg-emerald-400" : "bg-border"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* PASO 1: DETALLES SINIESTRO */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Empresa (Cliente) <span className="text-red-500">*</span>
                    </Label>
                    <FormSelect
                      control={form.control}
                      name="companyId"
                      placeholder="Selecciona una empresa"
                      className="app-input h-7"
                    >
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <FieldError message={form.formState.errors.companyId?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Compañía de Seguros <span className="text-red-500">*</span>
                    </Label>
                    <FormSelect
                      control={form.control}
                      name="insuranceCompanyId"
                      placeholder="Seleccionar compañía..."
                      className="app-input h-7"
                    >
                      {insuranceCompaniesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <FieldError message={form.formState.errors.insuranceCompanyId?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      N° Siniestro (Compañía) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("claimNumber")}
                      placeholder="Ej: 12345678"
                      className="app-input h-7"
                    />
                    <FieldError message={form.formState.errors.claimNumber?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      N° Póliza <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("policyNumber")}
                      placeholder="Ej: POL-2026-001"
                      className="app-input h-7"
                    />
                    <FieldError message={form.formState.errors.policyNumber?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">N° Interno Cliente</Label>
                    <Input
                      readOnly
                      placeholder="MCL-XXXX"
                      className="app-input h-7 bg-muted/50"
                      value=""
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Fecha Siniestro <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("claimDate")}
                      type="date"
                      className="app-input h-7 px-2 text-xs"
                    />
                    <FieldError message={form.formState.errors.claimDate?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha Asignación</Label>
                    <Input
                      {...form.register("assignmentDate")}
                      type="date"
                      className="app-input h-7 px-2 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha Denuncio</Label>
                    <Input
                      {...form.register("reportDate")}
                      type="date"
                      className="app-input h-7 px-2 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Línea de Negocios</Label>
                    <FormSelect
                      control={form.control}
                      name="businessLineId"
                      placeholder="Seleccionar línea..."
                      className="app-input h-7"
                      onValueChange={() => form.setValue("insuranceProductId", "")}
                    >
                      {businessLinesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ramo/Producto</Label>
                    <FormSelect
                      control={form.control}
                      name="insuranceProductId"
                      placeholder="Seleccionar producto..."
                      className="app-input h-7"
                      disabled={!selectedBusinessLineId}
                    >
                      {filteredInsuranceProducts?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Evento</Label>
                    <FormSelect
                      control={form.control}
                      name="eventId"
                      placeholder="Seleccionar evento..."
                      className="app-input h-7"
                    >
                      {eventsCatalog?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Tipo de Siniestro <span className="text-red-500">*</span>
                    </Label>
                    <FormSelect
                      control={form.control}
                      name="claimTypeId"
                      placeholder="Seleccionar tipo..."
                      className="app-input h-7"
                    >
                      {claimTypes?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <FieldError message={form.formState.errors.claimTypeId?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Asesor</Label>
                    <FormSelect
                      control={form.control}
                      name="advisorId"
                      placeholder="Seleccionar asesor..."
                      className="app-input h-7"
                    >
                      {advisorsCatalog?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Corredor</Label>
                    <FormSelect
                      control={form.control}
                      name="brokerId"
                      placeholder="Seleccionar corredor..."
                      className="app-input h-7"
                    >
                      {brokersCatalog?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Inspector <span className="text-red-500">*</span>
                    </Label>
                    <FormSelect
                      control={form.control}
                      name="inspectorId"
                      placeholder="Seleccionar inspector..."
                      className="app-input h-7"
                    >
                      {inspectors?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <FieldError message={form.formState.errors.inspectorId?.message} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ajustador / Liquidador</Label>
                    <FormSelect
                      control={form.control}
                      name="adjusterId"
                      placeholder="Seleccionar ajustador..."
                      className="app-input h-7"
                    >
                      {adjusters?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: DETALLES INCIDENTE */}
            {step === 2 && (
              <div className="space-y-3">
                {/* Incidente */}
                <SectionTitle>Incidente</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Causal del Siniestro</Label>
                    <FormSelect
                      control={form.control}
                      name="claimCauseId"
                      placeholder="Seleccionar causal..."
                      className="app-input h-7"
                    >
                      {claimCauses?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo de Construcción</Label>
                    <FormSelect
                      control={form.control}
                      name="constructionTypeId"
                      placeholder="Seleccionar tipo..."
                      className="app-input h-7"
                    >
                      {constructionTypesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Habitabilidad</Label>
                    <FormSelect
                      control={form.control}
                      name="habitabilityId"
                      placeholder="Seleccionar habitabilidad..."
                      className="app-input h-7"
                    >
                      {habitabilityCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Destino</Label>
                    <FormSelect
                      control={form.control}
                      name="destinationHousingId"
                      placeholder="Seleccionar destino..."
                      className="app-input h-7"
                    >
                      {housingDestinationsCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Asegurado/Propietario</Label>
                    <FormSelect
                      control={form.control}
                      name="propertyClassificationId"
                      placeholder="Seleccionar clasificación..."
                      className="app-input h-7"
                    >
                      {propertyClassificationsCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Clasificación del Daño</Label>
                    <FormSelect
                      control={form.control}
                      name="damageClassificationId"
                      placeholder="Seleccionar clasificación..."
                      className="app-input h-7"
                    >
                      {damageClassificationsCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>

                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Resumen</Label>
                    <textarea
                      {...form.register("summary")}
                      rows={2}
                      className="app-input resize-none"
                      placeholder="Descripción breve del siniestro..."
                    />
                  </div>

                  <div className="col-span-full flex items-center gap-2">
                    <input
                      id="ownerSameAsInsured"
                      type="checkbox"
                      {...form.register("ownerSameAsInsured")}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="ownerSameAsInsured" className="text-[13px]">
                      Mismo asegurado es propietario
                    </Label>
                  </div>
                </div>

                {/* Asegurado */}
                <SectionTitle>Asegurado</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">RUT</Label>
                    <Input
                      {...form.register("rut")}
                      placeholder="14185994k"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("insuredName")}
                      placeholder="Cristian"
                      className="app-input h-7"
                    />
                    <FieldError message={form.formState.errors.insuredName?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Apellido</Label>
                    <Input
                      {...form.register("lastName")}
                      placeholder="Zárate"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                    <Input
                      {...form.register("insuredEmail")}
                      type="email"
                      placeholder="asegurado@email.com"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Celular <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("cellPhone")}
                      placeholder="9 9999 9999"
                      className="app-input h-7"
                    />
                    <FieldError message={form.formState.errors.cellPhone?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Teléfono</Label>
                    <Input
                      {...form.register("insuredPhone")}
                      placeholder="X XXXX XXXX"
                      className="app-input h-7"
                    />
                  </div>
                </div>

                {/* Dirección del Siniestro */}
                <SectionTitle>Dirección del Siniestro</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Dirección <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      {...form.register("claimAddress")}
                      placeholder="Av. Ricardo Lyon 1351"
                      className="app-input h-7"
                    />
                    <FieldError message={form.formState.errors.claimAddress?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">País</Label>
                    <FormSelect
                      control={form.control}
                      name="claimCountry"
                      placeholder="Seleccionar país..."
                      className="app-input h-7"
                      onValueChange={() => {
                        form.setValue("claimRegion", "");
                        form.setValue("claimCity", "");
                        form.setValue("claimCommune", "");
                      }}
                    >
                      {countriesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Región</Label>
                    <FormSelect
                      control={form.control}
                      name="claimRegion"
                      placeholder="Seleccionar región..."
                      className="app-input h-7"
                      disabled={!selectedClaimCountry}
                      onValueChange={() => {
                        form.setValue("claimCity", "");
                        form.setValue("claimCommune", "");
                      }}
                    >
                      {regionsCatalog?.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Ciudad <span className="text-red-500">*</span>
                    </Label>
                    <FormSelect
                      control={form.control}
                      name="claimCity"
                      placeholder="Seleccionar ciudad..."
                      className="app-input h-7"
                      disabled={!selectedClaimRegion}
                      onValueChange={() => form.setValue("claimCommune", "")}
                    >
                      {citiesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                    <FieldError message={form.formState.errors.claimCity?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Comuna</Label>
                    <FormSelect
                      control={form.control}
                      name="claimCommune"
                      placeholder="Seleccionar comuna..."
                      className="app-input h-7"
                      disabled={!selectedClaimCity}
                    >
                      {communesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                </div>

                {/* Contratante */}
                <SectionTitle>Contratante</SectionTitle>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={copyInsuredToContractor}
                  >
                    Copiar de Asegurado
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">RUT</Label>
                    <Input
                      {...form.register("contractorRut")}
                      placeholder="14185994k"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
                    <Input
                      {...form.register("contractorName")}
                      placeholder="Cristian"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Apellido</Label>
                    <Input
                      {...form.register("contractorLastName")}
                      placeholder="Zárate"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                    <Input
                      {...form.register("contractorEmail")}
                      type="email"
                      placeholder="contratante@email.com"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Celular</Label>
                    <Input
                      {...form.register("contractorCellPhone")}
                      placeholder="9 9999 9999"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dirección</Label>
                    <Input
                      {...form.register("contractorAddress")}
                      placeholder="Av. Ricardo Lyon 1351"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">País</Label>
                    <FormSelect
                      control={form.control}
                      name="contractorCountry"
                      placeholder="Seleccionar país..."
                      className="app-input h-7"
                    >
                      {countriesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Región</Label>
                    <FormSelect
                      control={form.control}
                      name="contractorRegion"
                      placeholder="Seleccionar región..."
                      className="app-input h-7"
                    >
                      {regionsCatalog?.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ciudad</Label>
                    <FormSelect
                      control={form.control}
                      name="contractorCity"
                      placeholder="Seleccionar ciudad..."
                      className="app-input h-7"
                    >
                      {citiesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Comuna</Label>
                    <FormSelect
                      control={form.control}
                      name="contractorCommune"
                      placeholder="Seleccionar comuna..."
                      className="app-input h-7"
                    >
                      {communesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                </div>

                {/* Beneficiario */}
                <SectionTitle>Beneficiario</SectionTitle>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={copyInsuredToBeneficiary}
                  >
                    Copiar de Asegurado
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">RUT</Label>
                    <Input
                      {...form.register("beneficiaryRut")}
                      placeholder="14185994k"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre</Label>
                    <Input
                      {...form.register("beneficiaryName")}
                      placeholder="Cristian"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Apellido</Label>
                    <Input
                      {...form.register("beneficiaryLastName")}
                      placeholder="Zárate"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                    <Input
                      {...form.register("beneficiaryEmail")}
                      type="email"
                      placeholder="beneficiario@email.com"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Celular</Label>
                    <Input
                      {...form.register("beneficiaryCellPhone")}
                      placeholder="9 9999 9999"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dirección</Label>
                    <Input
                      {...form.register("beneficiaryAddress")}
                      placeholder="Av. Ricardo Lyon 1351"
                      className="app-input h-7"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">País</Label>
                    <FormSelect
                      control={form.control}
                      name="beneficiaryCountry"
                      placeholder="Seleccionar país..."
                      className="app-input h-7"
                    >
                      {countriesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Región</Label>
                    <FormSelect
                      control={form.control}
                      name="beneficiaryRegion"
                      placeholder="Seleccionar región..."
                      className="app-input h-7"
                    >
                      {regionsCatalog?.map((r) => (
                        <SelectItem key={r.id} value={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ciudad</Label>
                    <FormSelect
                      control={form.control}
                      name="beneficiaryCity"
                      placeholder="Seleccionar ciudad..."
                      className="app-input h-7"
                    >
                      {citiesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Comuna</Label>
                    <FormSelect
                      control={form.control}
                      name="beneficiaryCommune"
                      placeholder="Seleccionar comuna..."
                      className="app-input h-7"
                    >
                      {communesCatalog?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: DOCUMENTOS SOPORTE */}
            {step === 3 && (
              <div className="space-y-3">
                <SectionTitle>Documentos Soporte</SectionTitle>
                <div
                  className={`border rounded-xl border-dashed p-10 text-center transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-[13px]">
                    Arrastra archivo(s) aquí o{" "}
                    <label className="cursor-pointer text-primary hover:underline">
                      haz clic para seleccionar
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                    </label>
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Acepta archivos PDF, Word y Excel de hasta 10 MB
                  </p>
                </div>

                <div className="app-data-table-wrap">
                  <table className="app-data-table">
                    <thead>
                      <tr>
                        <th className="text-left">Nombre de documento</th>
                        <th className="text-left">Tipo de documento</th>
                        <th className="text-left">Nombre de archivo</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-muted-foreground py-6">
                            No hay documentos cargados.
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id}>
                            <td>
                              <Input
                                value={doc.name}
                                onChange={(e) =>
                                  updateDocument(doc.id, { name: e.target.value })
                                }
                                className="h-8 text-[13px]"
                                placeholder="Nombre de documento"
                              />
                            </td>
                            <td>
                              <FormSelect
                                control={form.control}
                                name={`documentType-${doc.id}`}
                                placeholder="Tipo..."
                                className="h-8 text-[13px]"
                                onValueChange={(v) => updateDocument(doc.id, { type: v })}
                              >
                                {documentTypesCatalog?.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </FormSelect>
                            </td>
                            <td className="text-[13px] text-muted-foreground truncate max-w-[180px]">
                              {doc.file.name}
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="btn-danger btn-icon"
                                onClick={() => removeDocument(doc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </form>
        </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => {
                setOpen(false);
                form.reset();
                setStep(1);
                setDocuments([]);
              }}
            >
              Cancelar
            </button>
            {step > 1 && (
              <button type="button" className="btn-cancel" onClick={() => setStep(step - 1)}>
                Atrás
              </button>
            )}
            <div className="flex-1" />
            {step < 3 ? (
              <button type="button" className="btn-save" onClick={() => setStep(step + 1)}>
                Siguiente paso
              </button>
            ) : (
              <button
                type="submit"
                form="claim-wizard-form"
                className="btn-save"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creando..." : "Crear Siniestro"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="w-[120px]">N° Ref</th>
                <th className="w-[110px]">N° Liq</th>
                <th className="w-[110px]">N° Siniestro Cía</th>
                <th className="w-[180px]">Asegurado</th>
                <th>Dirección</th>
                <th className="w-[100px]">Estado</th>
                <th className="w-[90px]">Fecha</th>
                <th className="w-[160px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-4">No se encontraron siniestros.</td></tr>
              ) : (
                filtered?.map((claim) => (
                  <tr
                    key={claim.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/dashboard/claims/${claim.id}`)}
                  >
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {claim.claim_number}
                      </div>
                    </td>
                    <td>{claim.liquidation_number || "—"}</td>
                    <td>{claim.company_report_number || "—"}</td>
                    <td>{getParticipant(claim, 'insured')?.full_name || "—"}</td>
                    <td className="truncate">{getParticipant(claim, 'insured')?.address || "—"}, {getParticipant(claim, 'insured')?.city || "—"}</td>
                    <td><Badge className={statusColors[claim.status]}>{statusLabels[claim.status]}</Badge></td>
                    <td>{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-[#0095DA] hover:text-[#005BBB] hover:bg-[#0095DA]/10"
                          title="Crear inspeccion"
                          disabled={inspectMutation.isPending}
                          onClick={() => inspectMutation.mutate(claim.id)}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                          Inspeccionar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="btn-neutral btn-icon"
                          onClick={() => router.push(`/dashboard/claims/${claim.id}?edit=1`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Eliminar este siniestro?")) deleteMutation.mutate(claim.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
