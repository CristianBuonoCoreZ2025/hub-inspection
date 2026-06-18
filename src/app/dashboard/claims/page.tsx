"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, createClaim, updateClaim, deleteClaim } from "@/services/claims";
import { getCompanies } from "@/services/companies";
import { getUsers } from "@/services/users";
import { getClaimCauses, getInsuranceCompanies, getBrokers, getAdvisors } from "@/services/catalogs";
import { claimSchema, type ClaimInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, FileText, ClipboardCheck } from "lucide-react";
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
    <div className="modal-field-full mt-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {children}
      </h3>
      <div className="h-px bg-border/40 mb-3" />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
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

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<ClaimInput>({
    resolver: standardSchemaResolver(claimSchema),
    defaultValues: {
      claimNumber: "", policyNumber: "", liquidationNumber: "",
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

  const { data: claims, isLoading } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: claimCauses } = useQuery({
    queryKey: ["claim-causes"],
    queryFn: () => getClaimCauses(),
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

  const filtered = claims?.filter((c) =>
    [c.claim_number, c.liquidation_number, c.insured_name, c.address].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Siniestros</h1>
        <p className="app-page-lead">Gestión de siniestros y seguimiento de casos.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar siniestro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => { setEditingId(null); form.reset(); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Siniestro
          </Button>

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
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">N° Siniestro Compañía <span className="text-red-500">*</span></Label>
                  <Input {...form.register("claimNumber")} placeholder="1946897" className="app-input h-8" />
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
                  <Label className="app-field-label">Ref. Interna Cliente</Label>
                  <Input {...form.register("clientReference")} placeholder="CHL-00013152" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">N° Denuncio Compañía</Label>
                  <Input {...form.register("companyReportNumber")} className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Tipo de Siniestro <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => form.setValue("claimType", v ?? "")} value={form.getValues("claimType") || ""}>
                    <SelectTrigger className="app-input h-8"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin seleccionar —</SelectItem>
                      {claimCauses?.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.claimType?.message} />
                </div>
              </div>
              <div className="modal-grid-4">
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Siniestro <span className="text-red-500">*</span></Label>
                  <Input {...form.register("claimDate")} type="date" className="app-input h-8" />
                  <FieldError message={form.formState.errors.claimDate?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Hora Siniestro</Label>
                  <Input {...form.register("claimTime")} type="time" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Denuncio</Label>
                  <Input {...form.register("reportDate")} type="date" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Fecha Asignación</Label>
                  <Input {...form.register("assignmentDate")} type="date" className="app-input h-8" />
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
                  <Label className="app-field-label">Ciudad <span className="text-red-500">*</span></Label>
                  <Input {...form.register("city")} placeholder="Santiago" className="app-input h-8" />
                  <FieldError message={form.formState.errors.city?.message} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Comuna</Label>
                  <Input {...form.register("commune")} placeholder="Providencia" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Región</Label>
                  <Input {...form.register("region")} placeholder="Metropolitana" className="app-input h-8" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">País</Label>
                  <Input {...form.register("country")} placeholder="Chile" className="app-input h-8" />
                </div>
              </div>

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
                <UserSelect label="Inspector" name="inspectorId" users={users} form={form} />
                <UserSelect label="Ajustador" name="adjusterId" users={users} form={form} />
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
      </div>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="w-[140px]">N° Siniestro</th>
                <th className="w-[120px]">N° Liquidación</th>
                <th className="w-[200px]">Asegurado</th>
                <th>Dirección</th>
                <th className="w-[110px]">Estado</th>
                <th className="w-[100px]">Fecha</th>
                <th className="w-[160px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron siniestros.</td></tr>
              ) : (
                filtered?.map((claim) => (
                  <tr key={claim.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {claim.claim_number}
                      </div>
                    </td>
                    <td>{claim.liquidation_number || "—"}</td>
                    <td>{claim.insured_name} {claim.last_name}</td>
                    <td className="truncate">{claim.address}, {claim.city}</td>
                    <td><Badge className={statusColors[claim.status]}>{statusLabels[claim.status]}</Badge></td>
                    <td>{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
                    <td>
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
                          form.reset({
                            claimNumber: claim.claim_number,
                            policyNumber: claim.policy_number,
                            liquidationNumber: claim.liquidation_number || "",
                            insuranceCompany: claim.insurance_company || "",
                            clientReference: claim.client_reference || "",
                            companyReportNumber: claim.company_report_number || "",
                            insuredName: claim.insured_name,
                            lastName: claim.last_name || "",
                            rut: claim.rut || "",
                            insuredEmail: claim.insured_email || "",
                            insuredPhone: claim.insured_phone || "",
                            cellPhone: claim.cell_phone || "",
                            address: claim.address,
                            city: claim.city,
                            commune: claim.commune || "",
                            region: claim.region || "",
                            country: claim.country || "Chile",
                            claimDate: claim.claim_date,
                            claimTime: claim.claim_time || "",
                            reportDate: claim.report_date || "",
                            assignmentDate: claim.assignment_date || "",
                            claimType: claim.claim_type,
                            claimCause: claim.claim_cause || "",
                            summary: claim.summary || "",
                            contactName: claim.contact_name || "",
                            contactRole: claim.contact_role || "",
                            contactEmail: claim.contact_email || "",
                            assignedAdjusterId: claim.assigned_adjuster_id || "",
                            inspectorId: claim.inspector_id || "",
                            adjusterId: claim.adjuster_id || "",
                            brokerName: claim.broker_name || "",
                            brokerNumber: claim.broker_number || "",
                            advisor: claim.advisor || "",
                            companyId: claim.company_id,
                            notes: claim.notes || "",
                          });
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
