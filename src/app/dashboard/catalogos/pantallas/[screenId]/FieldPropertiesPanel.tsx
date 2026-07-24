"use client";

import { toLabelCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ungroup, Copy, Trash2, Lock, Hash, Type, AlignLeft, Calendar, ChevronDown, CheckSquare, Table, Section as SectionIcon, User, MapPin, Phone, Mail, Globe, Building2 } from "lucide-react";


import type { ScreenField, FieldWidth, DateValidation, VisibilityRule } from "./types";
import { ACTION_ENTITIES, COMPLEX_ENTITIES, CARD_FIELD_MAP, OWN_FIELD_TYPES, CLAIM_ENTITIES, SPECIAL_FIELD_OPTIONS } from "./types";

// Mapa de iconos string → componente lucide
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "Aa": Type,
  "¶": AlignLeft,
  "#": Hash,
  "📅": Calendar,
  "▼": ChevronDown,
  "✓": CheckSquare,
  "⊞": Table,
  "§": SectionIcon,
  "👤": User,
  "📍": MapPin,
  "📞": Phone,
  "✉": Mail,
  "🌍": Globe,
  "🗺": MapPin,
  "🏙": Building2,
  "🏠": Building2,
};

function FieldIcon({ type, className }: { type: string; className?: string }) {
  // Buscar icono en catálogos
  const own = OWN_FIELD_TYPES.find((f) => f.code === type);
  const claim = CLAIM_ENTITIES.find((f) => f.code === type);
  const iconStr = own?.icon || claim?.icon || "Aa";
  const Icon = ICON_MAP[iconStr] || Type;
  return <Icon className={className} />;
}

// Encabezado de sección — pequeño, uppercase, con divider
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="app-body font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

const DATE_VALIDATION_TYPES: { code: DateValidation["type"]; label: string }[] = [
 { code: "greater_than_today", label: "Mayor que fecha actual" },
 { code: "less_than_today", label: "Menor que fecha actual" },
 { code: "equal_today", label: "Igual a fecha actual" },
 { code: "greater_than", label: "Mayor que otro campo" },
 { code: "less_than", label: "Menor que otro campo" },
 { code: "greater_or_equal", label: "Mayor o igual que otro campo" },
 { code: "less_or_equal", label: "Menor o igual que otro campo" },
 { code: "equal_to", label: "Igual a otro campo" },
];

const WIDTH_OPTIONS: { value: FieldWidth; label: string; cols: string }[] = [
 { value: "full", label: "Completo", cols: "12/12" },
 { value: "half", label: "1/2", cols: "6/12" },
 { value: "third", label: "1/3", cols: "4/12" },
 { value: "quarter", label: "1/4", cols: "3/12" },
 { value: "fifth", label: "1/5", cols: "≈2.4/12" },
 { value: "sixth", label: "1/6", cols: "2/12" },
];

interface FieldPropertiesPanelProps {
 field: ScreenField;
 allFields: ScreenField[];
 dateFields: ScreenField[];
 onUpdate: (updates: Partial<ScreenField>) => void;
 onRemove: () => void;
 onDuplicate: () => void;
 onUngroup?: () => void;
}

