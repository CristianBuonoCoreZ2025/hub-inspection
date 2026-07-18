"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { getActionTypes, createActionType, updateActionType, deleteActionType } from "@/services/actions";
import { toast } from "sonner";
import { Search, Pencil, Trash2, ListChecks } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";

export default function TiposGestionPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ code: "", name: "", description: "" });

 const { data: types, isLoading } = useQuery({
 queryKey: ["action-types"],
 queryFn: getActionTypes,
 });

 const createMutation = useMutation({
 mutationFn: createActionType,
 onSuccess: () => {
 toast.success("Tipo de gestión creado");
 queryClient.invalidateQueries({ queryKey: ["action-types"] });
 setOpen(false);
 resetForm();
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateActionType>[1] }) => updateActionType(id, input),
 onSuccess: () => {
 toast.success("Tipo de gestión actualizado");
 queryClient.invalidateQueries({ queryKey: ["action-types"] });
 setOpen(false);
 setEditingId(null);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteActionType,
 onSuccess: () => {
 toast.success("Tipo de gestión desactivado");
 queryClient.invalidateQueries({ queryKey: ["action-types"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = types?.filter((t) =>
 [t.name, t.code, t.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(filtered);

 const resetForm = () => {
 setFormData({ code: "", name: "", description: "" });
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
 else { createMutation.mutate(formData); }
 };

 return (
 <div className="app-page">
 <header className="app-page-header">
 <h1 className="app-page-title">Tipos de Gestión</h1>
 <p className="app-page-lead">Categorías de acciones: Ajuste, Inspección, Impugnación, Cierre, Comunicaciones, Reapertura.</p>
 </header>

 <div className="app-toolbar">
 <div className="flex items-center gap-3">
 <Search className="h-4 w-4 text-muted-foreground" />
 <Input placeholder="Buscar tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-sm" />
 </div>
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="pg-btn-platinum ml-auto">
 Nuevo
 </Button>
 )}
 </div>

 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead><tr><th className="w-10"></th><th>Código</th><th>Nombre</th><th>Descripción</th><th className="w-[80px]"></th></tr></thead>
 <tbody>
 {isLoading ? <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : paginatedData.length === 0 ? <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : paginatedData.map((t) => (
 <tr key={t.id}>
 <td><span className={`inline-block h-2 w-2 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} /></td>
 <td className="text-muted-foreground font-mono">{t.code || "—"}</td>
 <td className="font-medium">{t.name}</td>
 <td className="max-w-[400px] truncate text-muted-foreground">{t.description || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(t.id); setFormData({ code: t.code, name: t.name, description: t.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este tipo?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />

 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><ListChecks className="h-4 w-4" /></div>
 {editingId ? "Editar" : "Nuevo"}
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-grid">
 <div className="modal-field">
 <Label className="app-field-label">Código</Label>
 <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: adjustment_process" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Proceso de Ajuste" className="app-input" />
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
