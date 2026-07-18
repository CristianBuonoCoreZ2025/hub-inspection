"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getEvents, createEvent, updateEvent, deleteEvent, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Zap } from "lucide-react";
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

export default function EventosPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ country_id: "", code: "", name: "", description: "" });

 const { data: events, isLoading } = useQuery({
 queryKey: ["events"],
 queryFn: getEvents,
 });

 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const createMutation = useMutation({
 mutationFn: createEvent,
 onSuccess: () => {
 toast.success("Evento creado");
 queryClient.invalidateQueries({ queryKey: ["events"] });
 setOpen(false);
 resetForm();
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateEvent>[1] }) => updateEvent(id, input),
 onSuccess: () => {
 toast.success("Evento actualizado");
 queryClient.invalidateQueries({ queryKey: ["events"] });
 setOpen(false);
 setEditingId(null);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteEvent,
 onSuccess: () => {
 toast.success("Evento desactivado");
 queryClient.invalidateQueries({ queryKey: ["events"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = events?.filter((e) =>
 [e.name, e.code, e.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (e) => e.name,
 code: (e) => e.code,
 description: (e) => e.description,
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const resetForm = () => {
 setFormData({ country_id: countries?.find((c) => c.code === "CL")?.id || "", code: "", name: "", description: "" });
 };

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
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-yellow-500 to-amber-500 text-white shadow-sm">
 <Zap className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Eventos</h1>
 <p className="app-page-lead">Gestión de eventos de siniestros.</p>
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
 <thead><tr><th className="w-10"></th><th>Pais</th><SortableTh sortKey="code" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Código</SortableTh><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh><SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh><th className="w-[80px]"></th></tr></thead>
 <tbody>
 {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : filtered?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : paginatedData.map((e) => (
 <tr key={e.id}>
 <td><StatusBadge status={e.is_active ? "active" : "inactive"} label={e.is_active ? "Activo" : "Inactivo"} /></td>
 <td>{countries?.find((c) => c.id === e.country_id)?.name || "—"}</td>
 <td className="text-muted-foreground">{e.code || "—"}</td>
 <td className="font-medium">{e.name}</td>
 <td className="max-w-[300px] truncate text-muted-foreground">{e.description || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(e.id); setFormData({ country_id: e.country_id || "", code: e.code || "", name: e.name, description: e.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar este evento?")) deleteMutation.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button>
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
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Zap className="h-4 w-4" /></div>
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
 {countries?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Código</Label>
 <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: incendio" className="app-input" />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Incendio estructural" className="app-input" />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Descripción</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Breve descripción del evento..." className="app-input" />
 </div>
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
