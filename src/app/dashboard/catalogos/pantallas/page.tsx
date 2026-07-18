"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pencil, Trash2, LayoutTemplate, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useTableSort } from "@/hooks/use-table-sort";
import { SortableTh } from "@/components/ui/sortable-th";
import {
 getGestionScreens,
 createGestionScreen,
 updateGestionScreenBase,
 deactivateGestionScreen,
} from "@/services/gestion-screens";
import type { GestionScreen } from "@/types";
import { toast } from "sonner";

export default function PantallasPage() {
 const router = useRouter();
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({
 code: "",
 name: "",
 description: "",
 icon: "",
 sort_order: 0,
 });

 const { data: screens, isLoading } = useQuery({
 queryKey: ["gestion-screens"],
 queryFn: () => getGestionScreens(),
 });

 const { sorted: sortedScreens, sortKey, sortDir, toggleSort } = useTableSort(screens, {
 code: (s: GestionScreen) => s.code,
 name: (s: GestionScreen) => s.name,
 sort_order: (s: GestionScreen) => s.sort_order,
 }, "sort_order");

 const createMut = useMutation({
 mutationFn: createGestionScreen,
 onSuccess: () => { toast.success("Pantalla creada"); queryClient.invalidateQueries({ queryKey: ["gestion-screens"] }); setOpen(false); resetForm(); },
 onError: (e: Error) => toast.error(e.message),
 });

 const updateMut = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateGestionScreenBase>[1] }) => updateGestionScreenBase(id, input),
 onSuccess: () => { toast.success("Pantalla actualizada"); queryClient.invalidateQueries({ queryKey: ["gestion-screens"] }); setOpen(false); setEditingId(null); },
 onError: (e: Error) => toast.error(e.message),
 });

 const deactivateMut = useMutation({
 mutationFn: deactivateGestionScreen,
 onSuccess: () => { toast.success("Pantalla desactivada"); queryClient.invalidateQueries({ queryKey: ["gestion-screens"] }); },
 onError: (e: Error) => toast.error(e.message),
 });

 const resetForm = () => setFormData({ code: "", name: "", description: "", icon: "", sort_order: 0 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (!editingId && !formData.code.trim()) { toast.error("El código es requerido"); return; }
 if (editingId) { updateMut.mutate({ id: editingId, input: formData }); }
 else { createMut.mutate({ ...formData, code: formData.code.toUpperCase() }); }
 };

 const getFieldCount = (s: GestionScreen) => {
 const fields = Array.isArray(s.form_schema?.fields) ? s.form_schema.fields : [];
 return fields.length;
 };

 const getFieldsPreview = (s: GestionScreen) => {
 const fields = Array.isArray(s.form_schema?.fields) ? s.form_schema.fields as { label: string }[] : [];
 return fields.slice(0, 4).map((f) => f.label).join(", ");
 };

 return (
 <div className="app-page">
 <div className="flex items-center gap-3 mb-3">
 <h1 className="app-page-title flex items-center gap-2 shrink-0">
 <Monitor className="h-5 w-5" />
 Pantallas
 </h1>
 <div className="flex-1" />
 {canCreate("catalogos") && (
 <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="pg-btn-platinum">
 Nueva
 </Button>
 )}
 </div>

 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <SortableTh sortKey="code" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Código</SortableTh>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
 <th>Descripción</th>
 <th>Campos</th>
 <SortableTh sortKey="sort_order" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Orden</SortableTh>
 <th className="w-[100px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : sortedScreens.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron pantallas.</td></tr>
 : sortedScreens.map((s) => (
 <tr key={s.id}>
 <td className="font-mono font-semibold text-primary">
 {s.code}
 {!s.is_dynamic && (
 <span className="ml-2 text-[10px] text-amber-600 font-normal">(fija)</span>
 )}
 </td>
 <td className="font-medium">{s.name}</td>
 <td className="text-muted-foreground max-w-[280px] truncate">{s.description || "—"}</td>
 <td className="text-muted-foreground">
 {s.is_dynamic ? (
 <>{getFieldCount(s)} campos{getFieldCount(s) > 0 && <span className="block truncate max-w-[220px]">{getFieldsPreview(s)}</span>}</>
 ) : (
 <span className="text-amber-600">Componente fijo</span>
 )}
 </td>
 <td className="text-center font-mono">{s.sort_order}</td>
 <td>
 <div className="app-row-actions">
 {s.is_dynamic && canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setEditingId(s.id);
 setFormData({
 code: s.code,
 name: s.name,
 description: s.description || "",
 icon: s.icon || "",
 sort_order: s.sort_order,
 });
 setOpen(true);
 }}>
 <Pencil className="h-4 w-4" />
 </Button>
 )}
 {s.is_dynamic && canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => router.push(`/dashboard/catalogos/pantallas/${s.id}`)} title="Diseñar pantalla">
 <LayoutTemplate className="h-4 w-4" />
 </Button>
 )}
 {s.is_dynamic && canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta pantalla?")) deactivateMut.mutate(s.id); }}>
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Dialog: crear/editar pantalla */}
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogContent className="modal-sm">
 <div className="modal-header">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <Monitor className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nueva"} Pantalla
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-3">
 <div className="grid grid-cols-[120px_1fr] gap-3">
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">
 Código {!editingId && <span className="text-red-500">*</span>}
 {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
 </Label>
 <Input
 value={formData.code}
 onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().slice(0, 20) })}
 placeholder="Ej: EMAIL"
 className="app-input font-mono"
 disabled={!!editingId}
 required={!editingId}
 />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Email / Aviso" className="app-input" />
 </div>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">Descripción</Label>
 <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe qué datos captura esta pantalla" className="app-input" rows={3} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">Icono (Lucide)</Label>
 <Input value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} placeholder="Ej: mail" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">Orden</Label>
 <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} className="app-input" />
 </div>
 </div>
 </div>
 <div className="modal-footer">
 <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
 <Button type="submit" size="sm" disabled={createMut.isPending || updateMut.isPending} className="pg-btn-platinum">
 {createMut.isPending || updateMut.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
