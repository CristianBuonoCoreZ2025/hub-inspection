"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, createClaim, updateClaim, deleteClaim } from "@/services/claims";
import { getCompanies } from "@/services/companies";
import { claimSchema, type ClaimInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClaimStatus, Company } from "@/types";

const statusLabels: Record<ClaimStatus, string> = {
  created: "Creado",
  scheduled: "Agendado",
  in_progress: "En proceso",
  pending_info: "Pendiente",
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
  closed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: claims, isLoading } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
  });

  const form = useForm<ClaimInput>({
    resolver: standardSchemaResolver(claimSchema),
    defaultValues: {
      claimNumber: "",
      policyNumber: "",
      insuranceCompany: "",
      insuredName: "",
      insuredEmail: "",
      insuredPhone: "",
      address: "",
      city: "",
      claimDate: "",
      claimType: "",
      companyId: "",
      notes: "",
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const createMutation = useMutation({
    mutationFn: createClaim,
    onSuccess: () => {
      toast.success("Siniestro creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClaimInput> }) =>
      updateClaim(id, data),
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

  const onSubmit = (values: ClaimInput) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      createMutation.mutate({ ...values, company_id: values.companyId });
    }
  };

  const filteredClaims = claims?.filter((c) =>
    [c.claim_number, c.insured_name, c.address, c.city]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Siniestros</h1>
        <p className="app-page-lead">Gestión de siniestros y casos de inspección.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, nombre, dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }} className="btn-create btn-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Siniestro
            </Button>
          </DialogTrigger>
          <DialogContent className="modal-lg">
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-semibold">
                  {editingId ? "Editar Siniestro" : "Nuevo Siniestro"}
                </DialogTitle>
                <DialogClose>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="modal-body">
              <div className="space-y-6">
                {/* Fila 1: Número | Póliza | Compañía */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <Label className="app-field-label">Número Siniestro <span className="text-red-500">*</span></Label>
                    <Input {...form.register("claimNumber")} placeholder="SIN-2024-001" className="app-input" />
                    {form.formState.errors.claimNumber && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.claimNumber.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Número Póliza <span className="text-red-500">*</span></Label>
                    <Input {...form.register("policyNumber")} placeholder="POL-123456" className="app-input" />
                    {form.formState.errors.policyNumber && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.policyNumber.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Compañía de Seguros</Label>
                    <Input {...form.register("insuranceCompany")} placeholder="Mapfre Seguros" className="app-input" />
                  </div>
                </div>

                {/* Fila 2: Asegurado | Email | Teléfono */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <Label className="app-field-label">Nombre Asegurado <span className="text-red-500">*</span></Label>
                    <Input {...form.register("insuredName")} placeholder="Juan Pérez" className="app-input" />
                    {form.formState.errors.insuredName && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.insuredName.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Email</Label>
                    <Input {...form.register("insuredEmail")} type="email" placeholder="juan@email.com" className="app-input" />
                  </div>
                  <div>
                    <Label className="app-field-label">Teléfono</Label>
                    <Input {...form.register("insuredPhone")} placeholder="+56 912345678" className="app-input" />
                  </div>
                </div>

                {/* Fila 3: Dirección | Ciudad | Fecha */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <Label className="app-field-label">Dirección <span className="text-red-500">*</span></Label>
                    <Input {...form.register("address")} placeholder="Av. Principal 123" className="app-input" />
                    {form.formState.errors.address && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.address.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Ciudad <span className="text-red-500">*</span></Label>
                    <Input {...form.register("city")} placeholder="Santiago" className="app-input" />
                    {form.formState.errors.city && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.city.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Fecha Siniestro <span className="text-red-500">*</span></Label>
                    <Input {...form.register("claimDate")} type="date" className="app-input" />
                    {form.formState.errors.claimDate && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.claimDate.message}</p>)}
                  </div>
                </div>

                {/* Fila 4: Tipo | Empresa */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="app-field-label">Tipo Siniestro <span className="text-red-500">*</span></Label>
                    <Input {...form.register("claimType")} placeholder="Daños por agua" className="app-input" />
                    {form.formState.errors.claimType && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.claimType.message}</p>)}
                  </div>
                  <div>
                    <Label className="app-field-label">Empresa <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("companyId", v ?? "")} defaultValue={form.getValues("companyId")} disabled={editingId !== null}>
                      <SelectTrigger className="app-input h-10"><SelectValue placeholder="Selecciona una empresa" /></SelectTrigger>
                      <SelectContent>
                        {companies?.map((c: Company) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.companyId && (<p className="mt-1.5 text-xs text-red-500">{form.formState.errors.companyId.message}</p>)}
                  </div>
                </div>

                {/* Fila 5: Notas */}
                <div>
                  <Label className="app-field-label">Notas</Label>
                  <Input {...form.register("notes")} placeholder="Observaciones adicionales..." className="app-input" />
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <DialogClose>
                <Button type="button" variant="outline" className="btn-cancel">Cancelar</Button>
              </DialogClose>
              <Button type="button" className="btn-save" disabled={createMutation.isPending || updateMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Siniestro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Asegurado</th>
                <th>Empresa</th>
                <th>Dirección</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredClaims?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-4">
                      No se encontraron siniestros.
                    </td>
                  </tr>
                ) : (
                  filteredClaims?.map((claim) => (
                    <tr key={claim.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {claim.claim_number}
                        </div>
                      </td>
                      <td>{claim.insured_name}</td>
                      <td>{companies?.find((c: Company) => c.id === claim.company_id)?.name || "—"}</td>
                      <td>{claim.address}, {claim.city}</td>
                      <td>{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
                      <td>
                        <Badge className={statusColors[claim.status]}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-neutral btn-icon"
                            onClick={() => {
                              setEditingId(claim.id);
                              form.reset({
                                claimNumber: claim.claim_number,
                                policyNumber: claim.policy_number,
                                insuranceCompany: claim.insurance_company || "",
                                insuredName: claim.insured_name,
                                insuredEmail: claim.insured_email || "",
                                insuredPhone: claim.insured_phone || "",
                                address: claim.address,
                                city: claim.city,
                                claimDate: claim.claim_date,
                                claimType: claim.claim_type,
                                companyId: claim.company_id,
                                notes: claim.notes || "",
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-danger btn-icon"
                            onClick={() => {
                              if (confirm("¿Eliminar este siniestro?")) {
                                deleteMutation.mutate(claim.id);
                              }
                            }}
                          >
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
