"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Trash2, FileText } from "lucide-react";
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

export default function TiposDocumentosPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ country_id: "", code: "", name: "", description: "" });

 const { data: documentTypes, isLoading } = useQuery({
 queryKey: ["document-types"],
 queryFn: getDocumentTypes,
 });

 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const createMutation = useMutation({
 mutationFn: createDocumentType,
 onSuccess: () => {
 toast.success("Tipo de documento creado");
 queryClient.invalidateQueries({ queryKey: ["document-types"] });
 setOpen(false);
 resetForm();
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateDocumentType>[1] }) => updateDocumentType(id, input),
 onSuccess: () => {
 toast.success("Tipo de documento actualizado");
 queryClient.invalidateQueries({ queryKey: ["document-types"] });
 setOpen(false);
 setEditingId(null);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteDocumentType,
 onSuccess: () => {
 toast.success("Tipo de documento desactivado");
 queryClient.invalidateQueries({ queryKey: ["document-types"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = documentTypes?.filter((d) =>
 [d.name, d.code, d.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (d) => d.name,
 code: (d) => d.code,
 description: (d) => d.description,
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
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-slate-500 to-gray-500 text-white shadow-sm">
 <FileText className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Tipos de Documentos</h1>
 <p className="app-page-lead">Gestión de tipos de documentos.</p>
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
 : paginatedData.map((d) => (
 <tr key={d.id}>
 <td><StatusBadge status={d.is_active ? "active" : "inactive"} label={d.is_active ? "Activo" : "Inactivo"} /></td>
 <td>{countries?.find((c) => c.id === d.country_id)?.name || "—"}</td>
 <td className="text-muted-foreground">{d.code || "—"}</td>
 <td className="font-medium">{d.name}</td>
 <td className="max-w-[300px] truncate text-muted-foreground">{d.description || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(d.id); setFormData({ country_id: d.country_id || "", code: d.code || "", name: d.name, description: d.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este tipo de documento?")) deleteMutation.mutate(d.id); }}><Trash2 className="h-4 w-4" /></Button>
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
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><FileText className="h-4 w-4" /></div>
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
 <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: poliza" className="app-input" />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Póliza" className="app-input" />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Descripción</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Breve descripción..." className="app-input" />
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
