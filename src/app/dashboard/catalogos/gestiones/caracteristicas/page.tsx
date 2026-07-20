"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
 getActionFeatures,
 createActionFeature,
 updateActionFeature,
 deleteActionFeature,
 getActionTemplates,
} from "@/services/actions";
import { getGestionScreens } from "@/services/gestion-screens";
import type { GestionScreen } from "@/types";
import { toast } from "sonner";
import { Pencil, Ban, Boxes, Layers, LayoutTemplate, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useTableSort } from "@/hooks/use-table-sort";
import { ToggleChip } from "@/components/ui/toggle-chip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
} from "@/components/ui/dialog";
import { SortableTh } from "@/components/ui/sortable-th";
import type { ActionFeature } from "@/services/actions";

export default function CaracteristicasPage() {
 const router = useRouter();
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [formData, setFormData] = useState({
 name: "",
 code: "",
 has_specific_screen: false,
 has_template: false,
 max_review_levels: 1,
 screen_id: "",
 });

 const { data: features, isLoading, error } = useQuery({
 queryKey: ["action-features"],
 queryFn: getActionFeatures,
 });

 // Sort
 const { sorted: sortedFeatures, sortKey, sortDir, toggleSort } = useTableSort(features, {
 code: (f: ActionFeature) => f.code || "",
 name: (f: ActionFeature) => f.name,
 max_review_levels: (f: ActionFeature) => f.max_review_levels,
 }, "name");

 // Gestiones existentes — para saber si una característica tiene gestiones asociadas
 const { data: templates } = useQuery({
 queryKey: ["action-templates-all"],
 queryFn: () => getActionTemplates(),
 });

 const { data: screens } = useQuery({
 queryKey: ["gestion-screens"],
 queryFn: () => getGestionScreens(),
 });

 const featureHasGestions = (featureId: string) =>
 (templates || []).some(t => t.action_features_id === featureId);

 // Mutations
 const createMut = useMutation({
 mutationFn: createActionFeature,
 onSuccess: () => { toast.success("Característica creada"); queryClient.invalidateQueries({ queryKey: ["action-features"] }); setOpen(false); resetForm(); },
 onError: (e: Error) => toast.error(e.message),
 });
 const updateMut = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateActionFeature>[1] }) => updateActionFeature(id, input),
 onSuccess: () => { toast.success("Característica actualizada"); queryClient.invalidateQueries({ queryKey: ["action-features"] }); setOpen(false); setEditingId(null); },
 onError: (e: Error) => toast.error(e.message),
 });
 const deleteMut = useMutation({
 mutationFn: deleteActionFeature,
 onSuccess: () => { toast.success("Característica desactivada"); queryClient.invalidateQueries({ queryKey: ["action-features"] }); },
 onError: (e: Error) => toast.error(e.message),
 });

 const resetForm = () => setFormData({ name: "", code: "", has_specific_screen: false, has_template: false, max_review_levels: 1, screen_id: "" });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (!editingId && !formData.code.trim()) { toast.error("El código es requerido"); return; }
 if (editingId) { updateMut.mutate({ id: editingId, input: formData }); }
 else { createMut.mutate(formData); }
 };

 // Tipo de gestión derivado — ahora siempre es una pantalla, el tipo indica
 // si además genera documentos
 const getTipo = (f: { has_template: boolean }) => {
 return f.has_template ? "Pantalla + Documentos" : "Pantalla";
 };

 const tipoColor: Record<string, string> = {
 "Pantalla": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
 "Pantalla + Documentos": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
 };

 return (
 <div className="app-page">
 {/* Header compacto: título + Agregar en una sola fila */}
 <div className="flex items-center gap-3 mb-3">
 <h1 className="app-page-title flex items-center gap-2 shrink-0">
 <Boxes className="h-5 w-5" />
 Características
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
 <th>Tipo</th>
 <th>Pantalla Asociada</th>
 <SortableTh sortKey="max_review_levels" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Max. niveles</SortableTh>
 <th className="w-[80px]"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : error ? <tr><td colSpan={6} className="text-center text-red-500 py-4">Error al cargar características: {error instanceof Error ? error.message : "Error desconocido"}</td></tr>
 : sortedFeatures.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : sortedFeatures.map((f) => (
 <tr key={f.id}>
 <td className="font-mono font-semibold text-primary">{f.code || "—"}</td>
 <td className="font-medium">{f.name}</td>
 <td>
 <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${tipoColor[getTipo(f)]}`}>
 {getTipo(f)}
 </span>
 </td>
 <td className="text-muted-foreground">{f.screen?.name || "Genérica"}</td>
 <td className="text-center font-mono">{f.max_review_levels}</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
 setEditingId(f.id);
 setFormData({
 name: f.name,
 code: f.code || "",
 has_specific_screen: f.has_specific_screen,
 has_template: f.has_template,
 max_review_levels: f.max_review_levels,
 screen_id: f.screen_id || "",
 });
 setOpen(true);
 }}>
 <Pencil className="h-4 w-4" />
 </Button>
 )}
 {canEdit("catalogos") && f.screen_id && f.screen?.is_dynamic !== false && (
 <Button
 variant="ghost"
 size="icon"
 className="btn-neutral btn-icon"
 onClick={() => router.push(`/dashboard/catalogos/pantallas/${f.screen_id}`)}
 title="Diseñar pantalla"
 >
 <LayoutTemplate className="h-4 w-4" />
 </Button>
 )}
 {canDelete("catalogos") && !featureHasGestions(f.id) && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar esta característica?")) deleteMut.mutate(f.id); }}>
 <Ban className="h-4 w-4" />
 </Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Dialog: crear/editar característica */}
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogContent className="modal-sm">
 <div className="modal-header">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <Boxes className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nueva"} Característica
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-3">
 {/* Código + Nombre */}
 <div className="grid grid-cols-[120px_1fr] gap-3">
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">
 Código {!editingId && <span className="text-red-500">*</span>}
 {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
 </Label>
 <Input
 value={formData.code}
 onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().slice(0, 3) })}
 placeholder="Ej: INS"
 className="app-input font-mono"
 disabled={!!editingId}
 required={!editingId}
 />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Inspección" className="app-input" />
 </div>
 </div>

 {/* Pantalla asociada — siempre visible (toda gestión usa una pantalla) */}
 <div className="flex flex-col gap-1.5">
 <Label className="app-field-label">Pantalla asociada <span className="text-red-500">*</span></Label>
 <Select
 value={formData.screen_id || "__none"}
 onValueChange={(v) => setFormData({ ...formData, screen_id: v === "__none" ? "" : (v ?? ""), has_specific_screen: true })}
 items={[
 { value: "__none", label: "Pantalla genérica (JSON libre)" },
 ...(screens?.map((s) => {
 const fields = Array.isArray(s.form_schema?.fields) ? s.form_schema.fields as string[] : [];
 const label = s.is_dynamic === false
 ? `${s.name} (fija)`
 : `${s.name} ${fields.length ? `(${fields.length} campos)` : ""}`;
 return { value: s.id, label };
 }) || []),
 ]}
 >
 <SelectTrigger className="app-input h-7 w-full">
 <SelectValue placeholder="Pantalla genérica (JSON libre)" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Pantalla genérica (JSON libre)</SelectItem>
 {screens?.map((s) => {
 const fields = Array.isArray(s.form_schema?.fields) ? s.form_schema.fields as string[] : [];
 const label = s.is_dynamic === false
 ? `${s.name} (fija)`
 : `${s.name} ${fields.length ? `(${fields.length} campos)` : ""}`;
 return (
 <SelectItem key={s.id} value={s.id}>
 {label}
 </SelectItem>
 );
 })}
 </SelectContent>
 </Select>
 <ScreenHelpPanel screen={screens?.find(s => s.id === formData.screen_id)} />
 </div>

 {/* ¿Genera documentos? — toggle independiente */}
 <div className="flex flex-col gap-1.5">
 <Label className="app-field-label">Generación de documentos</Label>
 <div className="flex items-center gap-2 flex-wrap">
 <ToggleChip
 active={formData.has_template}
 onClick={(v) => setFormData({ ...formData, has_template: v, has_specific_screen: true })}
 icon={<FileText className="h-3 w-3" />}
 >
 Con plantillas de documento
 </ToggleChip>
 {formData.has_template && (
 <span className="text-[10px] text-muted-foreground">
 Permite asociar .docx que se rellenan con datos del siniestro al emitir
 </span>
 )}
 </div>
 </div>

 {/* Max niveles de revisión */}
 <div className="flex flex-col gap-1.5">
 <Label className="app-field-label flex items-center gap-1.5">
 <Layers className="h-3.5 w-3.5" />
 Niveles máximos de revisión
 </Label>
 <div className="grid grid-cols-4 gap-2">
 {[
 { n: 0, top: "Sin", bottom: "workflow" },
 { n: 1, top: "Emisión", bottom: "" },
 { n: 2, top: "Emisión +", bottom: "Revisión" },
 { n: 3, top: "Emisión + Revisión +", bottom: "Aprobación" },
 ].map(({ n, top, bottom }) => (
 <button
 key={n}
 type="button"
 onClick={() => setFormData({ ...formData, max_review_levels: n })}
 className={`rounded-lg border p-2 text-center transition-colors ${
 formData.max_review_levels === n
 ? "border-primary bg-primary/10 text-primary font-semibold"
 : "border-border text-muted-foreground hover:bg-muted/50"
 }`}
 >
 <div className="text-[16px] font-mono">{n}</div>
 <div className="text-[9px] leading-tight">{top}</div>
 {bottom && <div className="text-[9px] leading-tight">{bottom}</div>}
 </button>
 ))}
 </div>
 <p className="text-[10px] text-muted-foreground">
 Las gestiones pueden reducir niveles pero nunca exceder este máximo.
 </p>
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

function ScreenHelpPanel({ screen }: { screen: GestionScreen | undefined }) {
 if (!screen) {
 return (
 <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
 Pantalla genérica: permite editar los datos de la gestión en formato JSON libre.
 </div>
 );
 }

 const fields = Array.isArray(screen.form_schema?.fields) ? (screen.form_schema.fields as { id?: string; code?: string; label?: string; type?: string }[]) : [];

 return (
 <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
 <div className="flex items-center gap-2">
 <span className="text-[12px] font-semibold">{screen.name}</span>
 </div>
 {screen.description && (
 <p className="text-[11px] text-muted-foreground">{screen.description}</p>
 )}
 {fields.length > 0 && (
 <div>
 <p className="text-[10px] font-medium text-muted-foreground mb-1">Campos del formulario:</p>
 <div className="flex flex-wrap gap-1">
 {fields.map((field) => {
 const key = field.id || field.code || `${field.type}-${field.label}`;
 const label = field.label || field.code || field.id || field.type || 'campo';
 return (
 <span key={key} className="inline-flex rounded bg-muted px-2 py-0.5 text-[10px]">
 {label}
 </span>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
}
