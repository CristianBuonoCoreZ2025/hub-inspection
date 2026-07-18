"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getClaimTypes, createClaimType, updateClaimType, deleteClaimType } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Trash2, FileWarning, AlertCircle } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { ICON_MAP, ICON_OPTIONS } from "@/lib/claim-type-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

// Map icon names from lucide-react to actual icon components
// (ICON_MAP e ICON_OPTIONS importados desde @/lib/claim-type-icons)

export default function ClaimTypePage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState<{ name: string; description: string; icon: string }>({ name: "", description: "", icon: "FileWarning" });

 const { data: items, isLoading } = useQuery({
 queryKey: ["tipos_siniestros"],
 queryFn: getClaimTypes,
 });

 const createMutation = useMutation({
 mutationFn: createClaimType,
 onSuccess: () => {
 toast.success("Tipo de siniestro creado");
 queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
 setOpen(false);
 setFormData({ name: "", description: "", icon: "FileWarning" });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateClaimType>[1] }) => updateClaimType(id, input),
 onSuccess: () => {
 toast.success("Tipo de siniestro actualizado");
 queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
 setOpen(false);
 setEditingId(null);
 setFormData({ name: "", description: "", icon: "FileWarning" });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteClaimType,
 onSuccess: () => {
 toast.success("Tipo de siniestro desactivado");
 queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((c) =>
 [c.name, c.description].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (c) => c.name,
 description: (c) => c.description || "",
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
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-red-500 to-rose-500 text-white shadow-sm">
 <AlertCircle className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Tipos de Siniestro</h1>
 <p className="app-page-lead">Gestión de tipos de siniestros.</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canCreate("catalogos") && (
 <Button
 onClick={() => { setEditingId(null); setFormData({ name: "", description: "", icon: "FileWarning" }); setOpen(true); }}
 className="pg-btn-platinum"
 >
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
 <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripción</SortableTh>
 <th>Ícono</th>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 ) : (
 paginatedData.map((item) => {
 const IconComponent = ICON_MAP[item.icon || "FileWarning"] || FileWarning;
 return (
 <tr key={item.id}>
 <td><StatusBadge status="active" label="Activo" /></td>
 <td className="font-medium">{item.name}</td>
 <td className="text-muted-foreground">{item.description || "—"}</td>
 <td>
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
 <IconComponent className="h-4 w-4 text-muted-foreground" />
 </div>
 </td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setEditingId(item.id);
 setFormData({ name: item.name || "", description: item.description || "", icon: item.icon || "FileWarning" });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 );
 })
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
 <FileWarning className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Tipo de Siniestro
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Incendio" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Descripción</Label>
 <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción del tipo de siniestro" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Ícono</Label>
 <div className="grid grid-cols-8 gap-2">
 {ICON_OPTIONS.map((iconName) => {
 const IconComponent = ICON_MAP[iconName];
 return (
 <button
 key={iconName}
 type="button"
 onClick={() => setFormData({ ...formData, icon: iconName })}
 className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
 formData.icon === iconName
 ? "border-primary bg-primary/10 text-primary"
 : "border-input bg-background hover:bg-muted"
 }`}
 title={iconName}
 >
 <IconComponent className="h-5 w-5" />
 </button>
 );
 })}
 </div>
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
