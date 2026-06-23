"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { uploadFileToStorage } from "@/lib/nhost/storage-upload";
import { companySchema, type CompanyInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Upload, X, ImageIcon, Building2, Globe, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [logoUploading, setLogoUploading] = useState(false);

  const form = useForm<CompanyInput>({
    resolver: standardSchemaResolver(companySchema),
    defaultValues: { name: "", slug: "", countryId: "", rut: "", address: "", phone: "", email: "", logoUrl: "" },
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="app-page-title">Empresas</h1>
            <p className="app-page-lead">Administra las compañías aseguradoras y sus datos de contacto. Cada empresa puede tener siniestros y usuarios asignados.</p>
          </div>
        </div>
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
        <Button onClick={() => { setEditingId(null); form.reset(); setOpen(true); }} className="btn-create btn-sm">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Empresa
        </Button>

        <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
          <DialogContent className="modal-md" showCloseButton={false}>
            <div className="modal-header">
              <DialogTitle className="modal-title flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                  <Building2 className="h-4 w-4" />
                </div>
                {editingId ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
              <DialogDescription className="modal-subtitle">
                Completa los datos de la compañía aseguradora. Los campos marcados con * son obligatorios.
              </DialogDescription>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {/* Logo — full width */}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Logo</Label>
                  <div className="flex items-center gap-3">
                    {form.watch("logoUrl") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.watch("logoUrl")}
                        alt="Logo"
                        className="h-12 w-12 rounded-xl object-cover border border-border/60 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoUploading(true);
                          try {
                            const url = await uploadFileToStorage(file, `companies/logos/${Date.now()}-${file.name}`);
                            form.setValue("logoUrl", url);
                            toast.success("Logo subido");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Error al subir logo");
                          } finally {
                            setLogoUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <span className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted">
                          <Upload className="mr-1.5 h-3 w-3" />
                          {logoUploading ? "Subiendo..." : "Subir logo"}
                        </span>
                      </label>
                      {form.watch("logoUrl") && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                          onClick={() => form.setValue("logoUrl", "")}
                        >
                          <X className="h-3 w-3" />
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nombre — full width */}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input {...form.register("name")} placeholder="Mapfre Seguros" className="app-input" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>

                {/* País | RUT */}
                <div className="modal-field">
                  <Label className="app-field-label">País <span className="text-red-500">*</span></Label>
                  <Controller
                    name="countryId"
                    control={form.control}
                    render={({ field }) => (
                      <select
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="app-input h-[40px] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-size-[18px] bg-position-[right_10px_center] bg-no-repeat pr-9"
                      >
                        <option value="">Selecciona un país</option>
                        {countries?.map((c: Country) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  />
                  {form.formState.errors.countryId && (
                    <p className="text-xs text-red-500">{form.formState.errors.countryId.message}</p>
                  )}
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">{isChile ? "RUT" : "ID tributario"}</Label>
                  <Input {...form.register("rut")} placeholder={isChile ? "12.345.678-9" : "Ej: 123456789"} className="app-input" />
                  {form.formState.errors.rut && (
                    <p className="text-xs text-red-500">{form.formState.errors.rut.message}</p>
                  )}
                </div>

                {/* Email — full width */}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Email</Label>
                  <Input {...form.register("email")} type="email" placeholder="contacto@empresa.cl" className="app-input" />
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>

                {/* Dirección — full width */}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Dirección</Label>
                  <Input {...form.register("address")} placeholder="Av. Principal 123, Oficina 456, Santiago" className="app-input" />
                </div>

                {/* Teléfono — full width */}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Teléfono</Label>
                  <Input {...form.register("phone")} placeholder={selectedCountry?.phone_prefix ? `${selectedCountry.phone_prefix} 912345678` : "+56 912345678"} className="app-input" />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-save"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={form.handleSubmit(onSubmit)}
              >
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Empresa"}
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
                <th className="w-[220px]">Empresa</th>
                <th className="w-[120px]">País</th>
                <th className="w-[140px]">RUT / ID</th>
                <th className="w-[200px]">Email</th>
                <th className="w-[140px]">Teléfono</th>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron empresas.</td></tr>
              ) : (
                filtered?.map((company) => (
                  <tr key={company.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-3">
                        {company.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="h-8 w-8 rounded-lg object-cover border border-border/60"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
                            {company.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate max-w-[140px]" title={company.name}>{company.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {countries?.find((c: Country) => c.id === company.country_id)?.name || "—"}
                      </div>
                    </td>
                    <td>{company.rut || "—"}</td>
                    <td>
                      {company.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[170px]" title={company.email}>{company.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {company.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {company.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                          setEditingId(company.id);
                          form.reset({
                            name: company.name, slug: company.slug, countryId: company.country_id || "",
                            rut: company.rut || "", address: company.address || "", phone: company.phone || "", email: company.email || "",
                            logoUrl: company.logo_url || "",
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
