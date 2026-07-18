"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getLookupCatalog, createLookupCatalogItem, updateLookupCatalogItem, deleteLookupCatalogItem } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from "@/components/ui/dialog";

interface LookupCatalogManagerProps {
 category: string;
 title: string;
 icon: React.ElementType;
 section?: string;
}

export function LookupCatalogManager({ category, title, icon: Icon, section = "catalogos_inspeccion" }: LookupCatalogManagerProps) {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({ name: "", code: "" });

 const { data: items, isLoading } = useQuery({
 queryKey: ["lookup-catalog-manage", category],
 queryFn: () => getLookupCatalog(category),
 });

 const createMutation = useMutation({
 mutationFn: (input: { category: string; name: string; code?: string }) =>
 createLookupCatalogItem({ ...input, code: input.code || undefined }),
 onSuccess: () => {
 toast.success(`${title} creado`);
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog-manage", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalogs"] });
 setOpen(false);
 setFormData({ name: "", code: "" });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: { name: string; code?: string } }) =>
 updateLookupCatalogItem(id, { name: input.name, code: input.code || undefined }),
 onSuccess: () => {
 toast.success(`${title} actualizado`);
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog-manage", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalogs"] });
 setOpen(false);
 setEditingId(null);
 setFormData({ name: "", code: "" });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteLookupCatalogItem,
 onSuccess: () => {
 toast.success(`${title} desactivado`);
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog-manage", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalog", category] });
 queryClient.invalidateQueries({ queryKey: ["lookup-catalogs"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = items?.filter((c) =>
 [c.name, c.code].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (i) => i.name,
 code: (i) => i.code || "",
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
 createMutation.mutate({ category, ...formData });
 }
 };

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <h1 className="app-page-title flex items-center gap-2 shrink-0">
 <Icon className="h-5 w-5" />
 {title}
 </h1>
 <div className="app-grid-filters">
 <Search className="h-4 w-4 text-muted-foreground shrink-0" />
 <Input
 placeholder="Buscar..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="app-input h-8 w-full sm:max-w-[180px]"
 />
 </div>
 {canCreate(section) && (
 <Button
 onClick={() => { setEditingId(null); setFormData({ name: "", code: "" }); setOpen(true); }}
 className="pg-btn-platinum"
 >
 Agregar
 </Button>
 )}
 </div>

 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th className="w-10"></th>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
 <SortableTh sortKey="code" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Código</SortableTh>
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
 <td><span className={`app-status-dot ${item.is_active ? "app-status-on" : "app-status-off"}`} /></td>
 <td className="font-medium">{item.name}</td>
 <td className="text-muted-foreground">{item.code || "—"}</td>
 <td>
 <div className="app-row-actions">
 {canEdit(section) && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setEditingId(item.id);
 setFormData({ name: item.name || "", code: item.code || "" });
 setOpen(true);
 }}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete(section) && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
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

 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <Icon className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} {title}
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-field">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Codigo</Label>
 <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Codigo (opcional)" className="app-input" />
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
