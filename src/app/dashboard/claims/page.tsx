"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, getClaimsParticipants, createClaim, updateClaim, deleteClaim } from "@/services/claims";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import { getClaimCauses, getClaimTypes, getInsuranceCompanies, getBrokers, getAdvisors, getRegions, getCities, getCommunes } from "@/services/catalogs";
import { getCountries } from "@/services/countries";
import { claimSchema, type ClaimInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, FileText, ClipboardCheck, Download, X } from "lucide-react";
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

import type { ClaimStatus, Company, Profile } from "@/types";

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
    <div className="modal-field-full mt-3">
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



function UserSelect({
  label,
  name,
  users,
  form,
}: {
  label: string;
  name: keyof ClaimInput;
  users?: Profile[];
  form: UseFormReturn<ClaimInput>;
}) {
  return (
    <div className="modal-field">
      <Label className="app-field-label">{label}</Label>
      <Select onValueChange={(v) => form.setValue(name, v as string)} value={String(form.getValues(name) ?? "")}>
        <SelectTrigger className="app-input h-8">
          <SelectValue placeholder="Seleccionar..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— Sin asignar —</SelectItem>
          {users?.map((u: Profile) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("siniestro");
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setActiveTab("siniestro");
    }
    prevOpenRef.current = open;
  }, [open]);

  const form = useForm<ClaimInput>({
    resolver: standardSchemaResolver(claimSchema),
    defaultValues: {
      claimNumber: "", policyNumber: "", policyItem: "", liquidationNumber: "",
      insuranceCompany: "", clientReference: "", companyReportNumber: "",
      insuredName: "", lastName: "", rut: "",
      insuredEmail: "", insuredPhone: "", cellPhone: "",
      address: "", city: "", commune: "", region: "", country: "Chile",
      claimDate: "", claimTime: "", reportDate: "", assignmentDate: "",
      claimType: "", claimCause: "", summary: "",
      contactName: "", contactRole: "", contactEmail: "",
      assignedAdjusterId: "", inspectorId: "", adjusterId: "",
      brokerName: "", brokerNumber: "", advisor: "",
      companyId: "", notes: "",
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

  const inspectors = users?.filter((u) => u.role === "inspector").sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const adjusters = users?.filter((u) => u.role === "adjuster").sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

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

  const selectedCountry = form.watch("country");
  const selectedRegion = form.watch("region");
  const selectedCity = form.watch("city");

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
    mutationFn: createClaim,
    onSuccess: () => {
      toast.success("Siniestro creado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClaimInput> }) => updateClaim(id, data),
    onSuccess: () => {
      toast.success("Siniestro actualizado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      setEditingId(null);
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

  const onSubmit = (values: ClaimInput) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      createMutation.mutate({ ...values, company_id: values.companyId });
    }
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
          <Button onClick={() => { setEditingId(null); form.reset(); setActiveTab("siniestro"); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Siniestro
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* ── MODAL Siniestros — 720px (muchos campos) ── */}
        <DialogContent className="modal-lg" showCloseButton={false}>
            <div className="modal-header">
              <DialogTitle className="modal-title flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                  <FileText className="h-4 w-4" />
                </div>
                {editingId ? "Editar Siniestro" : "Nuevo Siniestro"}
              </DialogTitle>
              <DialogDescription className="modal-subtitle">
                Registra la información del siniestro proveniente del sistema de liquidación.
              </DialogDescription>
            </div>

            <div className="modal-body">
              {/* TABS */}
              <div className="flex gap-1 border-b mb-4 pb-1 sticky top-0 bg-background z-10">
                {[
                  { id: "siniestro", label: "Siniestro" },
                  { id: "asegurado", label: "Asegurado" },
                  { id: "ubicacion", label: "Ubicación" },
                  { id: "contacto", label: "Contacto" },
                  { id: "equipo", label: "Equipo" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                      activeTab === t.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "siniestro" && (<div key="tab-siniestro" className="space-y-4">
              {/* ═══ EMPRESA (MI CLIENTE) ═══ */}
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Empresa (Cliente) <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => form.setValue("companyId", v ?? "")} value={form.getValues("companyId")} disabled={editingId !== null}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Selecciona una empresa" /></SelectTrigger>
                    <SelectContent>
                      {companies?.map((c: Company) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.companyId?.message} />
                </div>
              </div>

              {/* ═══ SINIESTRO / LIQUIDACIÓN ═══ */}
              <SectionTitle>Siniestro y Liquidación</SectionTitle>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Compañía de Seguros</Label>
                  <Select onValueChange={(v) => form.setValue("insuranceCompany", v ?? "")} value={form.getValues("insuranceCompany") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar compañia..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {insuranceCompaniesCatalog?.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="modal-grid-4">
                <div className="modal-field">
                  <Label className="app-field-label">N° Siniestro <span className="text-red-500">*</span></Label>
                  <Input {...form.register("claimNumber")} placeholder="CHL-00000573" className="app-input h-8" />
                  <FieldError message={form.formState.errors.claimNumber?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">N° Liquidación</Label>
                  <Input {...form.register("liquidationNumber")} placeholder="202503906" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">N° Póliza <span className="text-red-500">*</span></Label>
                  <Input {...form.register("policyNumber")} placeholder="20618983" className="app-input h-8" />
                  <FieldError message={form.formState.errors.policyNumber?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Item Póliza</Label>
                  <Input {...form.register("policyItem")} placeholder="1" className="app-input h-8" />
                </div>
              </div>
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">Ref. Interna Cliente</Label>
                  <Input {...form.register("clientReference")} placeholder="CHL-00013152" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">N° Siniestro Compañía</Label>
                  <Input {...form.register("companyReportNumber")} placeholder="1022370" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Tipo de Siniestro <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => form.setValue("claimType", v ?? "")} value={form.getValues("claimType") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {claimTypes?.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.claimType?.message} />
                </div>
              </div>
              <div className="modal-grid-4">
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Siniestro <span className="text-red-500">*</span></Label>
                  <Input {...form.register("claimDate")} type="date" className="app-input h-7 px-2 text-xs" />
                  <FieldError message={form.formState.errors.claimDate?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Hora Siniestro</Label>
                  <Input {...form.register("claimTime")} type="time" className="app-input h-7 px-2 text-xs" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Denuncio</Label>
                  <Input {...form.register("reportDate")} type="date" className="app-input h-7 px-2 text-xs" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Asignación</Label>
                  <Input {...form.register("assignmentDate")} type="date" className="app-input h-7 px-2 text-xs" />
                </div>
              </div>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Causal del Siniestro</Label>
                  <Select onValueChange={(v) => form.setValue("claimCause", v ?? "")} value={form.getValues("claimCause") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar causal..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {claimCauses?.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Resumen</Label>
                  <textarea
                    {...form.register("summary")}
                    rows={3}
                    className="app-input resize-none"
                    placeholder="Descripción resumida del siniestro..."
                  />
                </div>
              </div>

              </div>)} {/* end siniestro tab */}

              {activeTab === "asegurado" && (<div key="tab-asegurado" className="space-y-4">
              {/* ═══ ASEGURADO ═══ */}
              <SectionTitle>Asegurado</SectionTitle>
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input {...form.register("insuredName")} placeholder="EDIFICIO CONDOMINIO" className="app-input h-8" />
                  <FieldError message={form.formState.errors.insuredName?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Apellido</Label>
                  <Input {...form.register("lastName")} placeholder="LYON" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">RUT</Label>
                  <Input {...form.register("rut")} placeholder="53325014-9" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Email</Label>
                  <Input {...form.register("insuredEmail")} type="email" placeholder="fareyes@gmail.com" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Teléfono</Label>
                  <Input {...form.register("insuredPhone")} placeholder="X XXXX XXXX" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Celular</Label>
                  <Input {...form.register("cellPhone")} placeholder="9 9999 9999" className="app-input h-8" />
                </div>
              </div>

              </div>)} {/* end asegurado tab */}

              {activeTab === "contacto" && (<div key="tab-contacto" className="space-y-4">
              {/* ═══ PERSONA DE CONTACTO ═══ */}
              <SectionTitle>Persona de Contacto</SectionTitle>
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">Nombre Contacto</Label>
                  <Input {...form.register("contactName")} placeholder="Gonzalo Meza" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Cargo / Relación</Label>
                  <Input {...form.register("contactRole")} placeholder="Arrendatario depto 606" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Email Contacto</Label>
                  <Input {...form.register("contactEmail")} type="email" placeholder="ignacia@adpro.cl" className="app-input h-8" />
                </div>
              </div>

              </div>)} {/* end contacto tab */}

              {activeTab === "ubicacion" && (<div key="tab-ubicacion" className="space-y-4">
              {/* ═══ UBICACIÓN ═══ */}
              <SectionTitle>Ubicación del Siniestro</SectionTitle>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Dirección <span className="text-red-500">*</span></Label>
                  <Input {...form.register("address")} placeholder="AVDA RICARDO LYON 1351" className="app-input h-8" />
                  <FieldError message={form.formState.errors.address?.message} />
                </div>
              </div>
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">País</Label>
                  <Select onValueChange={(v) => {
                    form.setValue("country", v ?? "");
                    form.setValue("region", "");
                    form.setValue("city", "");
                    form.setValue("commune", "");
                  }} value={form.getValues("country") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar pais..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {countriesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Región</Label>
                  <Select onValueChange={(v) => {
                    form.setValue("region", v ?? "");
                    form.setValue("city", "");
                    form.setValue("commune", "");
                  }} value={form.getValues("region") || ""} disabled={!selectedCountry}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar region..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {regionsCatalog?.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Ciudad <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => {
                    form.setValue("city", v ?? "");
                    form.setValue("commune", "");
                  }} value={form.getValues("city") || ""} disabled={!selectedRegion}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar ciudad..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {citiesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.city?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Comuna</Label>
                  <Select onValueChange={(v) => form.setValue("commune", v ?? "")} value={form.getValues("commune") || ""} disabled={!selectedCity}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar comuna..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {communesCatalog?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              </div>)} {/* end ubicacion tab */}

              {activeTab === "equipo" && (<div key="tab-equipo" className="space-y-4">
              {/* ═══ ASESOR ═══ */}
              <SectionTitle>Asesor</SectionTitle>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Select onValueChange={(v) => form.setValue("advisor", v ?? "")} value={form.getValues("advisor") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar asesor..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {advisorsCatalog?.map((a) => (<SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ═══ EQUIPO ASIGNADO ═══ */}
              <SectionTitle>Equipo Asignado</SectionTitle>
              <div className="modal-grid">
                <UserSelect label="Inspector" name="inspectorId" users={inspectors} form={form} />
                <UserSelect label="Ajustador" name="adjusterId" users={adjusters} form={form} />
              </div>

              {/* ═══ CORREDOR ═══ */}
              <SectionTitle>Corredor</SectionTitle>
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">Corredor</Label>
                  <Select onValueChange={(v) => form.setValue("brokerName", v ?? "")} value={form.getValues("brokerName") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar corredor..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {brokersCatalog?.map((b) => (<SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">N° Corredor</Label>
                  <Input {...form.register("brokerNumber")} className="app-input h-8" />
                </div>
              </div>

              {/* ═══ NOTAS ═══ */}
              <SectionTitle>Notas</SectionTitle>
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <textarea
                    {...form.register("notes")}
                    rows={2}
                    className="app-input resize-none"
                    placeholder="Observaciones relevantes del caso..."
                  />
                </div>
              </div>
              </div>)} {/* end equipo tab */}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-save" disabled={createMutation.isPending || updateMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Siniestro"}
              </button>
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
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                          setEditingId(claim.id);
                          const pInsured = getParticipant(claim, 'insured');
                          const pContact = getParticipant(claim, 'contact');
                          const companyName = insuranceCompaniesCatalog?.find((c) => c.id === claim.insurance_company_id)?.name ?? "";
                          const typeName = claimTypes?.find((t) => t.id === claim.claim_type_id)?.name ?? "";
                          const causeName = claimCauses?.find((c) => c.id === claim.claim_cause_id)?.name ?? "";
                          const brokerName = brokersCatalog?.find((b) => b.id === claim.broker_id)?.name ?? "";
                          form.reset({
                            claimNumber: claim.claim_number,
                            policyNumber: claim.policy_number,
                            policyItem: claim.policy_item || "",
                            liquidationNumber: claim.liquidation_number || "",
                            insuranceCompany: companyName,
                            clientReference: claim.client_reference || "",
                            companyReportNumber: claim.company_report_number || "",
                            insuredName: pInsured?.first_name || pInsured?.full_name || "",
                            lastName: pInsured?.last_name || "",
                            rut: pInsured?.rut || "",
                            insuredEmail: pInsured?.email || "",
                            insuredPhone: pInsured?.phone || "",
                            cellPhone: pInsured?.cell_phone || "",
                            address: pInsured?.address || "",
                            city: pInsured?.city || "",
                            commune: pInsured?.commune || "",
                            region: pInsured?.region || "",
                            country: pInsured?.country || "Chile",
                            claimDate: claim.claim_date,
                            claimTime: "",
                            reportDate: claim.report_date || "",
                            assignmentDate: claim.assignment_date || "",
                            claimType: typeName,
                            claimCause: causeName,
                            summary: claim.summary || "",
                            contactName: pContact?.full_name || "",
                            contactRole: "",
                            contactEmail: pContact?.email || "",
                            assignedAdjusterId: claim.assigned_adjuster_id || "",
                            inspectorId: claim.inspector_id || "",
                            adjusterId: claim.adjuster_id || "",
                            brokerName: brokerName,
                            brokerNumber: "",
                            advisor: "",
                            companyId: claim.company_id,
                            notes: claim.notes || "",
                          });
                          setActiveTab("siniestro");
                          setOpen(true);
                        }}><Pencil className="h-4 w-4" /></Button>
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
