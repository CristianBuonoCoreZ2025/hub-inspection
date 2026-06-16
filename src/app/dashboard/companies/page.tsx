"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { companySchema, type CompanyInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Building2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Country } from "@/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<CompanyInput>({
    resolver: standardSchemaResolver(companySchema),
    defaultValues: { name: "", slug: "", countryId: "", rut: "", address: "", phone: "", email: "" },
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const selectedCountryId = form.watch("countryId");
  const selectedCountry = countries?.find((c: Country) => c.id === selectedCountryId);
  const isChile = selectedCountry?.code === "CL";

  const createMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      toast.success("Empresa creada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompanyInput> }) => updateCompany(id, data),
    onSuccess: () => {
      toast.success("Empresa actualizada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      toast.success("Empresa eliminada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: CompanyInput) => {
    const payload = { ...values, slug: editingId ? values.slug : slugify(values.name) };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const filtered = companies?.filter((c) =>
    [c.name, c.rut, c.address].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Empresas</h1>
        <p className="app-page-lead">Gestión de empresas aseguradoras del sistema.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }} className="btn-create btn-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Empresa
            </Button>
          </DialogTrigger>

          {/* ── MODAL Empresas — 640px (formulario medio) ── */}
          <DialogContent className="modal-md">
            <div className="modal-header">
              <DialogTitle className="text-lg font-semibold">
                {editingId ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
            </div>

            <div className="modal-body">
              <div className="space-y-6">
                {/* Nombre | País */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="app-field-label">Nombre de la empresa <span className="text-red-500">*</span></Label>
                    <Input {...form.register("name")} placeholder="Ej: Mapfre Seguros" className="app-input" />
                    {form.formState.errors.name && (
                      <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="app-field-label">País <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("countryId", v ?? "")} defaultValue={form.getValues("countryId")}>
                      <SelectTrigger className="app-input h-11"><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                      <SelectContent>
                        {countries?.map((c: Country) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.countryId && (
                      <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.countryId.message}</p>
                    )}
                  </div>
                </div>

                {/* RUT | Email */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="app-field-label">{isChile ? "RUT" : "ID Tributario"}</Label>
                    <Input {...form.register("rut")} placeholder={isChile ? "12.345.678-9" : "Ej: 123456789"} className="app-input" />
                    {form.formState.errors.rut && (
                      <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.rut.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="app-field-label">Email de contacto</Label>
                    <Input {...form.register("email")} type="email" placeholder="contacto@empresa.cl" className="app-input" />
                    {form.formState.errors.email && (
                      <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* Dirección — full width */}
                <div>
                  <Label className="app-field-label">Dirección</Label>
                  <Input {...form.register("address")} placeholder="Av. Principal 123, Oficina 456, Santiago" className="app-input" />
                </div>

                {/* Teléfono */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label className="app-field-label">Teléfono</Label>
                    <Input {...form.register("phone")} placeholder={selectedCountry?.phone_prefix ? `${selectedCountry.phone_prefix} 912345678` : "+56 912345678"} className="app-input" />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <DialogClose>
                <Button type="button" variant="outline" className="btn-cancel btn-footer">Cancelar</Button>
              </DialogClose>
              <Button type="button" className="btn-save btn-footer" disabled={createMutation.isPending || updateMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Empresa"}
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
                <th>Empresa</th>
                <th>País</th>
                <th>RUT / ID</th>
                <th>Contacto</th>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron empresas.</td></tr>
              ) : (
                filtered?.map((company) => (
                  <tr key={company.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {company.name}
                      </div>
                    </td>
                    <td>{countries?.find((c: Country) => c.id === company.country_id)?.name || "—"}</td>
                    <td>{company.rut || "—"}</td>
                    <td>
                      <div className="flex flex-col gap-0.5 text-[12px]">
                        {company.email && <span>{company.email}</span>}
                        {company.phone && <span className="text-muted-foreground">{company.phone}</span>}
                        {!company.email && !company.phone && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                          setEditingId(company.id);
                          form.reset({
                            name: company.name, slug: company.slug, countryId: company.country_id || "",
                            rut: company.rut || "", address: company.address || "", phone: company.phone || "", email: company.email || "",
                          });
                          setOpen(true);
                        }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Eliminar esta empresa?")) deleteMutation.mutate(company.id); }}>
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
