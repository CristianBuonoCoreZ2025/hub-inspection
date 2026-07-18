"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getBusinessLines, createBusinessLine, updateBusinessLine, deleteBusinessLine, getCountries, getClaimTypes } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Tag, Layers } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

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
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

export default function LineasNegocioPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ country_id: "", name: "", code_prefix: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

 const { data: lines, isLoading } = useQuery({
 queryKey: ["business-lines"],
 queryFn: getBusinessLines,
 });

 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const { data: claimTypes } = useQuery({
 queryKey: ["claim-types"],
 queryFn: getClaimTypes,
 });

 const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

 const createMutation = useMutation({
 mutationFn: createBusinessLine,
 onSuccess: () => { toast.success("Linea creada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); resetForm(); },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBusinessLine>[1] }) => updateBusinessLine(id, input),
 onSuccess: () => { toast.success("Linea actualizada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); setEditingId(null); },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteBusinessLine,
 onSuccess: () => { toast.success("Linea desactivada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = lines?.filter((l) =>
 [l.name, l.claim_type, l.ramo_fecu, l.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (l) => l.name,
 claim_type: (l) => claimTypes?.find((ct) => ct.id === l.claim_type_id)?.name || l.claim_type || "",
 ramo_fecu: (l) => l.ramo_fecu || "",
 description: (l) => l.description || "",
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", code_prefix: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
 else { createMutation.mutate(formData); }
 };

 return (
 <div className="app-page">
 <div className="app-page-header">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
 <Layers className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Lineas de Negocio</h1>
 <p className="app-page-lead">Gestión de líneas de negocio.</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="pg-btn-platinum">
 Nueva
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
 <thead><tr><th className="w-10"></th><th>País</th><SortableTh sortKey="claim_type" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Tipo Siniestro</SortableTh><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Línea de Negocio</SortableTh><SortableTh sortKey="ramo_fecu" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Ramo FECU</SortableTh><SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh><th className="w-[80px]"></th></tr></thead>
 <tbody>
 {isLoading ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : filtered?.length === 0 ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : paginatedData.map((l) => (
 <tr key={l.id}>
 <td><StatusBadge status="active" label="Activo" /></td>
 <td>{countries?.find((c) => c.id === l.country_id)?.name || "—"}</td>
 <td>{claimTypes?.find((ct) => ct.id === l.claim_type_id)?.name || l.claim_type || "—"}</td>
 <td className="font-medium">{l.name}</td>
 <td>{l.ramo_fecu || "—"}</td>
 <td className="max-w-[300px] truncate text-muted-foreground">{l.description || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(l.id); setFormData({ country_id: l.country_id || "", name: l.name, code_prefix: (l as { code_prefix?: string }).code_prefix || "", claim_type: l.claim_type || "", claim_type_id: l.claim_type_id || "", ramo_fecu: l.ramo_fecu || "", description: l.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta linea?")) deleteMutation.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
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
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Tag className="h-4 w-4" /></div>
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
 <Label className="app-field-label">Tipo Siniestro</Label>
 <Select
 value={formData.claim_type_id || "__none"}
 onValueChange={(v) => setFormData({ ...formData, claim_type_id: v === "__none" ? "" : (v ?? "") })}
 items={[{ value: "__none", label: "Sin selección" }, ...(claimTypes || []).map((ct) => ({ value: ct.id, label: ct.name }))]}
 >
 <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Sin selección</SelectItem>
 {claimTypes?.map((ct) => (<SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field" style={{ flex: "0 0 100px" }}>
 <Label className="app-field-label">
 Código {!editingId && <span className="text-red-500">*</span>}
 {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
 </Label>
 <Input
 value={formData.code_prefix}
 onChange={(e) => setFormData({ ...formData, code_prefix: e.target.value.toUpperCase().slice(0, 1) })}
 placeholder="Ej: H"
 className="app-input font-mono text-center"
 disabled={!!editingId}
 required={!editingId}
 />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Línea de Negocio <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Accidentes Personales" className="app-input" />
 </div>
 <div className="modal-field"><Label className="app-field-label">Ramo FECU</Label><Input value={formData.ramo_fecu} onChange={(e) => setFormData({ ...formData, ramo_fecu: e.target.value })} className="app-input" /></div>
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
