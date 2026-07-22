"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getRelationships, createRelationship, updateRelationship, deleteRelationship } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Ban, Heart, Users } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

export default function RelationshipPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState<{ name: string }>({"name":""});

 const { data: items, isLoading } = useQuery({
 queryKey: ["parentescos"],
 queryFn: getRelationships,
 });

 const createMutation = useMutation({
 mutationFn: createRelationship,
 onSuccess: () => {
 toast.success("Parentescos creado");
 queryClient.invalidateQueries({ queryKey: ["parentescos"] });
 setOpen(false);
 setFormData({"name":""});
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateRelationship>[1] }) => updateRelationship(id, input),
 onSuccess: () => {
 toast.success("Parentescos actualizado");
 queryClient.invalidateQueries({ queryKey: ["parentescos"] });
 setOpen(false);
 setEditingId(null);
 setFormData({"name":""});
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteRelationship,
 onSuccess: () => {
 toast.success("Parentescos desactivado");
 queryClient.invalidateQueries({ queryKey: ["parentescos"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((c) =>
 [c.name].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (c) => c.name,
 }, "name");
 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) {
 toast.error("Nombre es requerido");
 return;
 }
 if (editingId) {
 updateMutation.mutate({ id: editingId, input: formData });
 } else {
 createMutation.mutate(formData);
 }
 };

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-pink-500 to-rose-500">
 <Users />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Parentescos</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); setFormData({"name":""}); setOpen(true); }} className="pg-btn-platinum">
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
 <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th className="w-10"></th>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={3} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 ) : (
 paginatedData.map((item) => (
 <tr key={item.id}>
 <td><StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Activo" : "Inactivo"} /></td>
 <td className="font-medium">{item.name}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={(e) => { e.stopPropagation();
 setEditingId(item.id);
 setFormData({ name: item.name || "" });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
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

 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <Heart className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Parentescos
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
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
 </div>
 );
}
