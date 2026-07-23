"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "@/services/companies";
import { getUsersByCompany } from "@/services/user-clients";
import { userTypeLabels } from "@/services/permissions";
import { getCountries } from "@/services/countries";
import { uploadFileToStorage } from "@/lib/supabase/storage-upload";
import { companySchema, type CompanyInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, Controller } from "react-hook-form";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, Ban, Upload, X, ImageIcon, Building2, Globe, Mail, Phone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

import type { Country } from "@/types";

const userTypeLabel = userTypeLabels;

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
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [logoUploading, setLogoUploading] = useState(false);
 const [usersModalCompany, setUsersModalCompany] = useState<{ id: string; name: string } | null>(null);

 const form = useForm<CompanyInput>({
 resolver: standardSchemaResolver(companySchema),
 defaultValues: { name: "", slug: "", countryId: "", rut: "", address: "", phone: "", email: "", logoUrl: "", primaryColor: "" },
 });

 const { data: companies, isLoading } = useQuery({
 queryKey: ["companies"],
 queryFn: getCompanies,
 });

 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const { data: companyUsers, isLoading: loadingUsers } = useQuery({
 queryKey: ["company-users", usersModalCompany?.id],
 queryFn: () => getUsersByCompany(usersModalCompany!.id),
 enabled: !!usersModalCompany?.id,
 });

 // eslint-disable-next-line react-hooks/incompatible-library
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

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (c) => c.name,
 country: (c) => countries?.find((co: Country) => co.id === c.country_id)?.name || "",
 rut: (c) => c.rut,
 email: (c) => c.email,
 phone: (c) => c.phone,
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-blue-500 to-indigo-500">
 <Building2 />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Empresas</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canCreate("companies") && (
 <Button onClick={() => { setEditingId(null); form.reset(); setOpen(true); }} className="pg-btn-platinum">
 Nueva
 </Button>
 )}
 </div>
 </div>

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
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
 {form.watch("logoUrl") ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={form.watch("logoUrl")}
 alt="Logo"
 className="h-20 w-auto max-w-[220px] rounded-xl border border-border/60 bg-white object-contain p-2 shadow-sm dark:bg-white"
 />
 ) : (
 <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border/60 bg-muted/60 shadow-sm">
 <ImageIcon className="h-6 w-6 text-muted-foreground" />
 </div>
 )}
 <div className="flex flex-wrap items-center gap-2">
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
 const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : "";
 const logoPath = editingId
 ? `companies/${editingId}/logos/logo${ext}`
 : `companies/_pending/${Date.now()}-${file.name}`;
 const url = await uploadFileToStorage(file, logoPath);
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

 {/* Color principal */}
 <div className="modal-field">
 <Label className="app-field-label">Color principal</Label>
 <div className="flex items-center gap-2">
 <input
 type="color"
 value={form.watch("primaryColor") || "#3b82f6"}
 onChange={(e) => form.setValue("primaryColor", e.target.value)}
 className="size-8 rounded-md border border-border cursor-pointer"
 />
 <Input
 {...form.register("primaryColor")}
 placeholder="#3b82f6"
 className="app-input"
 />
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
 <Select
 value={field.value || "__none"}
 onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
 items={[
 { value: "__none", label: "Selecciona un país" },
 ...(countries?.map((c: Country) => ({ value: c.id, label: c.name })) || []),
 ]}
 >
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Selecciona un país" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Selecciona un país</SelectItem>
 {countries?.map((c: Country) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
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
 <button type="button" className="pg-btn-platinum" onClick={() => setOpen(false)}>
 Cancelar
 </button>
 <button
 type="button"
 className="pg-btn-platinum"
 disabled={createMutation.isPending || updateMutation.isPending}
 onClick={form.handleSubmit(onSubmit)}
 >
 {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
 </button>
 </div>
 </DialogContent>
 </Dialog>

 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[220px]">Empresa</SortableTh>
 <SortableTh sortKey="country" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[120px]">País</SortableTh>
 <SortableTh sortKey="rut" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[140px]">RUT / ID</SortableTh>
 <SortableTh sortKey="email" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[200px]">Email</SortableTh>
 <SortableTh sortKey="phone" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[140px]">Teléfono</SortableTh>
 <th className="w-[60px] text-center">Usuarios</th>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron empresas.</td></tr>
 ) : (
 paginatedData.map((company) => (
 <tr key={company.id}>
 <td className="font-medium">
 <div className="flex items-center gap-3">
 {company.logo_url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={company.logo_url}
 alt={company.name}
 className="h-10 w-auto max-w-[100px] rounded-lg border border-border/60 bg-white object-contain p-1 dark:bg-white"
 />
 ) : (
 <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
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
 <td className="text-center">
 <button
 type="button"
 onClick={() => setUsersModalCompany({ id: company.id, name: company.name })}
 className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
 >
 <Users className="h-3.5 w-3.5" />
 Ver
 </button>
 </td>
 <td>
 <div className="app-row-actions">
 {canEdit("companies") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => {
 setEditingId(company.id);
 form.reset({
 name: company.name, slug: company.slug, countryId: company.country_id || "",
 rut: company.rut || "", address: company.address || "", phone: company.phone || "", email: company.email || "",
 logoUrl: company.logo_url || "", primaryColor: company.primary_color || "",
 });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("companies") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar esta empresa?")) deleteMutation.mutate(company.id); }}>
 <Ban className="h-4 w-4" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>

 {/* Modal de usuarios de la empresa */}
 <Dialog open={!!usersModalCompany} onOpenChange={(open) => { if (!open) setUsersModalCompany(null); }} dismissible={false}>
 <DialogContent className="modal-lg" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <Users className="h-4 w-4" />
 </div>
 Usuarios de {usersModalCompany?.name}
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Liquidadores, inspectores y operativos asociados a esta empresa.
 </DialogDescription>
 </div>
 <div className="modal-body">
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>Nombre</th>
 <th>Email</th>
 <th>Tipo</th>
 <th>Estado</th>
 </tr>
 </thead>
 <tbody>
 {loadingUsers ? (
 <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : (companyUsers?.length === 0 || !companyUsers) ? (
 <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No hay usuarios asociados a esta empresa.</td></tr>
 ) : (
 companyUsers.map((user) => (
 <tr key={user.id}>
 <td className="font-medium">{user.full_name || "—"}</td>
 <td>{user.email || "—"}</td>
 <td>
 <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
 {userTypeLabel[user.role as keyof typeof userTypeLabel] || user.role}
 </span>
 </td>
 <td>
 <StatusBadge status={user.is_active ? "active" : "inactive"} label={user.is_active ? "Activo" : "Inactivo"} />
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 <div className="modal-footer">
 <button type="button" className="pg-btn-platinum" onClick={() => setUsersModalCompany(null)}>
 Cerrar
 </button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