export function FieldPropertiesPanel({
 field,
 allFields,
 dateFields,
 onUpdate,
 onRemove,
 onDuplicate,
 onUngroup,
}: FieldPropertiesPanelProps) {
 const isEntity = field.category !== "own";
 const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);
 const isGroupedCard = !!CARD_FIELD_MAP[field.type];

 return (
 <div className="space-y-3">
 {/* ═══ Header visual: icono + tipo + badge de categoría ═══ */}
 <div className="rounded-lg border border-border/60 bg-card/40 p-2.5">
 <div className="flex items-start gap-2.5">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
 <FieldIcon type={field.type} className="h-4 w-4" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-mono app-body font-medium uppercase text-foreground/80 truncate">{field.type}</span>
 <span className={`app-body font-medium px-1.5 py-0 rounded-full ${
 field.category === "own"
 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
 : field.category === "simple_entity"
 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
 : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
 }`}>
 {field.category === "own" && "Campo propio"}
 {field.category === "simple_entity" && "Entidad simple"}
 {field.category === "complex_entity" && "Entidad compleja"}
 </span>
 </div>
 {isEntity && (
 <p className="app-body text-muted-foreground mt-1 flex items-center gap-1">
 <Lock className="h-2.5 w-2.5" />
 {isActionEntity ? "Solo vista · Datos de la gestión" : "Solo vista · Datos del siniestro"}
 </p>
 )}
 {isGroupedCard && (
 <p className="app-body text-violet-600 dark:text-violet-400 mt-1">
 Card agrupada · {CARD_FIELD_MAP[field.type]?.length || 0} campos internos
 </p>
 )}
 </div>
 </div>
 </div>

 {/* ─── Sub-campos por cobertura (entidades complejas) ─── */}
 {field.category === "complex_entity" && field.fields && field.fields.length > 0 && (
 <div className="rounded-lg border border-violet-300/40 dark:border-violet-700/30 bg-violet-50/30 dark:bg-violet-900/10 p-2.5">
 <p className="app-body font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1.5">
 Campos por cobertura ({field.fields.length})
 </p>
 <p className="app-body text-muted-foreground mb-2">Cada cobertura del siniestro tiene estos campos</p>
 <div className="space-y-1">
 {field.fields.map((sf) => (
 <div key={sf.id} className="flex items-center justify-between app-body py-0.5">
 <div className="flex items-center gap-1.5">
 <span className={`font-medium ${sf.editable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
 {sf.editable ? "✎" : "🔒"}
 </span>
 <span className="font-mono text-muted-foreground">{sf.id}</span>
 <span>{sf.label}</span>
 </div>
 <div className="flex items-center gap-1.5">
 {sf.formula && (
 <span className="app-body rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1 py-0">
 = {sf.formula}
 </span>
 )}
 <span className="app-body text-muted-foreground uppercase">{sf.type}</span>
 {sf.column && (
 <span className="app-body rounded bg-muted px-1 py-0 text-muted-foreground">
 col: {sf.column}
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ─── Info de entidad compleja sin sub-campos ─── */}
 {field.category === "complex_entity" && (!field.fields || field.fields.length === 0) && (
 <div className="rounded-lg border border-violet-300/40 dark:border-violet-700/30 bg-violet-50/30 dark:bg-violet-900/10 p-2.5">
 <p className="app-body text-muted-foreground">
 {COMPLEX_ENTITIES.find((e) => e.code === field.type)?.desc || "Entidad compleja del sistema."}
 </p>
 </div>
 )}

 {/* ═══ SECCIÓN: Identificación ═══ */}
 <div className="space-y-2">
 <SectionHeader>Identificación</SectionHeader>
 <div>
 <Label className="app-field-label app-body">Etiqueta visible</Label>
 <Input
 className="app-input h-7"
 value={field.label}
 onChange={(e) => onUpdate({ label: e.target.value })}
onBlur={(e) => onUpdate({ label: toLabelCase(e.target.value) })}
 />
 </div>
 <div>
 <Label className="app-field-label app-body">ID técnico</Label>
 <Input
 className="app-input h-7 app-body font-mono"
 value={field.id}
 onChange={(e) => onUpdate({ id: e.target.value })}
 />
 <p className="app-body text-muted-foreground mt-0.5">Identificador único del campo</p>
 </div>
 </div>

 {/* ═══ SECCIÓN: Presentación ═══ */}
 {field.category !== "complex_entity" && (
 <div className="space-y-2">
 <SectionHeader>Presentación</SectionHeader>

 {/* Ancho de columna — visual 12-grid */}
 <div>
 <Label className="app-field-label app-body">Ancho de columna</Label>
 {/* Visual: 12 barritas que se llenan según el ancho seleccionado (aproximado a 12) */}
 <div className="mt-1.5 mb-2">
 <div className="flex gap-0.5 h-5">
 {Array.from({ length: 12 }).map((_, i) => {
 const colsMap: Record<FieldWidth, number> = { full: 12, half: 6, third: 4, quarter: 3, fifth: 2, sixth: 2 };
 const cols = colsMap[field.width || "full"] ?? 12;
 const filled = i < cols;
 return (
 <div
 key={i}
 className={`flex-1 rounded-sm transition-all ${
 filled
 ? "bg-primary/70 dark:bg-primary/60"
 : "bg-muted/40 dark:bg-muted/30"
 }`}
 />
 );
 })}
 </div>
 <div className="flex justify-between app-body text-muted-foreground mt-0.5">
 <span>1</span>
 <span>12 columnas</span>
 </div>
 </div>
 <div className="grid grid-cols-3 gap-1.5">
 {WIDTH_OPTIONS.map((opt) => (
 <button
 key={opt.value}
 type="button"
 onClick={() => onUpdate({ width: opt.value })}
 className={`flex flex-col items-center gap-0.5 rounded-md border py-1.5 app-body transition-all ${
 (field.width || "full") === opt.value
 ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
 : "border-border/60 bg-card/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-card/60"
 }`}
 >
 <span className="font-medium">{opt.label}</span>
 <span className="app-body opacity-60">{opt.cols}</span>
 </button>
 ))}
 </div>
 <p className="app-body text-muted-foreground mt-1">
 Ej: 2 campos con 1/2 van en la misma fila.
 </p>
 </div>

 {/* Campo obligatorio */}
 {!isEntity && field.type !== "section" && (
 <div className="flex items-center gap-2 py-0.5">
 <ToggleChip
 active={!!field.required}
 onClick={(v) => onUpdate({ required: v })}
 >
 Campo obligatorio
 </ToggleChip>
 </div>
 )}
 </div>
 )}

 {/* ═══ SECCIÓN: Contenido (campos propios: text/textarea) ═══ */}
 {!isEntity && (field.type === "text" || field.type === "textarea") && (
 <div className="space-y-2">
 <SectionHeader>Contenido</SectionHeader>
 <div>
 <Label className="app-field-label app-body">Tipo de contenido</Label>
 <select
 className="app-input h-7 app-body w-full"
 value={field.inputType || "alphanumeric"}
 onChange={(e) => onUpdate({ inputType: e.target.value as "alphanumeric" | "numeric" })}
 >
 <option value="alphanumeric">Alfanumérico</option>
 <option value="numeric">Numérico</option>
 </select>
 </div>
 <div>
 <Label className="app-field-label app-body">Largo máximo</Label>
 <Input
 type="number"
 className="app-input h-7 app-body"
 value={field.maxLength || ""}
 onChange={(e) => onUpdate({ maxLength: Number(e.target.value) || undefined })}
 />
 </div>
 <div>
 <Label className="app-field-label app-body">Placeholder</Label>
 <Input
 className="app-input h-7 app-body"
 value={field.placeholder || ""}
 onChange={(e) => onUpdate({ placeholder: e.target.value })}
 />
 </div>
 {field.type === "textarea" && (
 <div>
 <Label className="app-field-label app-body">Filas de altura</Label>
 <Input
 type="number"
 className="app-input h-7 app-body"
 value={field.rows || 3}
 onChange={(e) => onUpdate({ rows: Number(e.target.value) })}
 />
 </div>
 )}
 </div>
 )}

 {/* ═══ SECCIÓN: Validación de fecha ═══ */}
 {!isEntity && field.type === "date" && (
 <div className="space-y-2">
 <SectionHeader>Validación de fecha</SectionHeader>
 <div>
 <Label className="app-field-label app-body">Tipo de fecha</Label>
 <select
 className="app-input h-7 app-body w-full"
 value={field.dateType || "date"}
 onChange={(e) => onUpdate({ dateType: e.target.value as "date" | "datetime" })}
 >
 <option value="date">Solo fecha</option>
 <option value="datetime">Fecha y hora</option>
 </select>
 </div>
 <div>
 <Label className="app-field-label app-body">Validación</Label>
 <Select
 value={field.dateValidation?.type || "__none"}
 onValueChange={(v) => {
 const type = (v === "__none" ? "" : (v ?? "")) as DateValidation["type"];
 if (!type) {
 onUpdate({ dateValidation: undefined });
 } else {
 onUpdate({ dateValidation: { type, compareField: field.dateValidation?.compareField } });
 }
 }}
 items={[{ value: "__none", label: "Sin validación" }, ...DATE_VALIDATION_TYPES.map((v) => ({ value: v.code, label: v.label }))]}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Sin validación" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Sin validación</SelectItem>
 {DATE_VALIDATION_TYPES.map((v) => (
 <SelectItem key={v.code} value={v.code}>
 {v.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {field.dateValidation?.type &&
 field.dateValidation.type.includes("than") &&
 !field.dateValidation.type.includes("today") && (
 <div>
 <Label className="app-field-label app-body">Comparar con</Label>
 <Select
 value={field.dateValidation.compareField || "__none"}
 onValueChange={(v) =>
 onUpdate({
 dateValidation: {
 ...field.dateValidation!,
 compareField: (v === "__none" ? "" : (v ?? "")) || undefined,
 },
 })
 }
 items={[{ value: "__none", label: "Seleccionar campo..." }, ...dateFields.map((f) => ({ value: f.id, label: f.label }))]}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar campo..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar campo...</SelectItem>
 {dateFields.map((f) => (
 <SelectItem key={f.id} value={f.id}>
 {f.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>
 )}

 {/* ═══ SECCIÓN: Opciones (select) ═══ */}
 {!isEntity && field.type === "select" && (
 <div className="space-y-2">
 <SectionHeader>Opciones</SectionHeader>
 <div>
 <p className="app-body text-muted-foreground mb-1">Una por línea. Formato: valor=Etiqueta</p>
 <Textarea
 className="app-input app-body"
 value={field.options?.map((o) => `${o.value}=${o.label}`).join("\n") || ""}
 onChange={(e) => {
 const options = e.target.value
 .split("\n")
 .map((line) => {
 const [value, label] = line.split("=").map((s) => s.trim());
 return { value: value || line.trim(), label: label || value || line.trim() };
 })
 .filter((o) => o.value);
 onUpdate({ options });
 }}
 rows={5}
 />
 </div>
 </div>
 )}

 {/* ═══ SECCIÓN: Columnas (tabla) ═══ */}
 {!isEntity && field.type === "table" && (
 <div className="space-y-2">
 <SectionHeader>Columnas</SectionHeader>
 <div>
 <p className="app-body text-muted-foreground mb-1">Una columna por línea</p>
 <Textarea
 className="app-input app-body"
 value={field.columns?.join("\n") || ""}
 onChange={(e) => {
 const columns = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
 onUpdate({ columns });
 }}
 rows={4}
 />
 </div>
 </div>
 )}

 {/* ═══ SECCIÓN: Reglas condicionales (visibilidad / obligatoriedad) ═══ */}
 {!isEntity && field.type !== "section" && (
 <ConditionalRulesSection field={field} allFields={allFields} onUpdate={onUpdate} />
 )}

 {/* ═══ SECCIÓN: Acciones ═══ */}
 <div className="space-y-1.5 pt-3 border-t border-border/60">
 <SectionHeader>Acciones</SectionHeader>
 {isGroupedCard && onUngroup && (
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="w-full border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700/60 dark:text-violet-300 dark:hover:bg-violet-900/20"
 onClick={onUngroup}
 >
 <Ungroup className="h-3.5 w-3.5 mr-1.5" />
 Desagrupar card
 </Button>
 )}
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="pg-btn-platinum w-full"
 onClick={onDuplicate}
 >
 <Copy className="h-3.5 w-3.5 mr-1.5" />
 Duplicar
 </Button>
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="pg-btn-platinum w-full hover:border-red-400 hover:text-red-600 dark:hover:border-red-700 dark:hover:text-red-400"
 onClick={onRemove}
 >
 <Trash2 className="h-3.5 w-3.5 mr-1.5" />
 Eliminar
 </Button>
 </div>
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// ConditionalRulesSection — configurar visibilidad y obligatoriedad condicional
// ═══════════════════════════════════════════════════════════════

const RULE_OPERATORS: { value: VisibilityRule["operator"]; label: string }[] = [
 { value: "equals", label: "es igual a" },
 { value: "not_equals", label: "no es igual a" },
 { value: "in", label: "es uno de" },
 { value: "not_in", label: "no es ninguno de" },
];

function ConditionalRulesSection({
 field,
 allFields,
 onUpdate,
}: {
 field: ScreenField;
 allFields: ScreenField[];
 onUpdate: (updates: Partial<ScreenField>) => void;
}) {
 // Campos own disponibles como controladores (excluyendo el campo actual)
 const controllerFields = allFields.filter(
 (f) => f.category === "own" && f.id !== field.id && f.type !== "section"
 );

 const setVisibilityRule = (rule: VisibilityRule | undefined) => {
 onUpdate({ visibilityRule: rule });
 };
 const setRequiredRule = (rule: VisibilityRule | undefined) => {
 onUpdate({ requiredRule: rule });
 };

 const renderRuleEditor = (
 label: string,
 rule: VisibilityRule | undefined,
 onChange: (rule: VisibilityRule | undefined) => void,
 enabled: boolean,
 onToggle: (enabled: boolean) => void
 ) => {
 if (!enabled) {
 return (
 <ToggleChip active={false} onClick={(v) => onToggle(v)}>
 {label}
 </ToggleChip>
 );
 }
 const currentRule = rule || { field: "", operator: "equals" as const, value: "" };
 const isMulti = currentRule.operator === "in" || currentRule.operator === "not_in";
 return (
 <div className="space-y-1.5 p-2 rounded-md border border-border/60 bg-muted/20">
 <ToggleChip active={true} onClick={(v) => onToggle(v)}>
 {label}
 </ToggleChip>
 <div>
 <Label className="app-field-label app-body">Campo controlador</Label>
 <select
 className="app-input h-7 app-body w-full"
 value={currentRule.field}
 onChange={(e) => onChange({ ...currentRule, field: e.target.value })}
 >
 <option value="">Seleccionar campo...</option>
 {controllerFields.map((f) => (
 <option key={f.id} value={f.id}>
 {f.label || f.id} ({f.id})
 </option>
 ))}
 </select>
 </div>
 <div>
 <Label className="app-field-label app-body">Operador</Label>
 <select
 className="app-input h-7 app-body w-full"
 value={currentRule.operator}
 onChange={(e) =>
 onChange({
 ...currentRule,
 operator: e.target.value as VisibilityRule["operator"],
 value: (e.target.value === "in" || e.target.value === "not_in") && !Array.isArray(currentRule.value)
 ? [String(currentRule.value || "")]
 : currentRule.value,
 })
 }
 >
 {RULE_OPERATORS.map((o) => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 <div>
 <Label className="app-field-label app-body">
 {isMulti ? "Valores" : "Valor"}
 </Label>
 {(() => {
 // Detectar si el campo controlador tiene options canónicas
 // (tipo especial con SPECIAL_FIELD_OPTIONS, o campo select con field.options)
 const controllerField = controllerFields.find(f => f.id === currentRule.field);
 const specialOptions = controllerField ? SPECIAL_FIELD_OPTIONS[controllerField.type] : undefined;
 const selectOptions = controllerField?.options;
 const availableOptions = specialOptions || selectOptions;

 if (availableOptions && availableOptions.length > 0) {
 // Renderizar select(s) con los options del campo controlador
 // El usuario ve el label, se guarda el value canónico
 if (isMulti) {
 // Multi-select: checkboxes con los options
 const selectedValues = Array.isArray(currentRule.value) ? currentRule.value : [];
 return (
 <div className="space-y-1 max-h-32 overflow-y-auto rounded border border-border/60 p-1.5 bg-muted/20">
 {availableOptions.map((opt) => (
 <div key={opt.value}>
 <ToggleChip
 active={selectedValues.includes(opt.value)}
 onClick={(v) => {
 const newValues = v
 ? [...selectedValues, opt.value]
 : selectedValues.filter((x) => x !== opt.value);
 onChange({ ...currentRule, value: newValues });
 }}
 >
 {opt.label}
 </ToggleChip>
 </div>
 ))}
 </div>
 );
 }
 // Single select
 return (
 <select
 className="app-input h-7 app-body w-full"
 value={String(currentRule.value || "")}
 onChange={(e) => onChange({ ...currentRule, value: e.target.value })}
 >
 <option value="">Seleccionar valor...</option>
 {availableOptions.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 );
 }
 // Input de texto libre (para campos text/date/etc sin options)
 return (
 <Input
 className="app-input h-7 app-body"
 value={Array.isArray(currentRule.value) ? currentRule.value.join(", ") : String(currentRule.value || "")}
 onChange={(e) => {
 const raw = e.target.value;
 if (isMulti) {
 const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
 onChange({ ...currentRule, value: arr });
 } else {
 onChange({ ...currentRule, value: raw });
 }
 }}
 placeholder={isMulti ? "valor1, valor2, valor3" : "valor"}
 />
 );
 })()}
 </div>
 </div>
 );
 };

 const hasVisibility = !!field.visibilityRule;
 const hasRequired = !!field.requiredRule;

 return (
 <div className="space-y-2 pt-3 border-t border-border/60">
 <SectionHeader>Reglas condicionales</SectionHeader>
 {renderRuleEditor(
 "Mostrar solo cuando...",
 field.visibilityRule,
 setVisibilityRule,
 hasVisibility,
 (enabled) => setVisibilityRule(enabled ? { field: "", operator: "equals", value: "" } : undefined)
 )}
 {renderRuleEditor(
 "Es obligatorio solo cuando...",
 field.requiredRule,
 setRequiredRule,
 hasRequired,
 (enabled) => setRequiredRule(enabled ? { field: "", operator: "equals", value: "" } : undefined)
 )}
 <p className="app-body text-muted-foreground">
 Permite que este campo se muestre o sea obligatorio según el valor de otro campo.
 </p>
 </div>
 );
}
