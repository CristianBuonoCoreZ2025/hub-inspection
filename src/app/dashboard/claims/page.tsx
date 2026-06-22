"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, getClaimsParticipants, createClaimMinimal, deleteClaim } from "@/services/claims";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBrokers, getAdvisors, getRegions, getCities, getCommunes } from "@/services/catalogs";
import { getCountries } from "@/services/countries";
import { claimCreateMinimalSchema, type ClaimCreateMinimalInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ClaimStatus, Profile } from "@/types";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full mt-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {children}
      </h3>
      <div className="h-px bg-border/40 mb-2" />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

function getParticipant(claim: { claims_participants?: { type: string; full_name: string | null; first_name: string | null; last_name: string | null; address: string | null; city: string | null; rut: string | null; email: string | null; phone: string | null; cell_phone: string | null; commune: string | null; region: string | null; country: string | null }[] }, type: string) {
  return claim.claims_participants?.find((p) => p.type === type);
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

  const form = useForm<ClaimCreateMinimalInput>({
    resolver: standardSchemaResolver(claimCreateMinimalSchema),
    defaultValues: {
      claimNumber: "",
      policyNumber: "",
      claimDate: "",
      insuranceCompanyId: "",
      claimTypeId: "",
      claimCauseId: "",
      summary: "",
      liquidationNumber: "",
      companyReportNumber: "",
      inspectorId: "",
      adjusterId: "",
      companyId: "",
      insuredName: "",
      lastName: "",
      rut: "",
      insuredEmail: "",
      cellPhone: "",
      insuredPhone: "",
      address: "",
      country: "Chile",
      region: "",
      city: "",
      commune: "",
      contractorName: "",
      contractorLastName: "",
      contractorRut: "",
      contractorEmail: "",
      contractorCellPhone: "",
      contractorAddress: "",
      contractorCountry: "Chile",
      contractorRegion: "",
      contractorCity: "",
      contractorCommune: "",
      beneficiaryName: "",
      beneficiaryLastName: "",
      beneficiaryRut: "",
      beneficiaryEmail: "",
      beneficiaryCellPhone: "",
      beneficiaryAddress: "",
      beneficiaryCountry: "Chile",
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

  const selectedCompanyId = form.watch("companyId");
  const selectedCountry = form.watch("country");
  const selectedRegion = form.watch("region");
  const selectedCity = form.watch("city");

  const inspectors = users?.filter((u) => u.role === "inspector" && (!selectedCompanyId || u.company_id === selectedCompanyId)).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const adjusters = users?.filter((u) => u.role === "adjuster" && (!selectedCompanyId || u.company_id === selectedCompanyId)).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

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

  const { data: brokersCatalog } = useQuery({
    queryKey: ["brokers"],
    queryFn: () => getBrokers(),
  });

  const { data: advisorsCatalog } = useQuery({
    queryKey: ["advisors"],
    queryFn: () => getAdvisors(),
  });

  const { data: countriesCatalog } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const { data: regionsCatalog } = useQuery({
    queryKey: ["regions", selectedCountry],
    queryFn: () => {
      const country = countriesCatalog?.find(c => c.name === selectedCountry);
      return getRegions(country?.id);
    },
    enabled: !!selectedCountry && !!countriesCatalog,
  });

  const { data: citiesCatalog } = useQuery({
    queryKey: ["cities", selectedRegion],
    queryFn: () => {
      const region = regionsCatalog?.find(r => r.name === selectedRegion);
      return getCities(region?.id);
    },
    enabled: !!selectedRegion && !!regionsCatalog,
  });

  const { data: communesCatalog } = useQuery({
    queryKey: ["communes", selectedCity],
    queryFn: () => {
      const city = citiesCatalog?.find(c => c.name === selectedCity);
      return getCommunes(city?.id);
    },
    enabled: !!selectedCity && !!citiesCatalog,
  });

  const createMutation = useMutation({
    mutationFn: (values: ClaimCreateMinimalInput) =>
      createClaimMinimal(
        {
          claimNumber: values.claimNumber,
          policyNumber: values.policyNumber,
          claimDate: values.claimDate,
          summary: values.summary,
          inspectorId: values.inspectorId,
          adjusterId: values.adjusterId,
          insuranceCompanyId: values.insuranceCompanyId,
          claimTypeId: values.claimTypeId,
          claimCauseId: values.claimCauseId,
          liquidationNumber: values.liquidationNumber,
          companyReportNumber: values.companyReportNumber,
          company_id: values.companyId,
        },
        {
          insuredName: values.insuredName,
          lastName: values.lastName,
          rut: values.rut,
          insuredEmail: values.insuredEmail,
          insuredPhone: values.insuredPhone,
          cellPhone: values.cellPhone,
          address: values.address,
          country: values.country,
          region: values.region,
          city: values.city,
          commune: values.commune,
        }
      ),
    onSuccess: () => {
      toast.success("Siniestro creado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      form.reset();
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
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `siniestros_${new Date().toISOString().slice(0,10)}.csv`;
              link.click();
            }}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Exportar CSV
          </Button>
          <Button onClick={() => { form.reset(); setStep(1); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Siniestro
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-lg" showCloseButton={false}>
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
            {/* Wizard steps */}
            <div className="flex items-center gap-0 mb-5 border-b pb-3">
              {wizardSteps.map((s, idx) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      step > s.id ? "bg-emerald-500 text-white" :
                      step === s.id ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <span className={`text-[11px] font-medium ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  </div>
                  {idx < wizardSteps.length - 1 && (
                    <div className={`h-px flex-1 mx-2 transition-colors ${step > s.id ? "bg-emerald-400" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* PASO 1: DETALLES SINIESTRO */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="app-field-label">Empresa (Cliente) <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("companyId", v || "")} value={form.watch("companyId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Selecciona una empresa" /></SelectTrigger>
                      <SelectContent>
                        {companies?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FieldError message={form.formState.errors.companyId?.message} />
                  </div>
                </div>

                <SectionTitle>Datos del Siniestro</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">N° Siniestro (Compañía) <span className="text-red-500">*</span></Label>
                    <Input {...form.register("claimNumber")} placeholder="Ej: 12345678" className="app-input h-8" />
                    <FieldError message={form.formState.errors.claimNumber?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">N° Póliza <span className="text-red-500">*</span></Label>
                    <Input {...form.register("policyNumber")} placeholder="Ej: POL-2026-001" className="app-input h-8" />
                    <FieldError message={form.formState.errors.policyNumber?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">N° Liquidación / Interno</Label>
                    <Input {...form.register("liquidationNumber")} placeholder="Ej: L-0000123" className="app-input h-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">N° Informe Compañía</Label>
                    <Input {...form.register("companyReportNumber")} placeholder="Ej: INF-2026-001" className="app-input h-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Compañía de Seguros</Label>
                    <Select onValueChange={(v) => form.setValue("insuranceCompanyId", v || "")} value={form.watch("insuranceCompanyId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar compañía..." /></SelectTrigger>
                      <SelectContent>
                        {insuranceCompaniesCatalog?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Fecha Siniestro <span className="text-red-500">*</span></Label>
                    <Input {...form.register("claimDate")} type="date" className="app-input h-7 px-2 text-xs" />
                    <FieldError message={form.formState.errors.claimDate?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Tipo de Siniestro <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("claimTypeId", v || "")} value={form.watch("claimTypeId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                      <SelectContent>
                        {claimTypes?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FieldError message={form.formState.errors.claimTypeId?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Causal del Siniestro</Label>
                    <Select onValueChange={(v) => form.setValue("claimCauseId", v || "")} value={form.watch("claimCauseId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar causal..." /></SelectTrigger>
                      <SelectContent>
                        {claimCauses?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="app-field-label">Resumen</Label>
                    <textarea {...form.register("summary")} rows={2} className="app-input resize-none" placeholder="Descripción breve del siniestro..." />
                  </div>
                </div>

                <SectionTitle>Asignación</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="app-field-label">Inspector</Label>
                    <Select onValueChange={(v) => form.setValue("inspectorId", v || "")} value={form.watch("inspectorId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar inspector..." /></SelectTrigger>
                      <SelectContent>
                        {inspectors?.map((u) => (<SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="app-field-label">Liquidador</Label>
                    <Select onValueChange={(v) => form.setValue("adjusterId", v || "")} value={form.watch("adjusterId") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar liquidador..." /></SelectTrigger>
                      <SelectContent>
                        {adjusters?.map((u) => (<SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: DETALLES INCIDENTE */}
            {step === 2 && (
              <div className="space-y-4">
                <SectionTitle>Asegurado</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                    <Input {...form.register("insuredName")} placeholder="Cristian" className="app-input h-8" />
                    <FieldError message={form.formState.errors.insuredName?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Apellido</Label>
                    <Input {...form.register("lastName")} placeholder="Zárate" className="app-input h-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">RUT</Label>
                    <Input {...form.register("rut")} placeholder="14185994k" className="app-input h-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Celular <span className="text-red-500">*</span></Label>
                    <Input {...form.register("cellPhone")} placeholder="9 9999 9999" className="app-input h-8" />
                    <FieldError message={form.formState.errors.cellPhone?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Email</Label>
                    <Input {...form.register("insuredEmail")} type="email" placeholder="asegurado@email.com" className="app-input h-8" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Teléfono</Label>
                    <Input {...form.register("insuredPhone")} placeholder="X XXXX XXXX" className="app-input h-8" />
                  </div>
                </div>

                <SectionTitle>Ubicación del Siniestro</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 col-span-full">
                    <Label className="app-field-label">Dirección <span className="text-red-500">*</span></Label>
                    <Input {...form.register("address")} placeholder="Av. Ricardo Lyon 1351" className="app-input h-8" />
                    <FieldError message={form.formState.errors.address?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">País</Label>
                    <Select onValueChange={(v) => { form.setValue("country", v || ""); form.setValue("region", ""); form.setValue("city", ""); form.setValue("commune", ""); }} value={form.watch("country") || undefined}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar país..." /></SelectTrigger>
                      <SelectContent>
                        {countriesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Región</Label>
                    <Select onValueChange={(v) => { form.setValue("region", v || ""); form.setValue("city", ""); form.setValue("commune", ""); }} value={form.watch("region") || undefined} disabled={!selectedCountry}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar región..." /></SelectTrigger>
                      <SelectContent>
                        {regionsCatalog?.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Ciudad <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => { form.setValue("city", v || ""); form.setValue("commune", ""); }} value={form.watch("city") || undefined} disabled={!selectedRegion}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar ciudad..." /></SelectTrigger>
                      <SelectContent>
                        {citiesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError message={form.formState.errors.city?.message} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="app-field-label">Comuna</Label>
                    <Select onValueChange={(v) => form.setValue("commune", v || "")} value={form.watch("commune") || undefined} disabled={!selectedCity}>
                      <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar comuna..." /></SelectTrigger>
                      <SelectContent>
                        {communesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 3: DOCUMENTOS SOPORTE */}
            {step === 3 && (
              <div className="space-y-4">
                <SectionTitle>Documentos Soporte</SectionTitle>
                <div className="border rounded-xl border-dashed p-10 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-[13px]">Arrastra archivo(s) o haz clic para seleccionarlos</p>
                  <p className="text-muted-foreground text-xs mt-1">Acepta archivos PDF, Word y Excel de hasta 10 MB</p>
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Nombre de documento</th>
                      <th className="text-left py-2 px-3">Tipo de documento</th>
                      <th className="text-left py-2 px-3">Nombre de archivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={3} className="text-center text-muted-foreground py-6">No hay documentos cargados.</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
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
                type="button"
                className="btn-save"
                disabled={createMutation.isPending}
                onClick={form.handleSubmit(onSubmit)}
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
