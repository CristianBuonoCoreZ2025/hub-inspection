"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDamages, createDamage, updateDamage, deleteDamage, getThirdParties, getEvidences } from "@/services/inspections";
import { getDamageSpaces, getContentGoodTypes, getBuildingDamageCategories, getCountryCurrencies } from "@/services/catalogs";
import { toast } from "sonner";
import { Trash2, Pencil, Building2, Package, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import type { InspectionDamage } from "@/types";

const severityLabels: Record<string, string> = {
 low: "Leve",
 medium: "Moderado",
 high: "Grave",
 total: "Total",
};

const severityOptions = [
 { value: "low", label: "Leve" },
 { value: "medium", label: "Moderado" },
 { value: "high", label: "Grave" },
 { value: "total", label: "Total" },
];

const unitOptions = ["UND", "M2", "M3", "KG", "LT", "MT", "GLB"];

// Opciones de moneda se construyen dinámicamente desde countryCurrencies en el componente

type DamageType = "building" | "content";

interface DamageForm {
 session_id: string;
 category: string;
 subcategory: string;
 description: string;
 observations: string;
 severity: InspectionDamage["severity"];
 dependency: string;
 sector: string;
 materiality_type: string;
 unit: string;
 quantity: number;
 length: number | null;
 width: number | null;
 height: number | null;
 damage_type: DamageType;
 product: string;
 brand_model: string;
 purchase_date: string;
 estimated_amount: number;
 currency: string;
 third_party_id: string;
 space_id: string;
 content_good_type_id: string;
 building_damage_category_id: string;
}

function emptyForm(sessionId: string, type: DamageType): DamageForm {
 return {
 session_id: sessionId,
 category: type === "building" ? "structural" : "content",
 subcategory: "",
 description: "",
 observations: "",
 severity: "low",
 dependency: "",
 sector: "",
 materiality_type: "",
 unit: "",
 quantity: 0,
 length: null,
 width: null,
 height: null,
 damage_type: type,
 product: "",
 brand_model: "",
 purchase_date: "",
 estimated_amount: 0,
 currency: "CLP",
 third_party_id: "",
 space_id: "",
 content_good_type_id: "",
 building_damage_category_id: "",
 };
}

function computeQuantity(unit: string, length: number | null, width: number | null, height: number | null): number {
  if (unit === "M2") return (length || 0) * (width || 0);
  if (unit === "M3") return (length || 0) * (width || 0) * (height || 0);
  return 0;
}

function damageToForm(d: InspectionDamage): DamageForm {
 return {
 session_id: d.session_id,
 category: d.category ?? "structural",
 subcategory: d.subcategory ?? "",
 description: d.description ?? "",
 observations: d.observations ?? "",
 severity: d.severity ?? "low",
 dependency: d.dependency ?? "",
 sector: d.sector ?? "",
 materiality_type: d.materiality_type ?? "",
 unit: d.unit ?? "",
 quantity:
   d.unit === "M2" || d.unit === "M3"
     ? computeQuantity(d.unit, d.length, d.width, d.height)
     : (d.quantity ?? 0),
 length: d.length ?? null,
 width: d.width ?? null,
 height: d.height ?? null,
 damage_type: d.damage_type === "content" ? "content" : "building",
 product: d.product ?? "",
 brand_model: d.brand_model ?? "",
 purchase_date: d.purchase_date ?? "",
 estimated_amount: d.estimated_amount ?? 0,
 currency: d.currency ?? "CLP",
 third_party_id: d.third_party_id ?? "",
 space_id: d.space_id ?? "",
 content_good_type_id: d.content_good_type_id ?? "",
 building_damage_category_id: d.building_damage_category_id ?? "",
 };
}

export default function DamagesTab({ sessionId, propertyClassification, countryId, sessionStatus }: { sessionId: string; propertyClassification?: string | null; countryId?: string | null; sessionStatus?: string }) {
 const queryClient = useQueryClient();
 const [editing, setEditing] = useState<string | null>(null);
 const [form, setForm] = useState<DamageForm>(emptyForm(sessionId, "building"));
 const [newType, setNewType] = useState<DamageType>("building");
 const [amountRaw, setAmountRaw] = useState("");
 const [amountFocused, setAmountFocused] = useState(false);
 const [contentDocType, setContentDocType] = useState("Boleta");
 const [contentDocFile, setContentDocFile] = useState<File | null>(null);
 const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

 const formatAmount = (value: number) =>
   new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

 const parseAmount = (value: string): number => {
   if (!value) return 0;
   if (value.includes(",")) {
     const n = Number(value.replace(/\./g, "").replace(/,/g, "."));
     return isNaN(n) ? 0 : n;
   }
   const parts = value.split(".");
   if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
     const n = Number(value.replace(/\./g, ""));
     return isNaN(n) ? 0 : n;
   }
   const n = Number(value);
   return isNaN(n) ? 0 : n;
 };

 const handleDimensionChange = (field: "length" | "width" | "height", value: string) => {
   setForm((prev) => {
     const next = { ...prev, [field]: value ? Number(value) : null } as DamageForm;
     const quantity =
       next.unit === "M2" || next.unit === "M3"
         ? computeQuantity(next.unit, next.length, next.width, next.height)
         : prev.quantity;
     return { ...next, quantity };
   });
 };

 const handleUnitChange = (unit: string) => {
   setForm((prev) => {
     const quantity =
       unit === "M2" || unit === "M3"
         ? computeQuantity(unit, prev.length, prev.width, prev.height)
         : prev.quantity;
     return { ...prev, unit, quantity };
   });
 };

 const { data: damages, isLoading } = useQuery({
 queryKey: ["damages", sessionId],
 queryFn: () => getDamages(sessionId),
 });

 const { data: evidences } = useQuery({
 queryKey: ["evidences", sessionId],
 queryFn: () => getEvidences(sessionId),
 enabled: !!sessionId,
 });

 const { data: spaces = [] } = useQuery({
 queryKey: ["damage-spaces"],
 queryFn: getDamageSpaces,
 staleTime: 1000 * 60 * 30,
 });

 const { data: goodTypes = [] } = useQuery({
 queryKey: ["content-good-types"],
 queryFn: getContentGoodTypes,
 staleTime: 1000 * 60 * 30,
 });

 const { data: buildingCategories = [] } = useQuery({
 queryKey: ["building-damage-categories"],
 queryFn: getBuildingDamageCategories,
 staleTime: 1000 * 60 * 30,
 });

 // Monedas filtradas por país del siniestro
 const { data: countryCurrencies = [] } = useQuery({
 queryKey: ["country-currencies", countryId],
 queryFn: () => getCountryCurrencies(countryId),
 staleTime: 1000 * 60 * 30,
 });

 // Construir opciones de moneda desde el catálogo del país
 // Fallback: si no hay monedas configuradas, usar CLP
 const currencyOptions = countryCurrencies.length > 0
 ? countryCurrencies.map((c) => ({
 value: c.code || c.name,
 label: `${c.code} — ${c.name}`,
 }))
 : [{ value: "CLP", label: "CLP — Peso Chileno" }];

 const { data: thirdParties = [] } = useQuery({
 queryKey: ["third-parties", sessionId],
 queryFn: () => getThirdParties(sessionId),
 staleTime: 1000 * 60 * 5,
 });

 // Terceros afectados (para asociar daños)
 const affectedThirdParties = thirdParties.filter((t) => t.party_type === "afectado");
 const evidenceDocs = (evidences || []).filter((e) => e.damage_id === editing);

 // Filtrar espacios según la clasificación del inmueble
 const filteredSpaces = propertyClassification
 ? spaces.filter((s) =>
 !s.applicable_classifications ||
 s.applicable_classifications.length === 0 ||
 s.applicable_classifications.includes(propertyClassification) ||
 s.applicable_classifications.includes("Otros")
 )
 : spaces;

 const createMutation = useMutation({
 mutationFn: createDamage,
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
 setForm(emptyForm(sessionId, newType));
 setEditing(null);
 toast.success("Daño registrado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, data }: { id: string; data: Partial<InspectionDamage> }) =>
 updateDamage(id, data),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
 setEditing(null);
 toast.success("Daño actualizado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteMutation = useMutation({
 mutationFn: deleteDamage,
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
 toast.success("Daño eliminado");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const uploadDocMutation = useMutation({
 mutationFn: async ({
   file,
   documentType,
   damageId,
 }: {
   file: File;
   documentType: string;
   damageId: string;
 }) => {
   const data = new FormData();
   data.append("file", file);
   data.append("sessionId", sessionId);
   data.append("damageId", damageId);
   data.append("documentType", documentType);
   data.append("originalName", file.name);
   const res = await fetch("/api/inspection/evidences/upload", {
     method: "POST",
     body: data,
   });
   if (!res.ok) {
     const err = await res.json().catch(() => ({ error: "Error al subir comprobante" }));
     throw new Error(err.error || "Error al subir comprobante");
   }
   return res.json();
 },
 onSuccess: () => {
   toast.success("Comprobante subido");
   setContentDocFile(null);
   queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
   queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const isEditingNew = editing === "new";
 const buildingDamages = damages?.filter((d) => d.damage_type !== "content") || [];
 const contentDamages = damages?.filter((d) => d.damage_type === "content") || [];

 // Totales agrupados por moneda
 const totalsByCurrency: Record<string, { building: number; content: number }> = {};
 for (const d of damages || []) {
 const cur = d.currency || "CLP";
 if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { building: 0, content: 0 };
 if (d.damage_type === "content") {
 totalsByCurrency[cur].content += d.estimated_amount || 0;
 } else {
 totalsByCurrency[cur].building += d.estimated_amount || 0;
 }
 }
 const currencyTotals = Object.entries(totalsByCurrency).map(([cur, t]) => ({
 currency: cur,
 building: t.building,
 content: t.content,
 total: t.building + t.content,
 }));

 const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name || "—";
 const goodTypeName = (id: string | null) => goodTypes.find((g) => g.id === id)?.name || "—";
 const bldCategoryName = (id: string | null) => buildingCategories.find((c) => c.id === id)?.name || "—";

 const handleSubmit = () => {
 // Convertir "" y 0 a null para campos opcionales de la API
 const payload = {
 ...form,
 subcategory: form.subcategory || null,
 observations: form.observations || null,
 dependency: form.dependency || null,
 sector: form.sector || null,
 materiality_type: form.materiality_type || null,
 unit: form.unit || null,
 quantity: form.quantity || null,
 product: form.product || null,
 brand_model: form.brand_model || null,
 purchase_date: form.purchase_date || null,
 estimated_amount: form.estimated_amount || null,
 currency: form.currency || "CLP",
 third_party_id: form.third_party_id || null,
 space_id: form.space_id || null,
 content_good_type_id: form.content_good_type_id || null,
 building_damage_category_id: form.building_damage_category_id || null,
 };
 if (editing === "new") {
 createMutation.mutate(payload);
 } else if (editing) {
 updateMutation.mutate({ id: editing, data: payload });
 }
 };

 const startNew = (type: DamageType) => {
 setNewType(type);
 setForm(emptyForm(sessionId, type));
 setEditing("new");
 };

 return (
 <div className="app-stack">
 {/* Banner de solo lectura */}
 {readOnly && (
 <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 app-body text-amber-700 dark:text-amber-300">
 <Lock className="h-3.5 w-3.5 shrink-0" />
 Inspección finalizada — los daños son de solo lectura
 </div>
 )}

 {/* Header con totales por moneda */}
 <div className="flex items-center justify-between">
 <div className="app-body text-muted-foreground">
 {damages?.length || 0} registros ·{" "}
 {currencyTotals.length === 0 ? (
 <span className="font-semibold text-foreground">$0</span>
 ) : currencyTotals.map((t, i) => (
 <span key={t.currency}>
 {i > 0 && " · "}
 <span className="font-semibold text-foreground">
 {t.currency} {t.total.toLocaleString("es-CL")}
 </span>
 <span className="app-body ml-1">
 (Const: {t.currency} {t.building.toLocaleString("es-CL")} · Cont: {t.currency} {t.content.toLocaleString("es-CL")})
 </span>
 </span>
 ))}
 </div>
 </div>

 {/* Botones de nuevo daño — estilo tiles */}
 {!isEditingNew && !readOnly && (
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => startNew("building")}
 className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
 >
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 transition-colors group-hover:bg-blue-500 group-hover:text-white">
 <Building2 className="h-5 w-5" />
 </div>
 <div className="min-w-0">
 <div className="app-title text-foreground">Daño Constructivo</div>
 <div className="app-body text-muted-foreground truncate">Estructura, muros, pisos, techumbre, instalaciones</div>
 </div>
 </button>
 <button
 onClick={() => startNew("content")}
 className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-violet-400/50 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
 >
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400 transition-colors group-hover:bg-violet-500 group-hover:text-white">
 <Package className="h-5 w-5" />
 </div>
 <div className="min-w-0">
 <div className="app-title text-foreground">Daño de Contenido</div>
 <div className="app-body text-muted-foreground truncate">Electrodomésticos, electrónica, muebles, ropa, joyas</div>
 </div>
 </button>
 </div>
 )}

 {/* Formulario */}
 {editing !== null && (
 <div className="app-panel space-y-3" key={`edit-${editing}-${form.damage_type}`}>
 <h3 className="app-section-title flex items-center gap-2">
 {form.damage_type === "building" ? <Building2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
 {editing === "new" ? "Nuevo" : "Editar"} {form.damage_type === "building" ? "Daño Constructivo" : "Daño de Contenido"}
 </h3>

 {form.damage_type === "building" ? (
 /* ── FORMULARIO CONSTRUCTIVO ── */
 <div className="modal-grid-3" key="building-form">
 <div className="modal-field">
 <label className="app-field-label">Espacio / Recinto</label>
 <Select
 value={form.space_id || ""}
 items={filteredSpaces.map((s) => ({ value: s.id, label: s.name }))}
 onValueChange={(v) => {
 const space = spaces.find((s) => s.id === v);
 setForm({ ...form, space_id: v || "", dependency: space?.name || "" });
 }}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {filteredSpaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Categoría del Daño</label>
 <Select
 value={form.building_damage_category_id || ""}
 items={buildingCategories.map((c) => ({ value: c.id, label: c.name }))}
 onValueChange={(v) => {
 const cat = buildingCategories.find((c) => c.id === v);
 setForm({ ...form, building_damage_category_id: v || "", category: cat?.name || form.category });
 }}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {buildingCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Severidad</label>
 <Select
 value={form.severity || "low"}
 items={severityOptions}
 onValueChange={(v) => setForm({ ...form, severity: (v || "low") as InspectionDamage["severity"] })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {severityOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Descripción</label>
 <input
 value={form.description || ""}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder="Ej. Grieta en muro de carga, filtración en techumbre..."
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Materialidad</label>
 <input
 value={form.materiality_type}
 onChange={(e) => setForm({ ...form, materiality_type: e.target.value })}
 placeholder="Ej. Hormigón, Albañilería..."
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Unidad</label>
 <Select
 value={form.unit}
 items={unitOptions.map((u) => ({ value: u, label: u }))}
 onValueChange={(v) => handleUnitChange(v || "")}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 {form.unit === "M2" && (
 <>
 <div className="modal-field">
 <label className="app-field-label">Largo (m)</label>
 <input
 type="number"
 step="any"
 value={form.length ?? ""}
 onChange={(e) => handleDimensionChange("length", e.target.value)}
 placeholder="0"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Ancho (m)</label>
 <input
 type="number"
 step="any"
 value={form.width ?? ""}
 onChange={(e) => handleDimensionChange("width", e.target.value)}
 placeholder="0"
 className="app-input w-full"
 />
 </div>
 </>
 )}
 {form.unit === "M3" && (
 <>
 <div className="modal-field">
 <label className="app-field-label">Largo (m)</label>
 <input
 type="number"
 step="any"
 value={form.length ?? ""}
 onChange={(e) => handleDimensionChange("length", e.target.value)}
 placeholder="0"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Ancho (m)</label>
 <input
 type="number"
 step="any"
 value={form.width ?? ""}
 onChange={(e) => handleDimensionChange("width", e.target.value)}
 placeholder="0"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Alto (m)</label>
 <input
 type="number"
 step="any"
 value={form.height ?? ""}
 onChange={(e) => handleDimensionChange("height", e.target.value)}
 placeholder="0"
 className="app-input w-full"
 />
 </div>
 </>
 )}
 <div className="modal-field">
 <label className="app-field-label">
 {form.unit === "M2" || form.unit === "M3" ? "Cantidad (calculada)" : "Cantidad"}
 </label>
 <input
 type="number"
 value={form.quantity}
 onChange={(e) => setForm({ ...form, quantity: e.target.value ? Number(e.target.value) : 0 })}
 placeholder="0"
 className="app-input w-full"
 readOnly={form.unit === "M2" || form.unit === "M3"}
 />
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Observaciones</label>
 <input
 value={form.observations}
 onChange={(e) => setForm({ ...form, observations: e.target.value })}
 placeholder="Observaciones adicionales..."
 className="app-input w-full"
 />
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Monto Estimado</label>
 <div className="flex gap-1.5">
 <Select
 value={form.currency}
 items={currencyOptions}
 onValueChange={(v) => setForm({ ...form, currency: v || "CLP" })}
 >
 <SelectTrigger className="app-input w-[90px] shrink-0">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {currencyOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
 </SelectContent>
 </Select>
 <input
 type="text"
 inputMode="decimal"
 value={amountFocused ? amountRaw : formatAmount(form.estimated_amount)}
 onFocus={() => {
 setAmountFocused(true);
 setAmountRaw(String(form.estimated_amount || ""));
 }}
 onBlur={() => setAmountFocused(false)}
 onChange={(e) => {
 setAmountRaw(e.target.value);
 setForm({ ...form, estimated_amount: parseAmount(e.target.value) });
 }}
 placeholder="0"
 className="app-input w-full text-right font-mono"
 />
 </div>
 </div>
 {affectedThirdParties.length > 0 && (
 <div className="modal-field">
 <label className="app-field-label">Tercero Afectado (opcional)</label>
 <Select
 value={form.third_party_id || ""}
 items={affectedThirdParties.map((t) => ({ value: t.id, label: t.full_name || "Sin nombre" }))}
 onValueChange={(v) => setForm({ ...form, third_party_id: v || "" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Si es daño de un tercero..." />
 </SelectTrigger>
 <SelectContent>
 {affectedThirdParties.map((t) => (
 <SelectItem key={t.id} value={t.id}>{t.full_name || "Sin nombre"}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>
 ) : (
 /* ── FORMULARIO CONTENIDO ── */
 <div className="modal-grid-3" key="content-form">
 <div className="modal-field">
 <label className="app-field-label">Tipo de Bien</label>
 <Select
 value={form.content_good_type_id || ""}
 items={goodTypes.map((g) => ({ value: g.id, label: g.name }))}
 onValueChange={(v) => {
 const gt = goodTypes.find((g) => g.id === v);
 setForm({ ...form, content_good_type_id: v || "", category: gt?.name || form.category });
 }}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {goodTypes.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Producto</label>
 <input
 value={form.product}
 onChange={(e) => setForm({ ...form, product: e.target.value })}
 placeholder="Ej. Televisor Samsung 55"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Marca / Modelo</label>
 <input
 value={form.brand_model}
 onChange={(e) => setForm({ ...form, brand_model: e.target.value })}
 placeholder="Ej. UN55AU8000"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Severidad</label>
 <Select
 value={form.severity || "low"}
 items={severityOptions}
 onValueChange={(v) => setForm({ ...form, severity: (v || "low") as InspectionDamage["severity"] })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {severityOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Cantidad</label>
 <input
 type="number"
 value={form.quantity}
 onChange={(e) => setForm({ ...form, quantity: e.target.value ? Number(e.target.value) : 0 })}
 placeholder="1"
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Fecha Compra</label>
 <DatePicker
 value={form.purchase_date}
 onChange={(value) => setForm({ ...form, purchase_date: value || "" })}
 className="w-[130px]"
 />
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Descripción / Detalle del daño</label>
 <input
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder="Ej. Pantalla rota por impacto, quemado total..."
 className="app-input w-full"
 />
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Observaciones</label>
 <input
 value={form.observations}
 onChange={(e) => setForm({ ...form, observations: e.target.value })}
 placeholder="Observaciones adicionales..."
 className="app-input w-full"
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Espacio (opcional)</label>
 <Select
 value={form.space_id || ""}
 items={filteredSpaces.map((s) => ({ value: s.id, label: s.name }))}
 onValueChange={(v) => setForm({ ...form, space_id: v || "" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Si se puede ubicar..." />
 </SelectTrigger>
 <SelectContent>
 {filteredSpaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Monto Estimado</label>
 <div className="flex gap-1.5">
 <Select
 value={form.currency}
 items={currencyOptions}
 onValueChange={(v) => setForm({ ...form, currency: v || "CLP" })}
 >
 <SelectTrigger className="app-input w-[90px] shrink-0">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {currencyOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
 </SelectContent>
 </Select>
 <input
 type="text"
 inputMode="decimal"
 value={amountFocused ? amountRaw : formatAmount(form.estimated_amount)}
 onFocus={() => {
 setAmountFocused(true);
 setAmountRaw(String(form.estimated_amount || ""));
 }}
 onBlur={() => setAmountFocused(false)}
 onChange={(e) => {
 setAmountRaw(e.target.value);
 setForm({ ...form, estimated_amount: parseAmount(e.target.value) });
 }}
 placeholder="0"
 className="app-input w-full text-right font-mono"
 />
 </div>
 </div>
 {affectedThirdParties.length > 0 && (
 <div className="modal-field">
 <label className="app-field-label">Tercero Afectado (opcional)</label>
 <Select
 value={form.third_party_id || ""}
 items={affectedThirdParties.map((t) => ({ value: t.id, label: t.full_name || "Sin nombre" }))}
 onValueChange={(v) => setForm({ ...form, third_party_id: v || "" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Si es daño de un tercero..." />
 </SelectTrigger>
 <SelectContent>
 {affectedThirdParties.map((t) => (
 <SelectItem key={t.id} value={t.id}>{t.full_name || "Sin nombre"}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 {editing !== "new" && (
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Comprobantes</label>
 <div className="app-panel p-3 space-y-3">
 {evidenceDocs.length > 0 && (
 <ul className="space-y-2">
 {evidenceDocs.map((doc) => (
 <li key={doc.id}>
 <a href={doc.url} target="_blank" rel="noopener noreferrer" className="app-body text-blue-600 hover:underline">
 {doc.description || "Documento"}
 </a>
 </li>
 ))}
 </ul>
 )}
 <div className="flex flex-col sm:flex-row flex-wrap items-end gap-2">
 <div className="w-full sm:w-40">
 <label className="app-field-label">Tipo</label>
 <Select value={contentDocType} onValueChange={(v) => setContentDocType(v || "Boleta")}>
 <SelectTrigger className="app-input w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {["Boleta", "Factura", "Certificado", "Otro"].map((t) => (
 <SelectItem key={t} value={t}>{t}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex-1 min-w-40">
 <input
 type="file"
 accept=".pdf,.jpg,.jpeg,.png"
 onChange={(e) => setContentDocFile(e.target.files?.[0] || null)}
 className="app-input w-full"
 />
 </div>
 <Button
 onClick={() => {
 if (!contentDocFile || !editing) return;
 uploadDocMutation.mutate({ file: contentDocFile, documentType: contentDocType, damageId: editing });
 }}
 disabled={!contentDocFile || uploadDocMutation.isPending}
 className="pg-btn-platinum"
 >
 {uploadDocMutation.isPending ? "Subiendo..." : "Subir"}
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Botones */}
 <div className="flex items-center justify-between border-t border-border pt-3">
 <div className="app-body text-muted-foreground">
 {form.damage_type === "building" ? "Daño constructivo" : "Daño de contenido"}
 </div>
 <div className="flex gap-2">
 <Button onClick={() => setEditing(null)} className="pg-btn-platinum">Cancelar</Button>
 <Button
 onClick={handleSubmit}
 disabled={!form.description || createMutation.isPending || updateMutation.isPending}
 className="pg-btn-platinum"
 >
 {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* ── SECCIÓN: DAÑOS CONSTRUCTIVOS ── */}
 <div className="app-panel">
 <h3 className="app-section-title flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
 <Building2 className="h-3.5 w-3.5" />
 </span>
 Daños Constructivos
 <span className="app-body text-muted-foreground font-normal">
 ({buildingDamages.length})
 </span>
 </h3>
 {isLoading ? (
 <div className="text-center py-6 text-muted-foreground app-body">Cargando...</div>
 ) : buildingDamages.length === 0 ? (
 <div className="text-center py-6 text-muted-foreground app-body">
 No hay daños constructivos registrados.
 </div>
 ) : (
 <div className="app-data-table-wrap overflow-auto">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>Espacio</th>
 <th>Categoría</th>
 <th>Descripción</th>
 <th>Severidad</th>
 <th className="text-right">Monto</th>
 <th className="w-[80px]">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {buildingDamages.map((d) => (
 <tr key={d.id}>
 <td className="app-body">{spaceName(d.space_id)}</td>
 <td className="app-body">{bldCategoryName(d.building_damage_category_id)}</td>
 <td className="app-body max-w-[200px] truncate">{d.description}</td>
 <td>
 <span className={`app-body font-medium px-2 py-0.5 rounded-full ${
 d.severity === "total" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
 d.severity === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" :
 d.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
 "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
 }`}>
 {severityLabels[d.severity] || d.severity}
 </span>
 </td>
 <td className="text-right font-medium app-body">{d.currency || "CLP"} {(d.estimated_amount || 0).toLocaleString("es-CL")}</td>
 <td>
 <div className="app-row-actions">
 {!readOnly && (
 <>
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => { setEditing(d.id); setForm(damageToForm(d)); }}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button variant="ghost" size="icon" className="btn-icon-sm text-rose-500 hover:text-rose-600" onClick={() => { if (confirm("¿Eliminar este daño?")) deleteMutation.mutate(d.id); }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* ── SECCIÓN: DAÑOS DE CONTENIDO ── */}
 <div className="app-panel">
 <h3 className="app-section-title flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
 <Package className="h-3.5 w-3.5" />
 </span>
 Daños de Contenido
 <span className="app-body text-muted-foreground font-normal">
 ({contentDamages.length})
 </span>
 </h3>
 {isLoading ? (
 <div className="text-center py-6 text-muted-foreground app-body">Cargando...</div>
 ) : contentDamages.length === 0 ? (
 <div className="text-center py-6 text-muted-foreground app-body">
 No hay daños de contenido registrados.
 </div>
 ) : (
 <div className="app-data-table-wrap overflow-auto">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>Tipo de Bien</th>
 <th>Producto</th>
 <th>Marca/Modelo</th>
 <th>Severidad</th>
 <th className="text-right">Monto</th>
 <th className="w-[80px]">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {contentDamages.map((d) => (
 <tr key={d.id}>
 <td className="app-body">{goodTypeName(d.content_good_type_id)}</td>
 <td className="app-body max-w-[150px] truncate">{d.product || d.description}</td>
 <td className="app-body">{d.brand_model || "—"}</td>
 <td>
 <span className={`app-body font-medium px-2 py-0.5 rounded-full ${
 d.severity === "total" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
 d.severity === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" :
 d.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
 "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
 }`}>
 {severityLabels[d.severity] || d.severity}
 </span>
 </td>
 <td className="text-right font-medium app-body">{d.currency || "CLP"} {(d.estimated_amount || 0).toLocaleString("es-CL")}</td>
 <td>
 <div className="app-row-actions">
 {!readOnly && (
 <>
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => { setEditing(d.id); setForm(damageToForm(d)); }}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button variant="ghost" size="icon" className="btn-icon-sm text-rose-500 hover:text-rose-600" onClick={() => { if (confirm("¿Eliminar este daño?")) deleteMutation.mutate(d.id); }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
}
