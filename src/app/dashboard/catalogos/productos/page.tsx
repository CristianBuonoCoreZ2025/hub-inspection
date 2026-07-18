"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getInsuranceProducts, createInsuranceProduct, updateInsuranceProduct, deleteInsuranceProduct, getBusinessLines, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Ban, Box, Package } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ProductosPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ country_id: "", business_line_id: "", name: "", description: "" });

 const { data: products, isLoading } = useQuery({
 queryKey: ["insurance-products"],
 queryFn: getInsuranceProducts,
 });

 const { data: businessLines } = useQuery({
 queryKey: ["business-lines"],
 queryFn: getBusinessLines,
 });

 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

 const createMutation = useMutation({
 mutationFn: createInsuranceProduct,
 onSuccess: () => { toast.success("Producto creado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); setOpen(false); resetForm(); },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateInsuranceProduct>[1] }) => updateInsuranceProduct(id, input),
 onSuccess: () => { toast.success("Producto actualizado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); setOpen(false); setEditingId(null); },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteInsuranceProduct,
 onSuccess: () => { toast.success("Producto desactivado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = products?.filter((p) =>
 [p.name, p.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (p) => p.name,
 description: (p) => p.description || "",
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const resetForm = () => setFormData({ country_id: defaultCountryId, business_line_id: "", name: "", description: "" });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (!formData.business_line_id) { toast.error("Debe seleccionar una linea de negocio"); return; }
 if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
 else { createMutation.mutate(formData); }
 };

 return (
 <div className="app-page">
 <div className="app-page-header">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
 <Package className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Ramos / Productos</h1>
 <p className="app-page-lead">Gestión de ramos y productos.</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="pg-btn-platinum">
 Nuevo
 </Button>
 )}
 </div>
 </div>
 </div>

 <div className="app-toolbar">
 <div className="flex items-center gap-2">
 <div className="relative w-[160px] shrink-0">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 </div>
 </div>

 <div className="app-panel">
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead><tr><th className="w-10"></th><th>País</th><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh><th>Linea de Negocio</th><SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh><th className="w-[80px]"></th></tr></thead>
 <tbody>
 {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : filtered?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : paginatedData.map((p) => (
 <tr key={p.id}>
 <td><StatusBadge status="active" label="Activo" /></td>
 <td>{countries?.find((c) => c.id === p.country_id)?.name || "—"}</td>
 <td className="font-medium">{p.name}</td>
 <td>{businessLines?.find((l) => l.id === p.business_line_id)?.name || "—"}</td>
 <td className="max-w-[300px] truncate text-muted-foreground">{p.description || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(p.id); setFormData({ country_id: p.country_id || "", business_line_id: p.business_line_id, name: p.name, description: p.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar este producto?")) deleteMutation.mutate(p.id); }}><Ban className="h-4 w-4" /></Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>

 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Box className="h-4 w-4" /></div>
 {editingId ? "Editar" : "Nuevo"}
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-grid">
 <div className="modal-field">
 <Label className="app-field-label">País</Label>
 <Select
 value={formData.country_id || "__none"}
 onValueChange={(v) => setFormData({ ...formData, country_id: v === "__none" ? "" : (v ?? "") })}
 items={[{ value: "__none", label: "Sin selección" }, ...(countries || []).map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input h-7">
 <SelectValue placeholder="Seleccionar país..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Sin selección</SelectItem>
 {countries?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Linea de Negocio <span className="text-red-500">*</span></Label>
 <Select
 value={formData.business_line_id}
 onValueChange={(v) => setFormData({ ...formData, business_line_id: v ?? "" })}
 items={businessLines?.map((l) => ({ value: l.id, label: l.name })) || []}
 >
 <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar linea..." /></SelectTrigger>
 <SelectContent>
 {businessLines?.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Hogar Full Protegido" className="app-input" />
 </div>
 <div className="modal-field modal-field-full"><Label className="app-field-label">Descripcion</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="app-input" /></div>
 </div>
 </div>
 <div className="modal-footer">
 <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
 <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">{createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}</Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
