"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getDamageSpaces, getPropertyClassifications, updateDamageSpaceClassifications, createDamageSpace, updateDamageSpace, deleteDamageSpace } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Ban, Grid3x3, Plus, Home } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { DamageSpace } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { SpaceClassificationMatrix } from "@/components/ui/space-classification-matrix";

export default function DamageSpacesPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [matrixOpen, setMatrixOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState<{ name: string; description: string }>({ name: "", description: "" });

 const { data: items, isLoading } = useQuery({
 queryKey: ["damage-spaces"],
 queryFn: getDamageSpaces,
 });

 const { data: classifications = [] } = useQuery({
 queryKey: ["clasificacion_bien"],
 queryFn: getPropertyClassifications,
 staleTime: 1000 * 60 * 30,
 });

 const createMutation = useMutation({
 mutationFn: createDamageSpace,
 onSuccess: () => {
 toast.success("Espacio creado");
 queryClient.invalidateQueries({ queryKey: ["damage-spaces"] });
 setOpen(false);
 setFormData({ name: "", description: "" });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, data }: { id: string; data: Partial<DamageSpace> }) => updateDamageSpace(id, data),
 onSuccess: () => {
 toast.success("Espacio actualizado");
 queryClient.invalidateQueries({ queryKey: ["damage-spaces"] });
 setOpen(false);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteDamageSpace,
 onSuccess: () => {
 toast.success("Espacio eliminado");
 queryClient.invalidateQueries({ queryKey: ["damage-spaces"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const matrixMutation = useMutation({
 mutationFn: updateDamageSpaceClassifications,
 onSuccess: () => {
 toast.success("Matriz actualizada");
 queryClient.invalidateQueries({ queryKey: ["damage-spaces"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((i) =>
 i.name.toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (i: DamageSpace) => i.name,
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) {
 toast.error("Nombre es requerido");
 return;
 }
 if (editingId) {
 updateMutation.mutate({ id: editingId, data: formData });
 } else {
 createMutation.mutate(formData);
 }
 };

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-blue-500 to-cyan-500">
 <Home />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Espacios de Daño</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canEdit("catalogos_inspeccion") && (
 <Button className="pg-btn-platinum gap-1.5" onClick={() => setMatrixOpen(true)}>
 <Grid3x3 className="h-3.5 w-3.5" />
 Matriz
 </Button>
 )}
 {canCreate("catalogos_inspeccion") && (
 <Button
 className="pg-btn-platinum gap-1.5"
 onClick={() => { setEditingId(null); setFormData({ name: "", description: "" }); setOpen(true); }}
 >
 <Plus className="h-3.5 w-3.5" />
 Nuevo
 </Button>
 )}
 </div>
 </div>

 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input placeholder="Buscar espacio..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th className="w-10"></th>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Espacio</SortableTh>
 <th>Descripción</th>
 <th>Aplica a</th>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : !paginatedData.length ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 ) : (
 paginatedData.map((item: DamageSpace) => (
 <tr key={item.id}>
 <td><StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Activo" : "Inactivo"} /></td>
 <td className="font-medium">{item.name}</td>
 <td className="text-[12px] text-muted-foreground">{item.description || "—"}</td>
 <td className="text-[11px]">
 <div className="flex flex-wrap gap-1">
 {(item.applicable_classifications || []).map((c: string) => (
 <span key={c} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>
 ))}
 </div>
 </td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos_inspeccion") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => {
 setEditingId(item.id);
 setFormData({ name: item.name, description: item.description || "" });
 setOpen(true);
 }}>
 <Pencil className="h-4 w-4" />
 </Button>
 )}
 {canDelete("catalogos_inspeccion") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => {
 if (confirm(`¿Desactivar "${item.name}"?`)) deleteMutation.mutate(item.id);
 }}>
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

 {/* Modal de crear/editar */}
 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
 <Home className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Espacio
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Cocina, Baño, Oficina..." className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Descripción</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción del espacio..." className="app-input" />
 </div>
 </div>
 <div className="modal-footer">
 <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
 <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">
 {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>

 {/* Matriz Espacios × Clasificaciones */}
 <SpaceClassificationMatrix
 open={matrixOpen}
 onOpenChange={setMatrixOpen}
 spaces={items || []}
 classifications={classifications}
 onSave={(updates) => matrixMutation.mutate(updates)}
 />
 </div>
 );
}
