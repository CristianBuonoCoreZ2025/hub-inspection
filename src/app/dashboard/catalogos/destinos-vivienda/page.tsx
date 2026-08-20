"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getHousingDestinations, createHousingDestination, updateHousingDestination, deleteHousingDestination } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Ban, Warehouse, Home } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DESTINATION_TYPES: { value: "residential" | "commercial"; label: string }[] = [
  { value: "residential", label: "Habitacional" },
  { value: "commercial", label: "Comercial" },
];

const destinationTypeLabel = (t: string | null | undefined) =>
  DESTINATION_TYPES.find((d) => d.value === t)?.label ?? "—";

interface FormData {
  name: string;
  description: string;
  destination_type: "residential" | "commercial" | null;
}

export default function HousingDestinationPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState<FormData>({ name: "", description: "", destination_type: null });

 const { data: items, isLoading } = useQuery({
 queryKey: ["destinos_vivienda"],
 queryFn: getHousingDestinations,
 });

 const createMutation = useMutation({
 mutationFn: createHousingDestination,
 onSuccess: () => {
 toast.success("Destinos del Bien creado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 queryClient.invalidateQueries({ queryKey: ["housing-destinations"] });
 setOpen(false);
 setFormData({ name: "", description: "", destination_type: null });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateHousingDestination>[1] }) => updateHousingDestination(id, input),
 onSuccess: () => {
 toast.success("Destinos del Bien actualizado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 queryClient.invalidateQueries({ queryKey: ["housing-destinations"] });
 setOpen(false);
 setEditingId(null);
 setFormData({ name: "", description: "", destination_type: null });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteHousingDestination,
 onSuccess: () => {
 toast.success("Destinos del Bien desactivado");
 queryClient.invalidateQueries({ queryKey: ["destinos_vivienda"] });
 queryClient.invalidateQueries({ queryKey: ["housing-destinations"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((c) =>
 [c.name, c.description, destinationTypeLabel(c.destination_type)].join(" ").toLowerCase().includes(search.toLowerCase())
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
 if (!formData.destination_type) {
 toast.error("Debe seleccionar un tipo de destino");
 return;
 }
 const payload = { name: formData.name, description: formData.description, destination_type: formData.destination_type };
 if (editingId) {
 updateMutation.mutate({ id: editingId, input: payload });
 } else {
 createMutation.mutate(payload);
 }
 };

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon icn-emerald">
 <Home />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Destinos del Bien</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); setFormData({ name: "", description: "", destination_type: null }); setOpen(true); }} className="pg-btn-platinum">
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
 <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh>
 <th>Tipo</th>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 ) : (
 paginatedData.map((item) => (
 <tr key={item.id}>
 <td><StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Activo" : "Inactivo"} /></td>
 <td className="font-medium">{item.name}</td>
 <td className="font-medium">{item.description}</td>
 <td className="font-medium">{destinationTypeLabel(item.destination_type)}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <button type="button" className="btn-icon-sm" onClick={() => {
 setEditingId(item.id);
 setFormData({ name: item.name || "", description: item.description || "", destination_type: item.destination_type ?? null });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></button>
 )}
 {canDelete("catalogos") && (
 <button type="button" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
 <Ban className="h-4 w-4" />
 </button>
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
 <div className="flex h-8 w-8 items-center justify-center rounded-lg icn-sky text-white shadow-sm">
 <Warehouse className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Destinos del Bien
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body modal-grid">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Descripcion</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripcion" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Tipo <span className="text-red-500">*</span></Label>
 <Select
 value={formData.destination_type ?? undefined}
 onValueChange={(v) => setFormData({ ...formData, destination_type: v as "residential" | "commercial" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {DESTINATION_TYPES.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
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
