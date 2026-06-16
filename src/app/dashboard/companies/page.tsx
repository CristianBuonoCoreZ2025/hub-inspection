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
      {/* Header con icono y descripción */}
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }} className="btn-create btn-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Empresa
            </Button>
          </DialogTrigger>

          {/* MODAL Empresas */}
          <DialogContent className="modal-md">
            <div className="modal-header">
              <DialogTitle className="text-lg font-semibold">
                {editingId ? "Editar Empresa" : "Nueva Empresa"}
              </DialogTitle>
            </div>

            <div className="modal-body">
              <div className="space-y-6">
                {/* Logo */}
                <div>
                  <Label className="app-field-label">Logo de la empresa</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {form.watch("logoUrl") ? (
                        <img
                          src={form.watch("logoUrl")}
                          alt="Logo"
                          className="h-16 w-16 rounded-xl object-cover border border-border shadow-sm"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted shadow-sm">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
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
                        <span className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50">
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          {logoUploading ? "Subiendo..." : "Subir logo"}
                        </span>
                      </label>
                      {form.watch("logoUrl") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-red-500 hover:text-red-600"
                          onClick={() => form.setValue("logoUrl", "")}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

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
                    <Controller
                      name="countryId"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="app-input h-11"><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                          <SelectContent>
                            {countries?.map((c: Country) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      )}
                    />
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

                {/* Dirección */}
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

      {/* Tabla */}
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
