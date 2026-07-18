"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getHousingDestinations, createHousingDestination, updateHousingDestination, deleteHousingDestination } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Warehouse, Home, Settings2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { HousingDestination } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldConfigEditor } from "@/components/ui/field-config-editor";

export default function HousingDestinationPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState<{ name: string; description: string }>({"name":"","description":""});
 const [configOpen, setConfigOpen] = useState(false);
 const [configItem, setConfigItem] = useState<HousingDestination | null>(null);

 const { data: items, isLoading } = useQuery({
 queryKey: ["destinos_vivienda"],
 queryFn: getHousingDestinations,
 });

 const createMutation = useMutation({
 mutationFn: createHousingDestination,
 onSuccess: () => {
 toast.success("Destinos del Bien creado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 setOpen(false);
 setFormData({"name":"","description":""});
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateHousingDestination>[1] }) => updateHousingDestination(id, input),
 onSuccess: () => {
 toast.success("Destinos del Bien actualizado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 setOpen(false);
 setEditingId(null);
 setFormData({"name":"","description":""});
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateConfigMutation = useMutation({
 mutationFn: ({ id, config }: { id: string; config: any }) => updateHousingDestination(id, { field_config: config }),
 onSuccess: () => {
 toast.success("Configuración de campos actualizada");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteHousingDestination,
 onSuccess: () => {
 toast.success("Destinos del Bien desactivado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((c) =>
 [c.name, c.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (c) => c.name,
 description: (c) => c.description,
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
 <div className="app-page-header">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
 <Home className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Destinos del Bien</h1>
 <p className="app-page-lead">Gestión de destinos del bien.</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); setFormData({"name":"","description":""}); setOpen(true); }} className="pg-btn-platinum">
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
 <thead>
 <tr>
 <th className="w-10"></th>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
 <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 ) : (
 paginatedData.map((item) => (
 <tr key={item.id}>
 <td><StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Activo" : "Inactivo"} /></td>
 <td className="font-medium">{item.name}</td>
 <td className="font-medium">{item.description}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setEditingId(item.id);
 setFormData({ name: item.name || "", description: item.description || "" });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setConfigItem(item);
 setConfigOpen(true);
 }}><Settings2 className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
 <Trash2 className="h-4 w-4" />
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
 <Warehouse className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Destinos del Bien
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Descripcion</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripcion" className="app-input" />
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

 {configItem && (
 <FieldConfigEditor
 open={configOpen}
 onOpenChange={setConfigOpen}
 currentConfig={configItem.field_config as any}
 onSave={(config) => updateConfigMutation.mutate({ id: configItem.id, config })}
 itemName={configItem.name}
 />
 )}
 </div>
 );
}
