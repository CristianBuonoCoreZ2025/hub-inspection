"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
  Info,
  Save,
  X,
  Pencil,
  Eye,
  Database,
  Boxes,
} from "lucide-react";
import type { GestionScreen } from "@/types";
import type { ScreenField, FieldCategory, DateValidation } from "@/app/dashboard/claims/[id]/gestion-screens/DynamicScreen";
import {
  OWN_FIELD_TYPES,
  CLAIM_ENTITIES,
  ACTION_ENTITIES,
  COMPLEX_ENTITIES,
  ALL_SYSTEM_CODES,
} from "@/app/dashboard/claims/[id]/gestion-screens/DynamicScreen";

interface ScreenBuilderProps {
  screen: GestionScreen | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, formSchema: Record<string, unknown>) => void;
  isPending?: boolean;
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

export default function ScreenBuilder({ screen, open, onOpenChange, onSave, isPending }: ScreenBuilderProps) {
  const [fields, setFields] = useState<ScreenField[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Recargar campos cuando se abre el modal o cambia la pantalla
  useEffect(() => {
    if (open && screen) {
      const loaded = Array.isArray(screen.form_schema?.fields)
        ? (screen.form_schema.fields as ScreenField[])
        : [];
      setFields(loaded);
      setSelectedIndex(null);
    } else if (!open) {
      setFields([]);
      setSelectedIndex(null);
    }
  }, [open, screen]);

  const selectedField = selectedIndex !== null ? fields[selectedIndex] : null;
  const dateFields = fields.filter((f) => f.type === "date" && f.id !== selectedField?.id);

  const addField = (category: FieldCategory, type: string, label: string) => {
    const newField: ScreenField = {
      id: `${type}_${Date.now()}`,
      category,
      type,
      label,
      required: false,
    };
    if (type === "text") {
      newField.inputType = "alphanumeric";
      newField.maxLength = 100;
    }
    if (type === "textarea") {
      newField.maxLength = 500;
      newField.rows = 3;
    }
    if (type === "date") {
      newField.dateType = "date";
    }
    if (type === "select") {
      newField.options = [{ value: "1", label: "Opción 1" }];
    }
    if (type === "table") {
      newField.columns = ["Columna 1", "Columna 2"];
    }
    setFields([...fields, newField]);
    setSelectedIndex(fields.length);
  };

  const updateField = (index: number, updates: Partial<ScreenField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  const removeField = (index: number) => {
    const next = fields.filter((_, i) => i !== index);
    setFields(next);
    if (selectedIndex === index) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;
    const next = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFields(next);
    setSelectedIndex(swapIndex);
  };

  const updateOptions = (text: string) => {
    if (!selectedField) return;
    const options = text
      .split("\n")
      .map((line) => {
        const [value, label] = line.split("=").map((s) => s.trim());
        return { value: value || line.trim(), label: label || value || line.trim() };
      })
      .filter((o) => o.value);
    updateField(selectedIndex!, { options });
  };

  const updateColumns = (text: string) => {
    if (!selectedField) return;
    const columns = text.split("\n").map((s) => s.trim()).filter(Boolean);
    updateField(selectedIndex!, { columns });
  };

  const handleSave = () => {
    if (!screen) return;
    onSave(screen.id, { fields });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Diseñar pantalla</h3>
              <p className="text-[11px] text-muted-foreground">{screen?.name || "Pantalla"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)} className="btn-cancel btn-sm">
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending} className="btn-save btn-sm">
              <Save className="h-3.5 w-3.5 mr-1" /> {isPending ? "Guardando" : "Guardar"}
            </Button>
          </div>
        </div>

        {/* Cuerpo: 3 columnas */}
        <div className="flex-1 overflow-hidden grid grid-cols-[240px_1fr_300px] gap-0 min-h-[520px]">
          {/* ═════════════════════════════════════════════════════════
              Columna 1: Paleta de campos
              ═════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-4 border-r bg-muted/20 p-3 overflow-y-auto">
            {/* Campos propios */}
            <div>
              <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                <Pencil className="h-3 w-3" /> Campos propios
              </p>
              <p className="text-[9px] text-muted-foreground mb-2">
                Editables. El usuario completa estos datos.
              </p>
              <div className="space-y-1">
                {OWN_FIELD_TYPES.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => addField("own", t.code, t.label)}
                    title={t.desc}
                    className="w-full flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-[14px] w-4 text-center shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.label}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Entidades del siniestro */}
            <div>
              <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                <Database className="h-3 w-3" /> Datos del siniestro
              </p>
              <p className="text-[9px] text-muted-foreground mb-2">
                Solo vista. Datos del siniestro.
              </p>
              <div className="space-y-1">
                {CLAIM_ENTITIES.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => addField("simple_entity", t.code, t.label)}
                    title={t.desc}
                    className="w-full flex items-center gap-2 rounded-md border border-dashed border-border bg-card px-2 py-1.5 text-[11px] text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-[14px] w-4 text-center shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.label}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Entidades de la gestión */}
            <div>
              <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                <Database className="h-3 w-3" /> Datos de la gestión
              </p>
              <p className="text-[9px] text-muted-foreground mb-2">
                Solo vista. Emisor, revisor, aprobador, fechas de la gestión.
              </p>
              <div className="space-y-1">
                {ACTION_ENTITIES.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => addField("simple_entity", t.code, t.label)}
                    title={t.desc}
                    className="w-full flex items-center gap-2 rounded-md border border-dashed border-border bg-card px-2 py-1.5 text-[11px] text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-[14px] w-4 text-center shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.label}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Entidades complejas */}
            <div>
              <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                <Boxes className="h-3 w-3" /> Entidades complejas
              </p>
              <p className="text-[9px] text-muted-foreground mb-2">
                Solo vista. Estructuras completas del siniestro.
              </p>
              <div className="space-y-1">
                {COMPLEX_ENTITIES.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => addField("complex_entity", t.code, t.label)}
                    title={t.desc}
                    className="w-full flex items-center gap-2 rounded-md border border-dashed border-violet-300 bg-violet-50/50 dark:bg-violet-900/10 px-2 py-1.5 text-[11px] text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  >
                    <span className="text-[14px] w-4 text-center shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.label}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              Columna 2: Canvas del formulario
              ═════════════════════════════════════════════════════════ */}
          <div className="flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
            <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/20">
              <p className="text-[11px] font-semibold text-muted-foreground">Vista del formulario</p>
              <span className="text-[10px] text-muted-foreground">{fields.length} campo(s)</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {fields.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-12">
                  <LayoutTemplate className="h-10 w-10 opacity-20" />
                  <p className="text-[12px]">El formulario está vacío</p>
                  <p className="text-[11px]">Agrega campos desde el lateral izquierdo</p>
                </div>
              )}
              {fields.map((field, idx) => (
                <CanvasField
                  key={field.id}
                  field={field}
                  index={idx}
                  selected={selectedIndex === idx}
                  allFields={fields}
                  onSelect={() => setSelectedIndex(idx)}
                  onMove={moveField}
                  onRemove={removeField}
                />
              ))}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════
              Columna 3: Propiedades del campo seleccionado
              ═════════════════════════════════════════════════════════ */}
          <div className="flex flex-col border-l bg-muted/20 overflow-hidden">
            <div className="border-b px-4 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">Propiedades</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {selectedField ? (
                <PropertiesPanel
                  field={selectedField}
                  index={selectedIndex!}
                  allFields={fields}
                  dateFields={dateFields}
                  onUpdate={updateField}
                  onRemove={removeField}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
                  <Pencil className="h-8 w-8 opacity-20" />
                  <p className="text-[11px]">Selecciona un campo del formulario para editar sus propiedades</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel de propiedades según categoría
// ═══════════════════════════════════════════════════════════════

function PropertiesPanel({
  field,
  index,
  allFields,
  dateFields,
  onUpdate,
  onRemove,
}: {
  field: ScreenField;
  index: number;
  allFields: ScreenField[];
  dateFields: ScreenField[];
  onUpdate: (index: number, updates: Partial<ScreenField>) => void;
  onRemove: (index: number) => void;
}) {
  const isEntity = field.category !== "own";
  const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);

  return (
    <div className="space-y-3">
      {/* Tipo y categoría */}
      <div className="rounded-md border border-border bg-card p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tipo:</span>
          <span className="font-medium uppercase">{field.type}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">Categoría:</span>
          <span className="font-medium">
            {field.category === "own" && "Campo propio"}
            {field.category === "simple_entity" && "Entidad simple"}
            {field.category === "complex_entity" && "Entidad compleja"}
          </span>
        </div>
        {isEntity && (
          <p className="text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t">
            {isActionEntity
              ? "Solo vista. Se muestra automáticamente con datos de la gestión."
              : "Solo vista. Se muestra automáticamente con datos del siniestro."}
          </p>
        )}
      </div>

      {/* Etiqueta */}
      <div>
        <Label className="app-field-label text-[10px]">Etiqueta visible</Label>
        <Input
          className="app-input h-8 text-[11px]"
          value={field.label}
          onChange={(e) => onUpdate(index, { label: e.target.value })}
        />
      </div>

      {/* ID técnico */}
      <div>
        <Label className="app-field-label text-[10px]">ID técnico</Label>
        <Input
          className="app-input h-8 text-[11px] font-mono"
          value={field.id}
          onChange={(e) => onUpdate(index, { id: e.target.value })}
        />
        <p className="text-[9px] text-muted-foreground mt-0.5">Identificador único para guardar el dato</p>
      </div>

      {/* ─── Propiedades de campos propios ─── */}
      {!isEntity && field.type !== "section" && (
        <label className="flex items-center gap-2 text-[11px]">
          <Checkbox
            checked={!!field.required}
            onChange={(e) => onUpdate(index, { required: (e.target as HTMLInputElement).checked })}
          />
          Campo obligatorio
        </label>
      )}

      {/* Texto: alfanumérico/numérico + largo */}
      {!isEntity && (field.type === "text" || field.type === "textarea") && (
        <>
          <div>
            <Label className="app-field-label text-[10px]">Tipo de contenido</Label>
            <select
              className="app-input h-8 text-[11px] w-full"
              value={field.inputType || "alphanumeric"}
              onChange={(e) => onUpdate(index, { inputType: e.target.value as "alphanumeric" | "numeric" })}
            >
              <option value="alphanumeric">Alfanumérico</option>
              <option value="numeric">Numérico</option>
            </select>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Largo máximo</Label>
            <Input
              type="number"
              className="app-input h-8 text-[11px]"
              value={field.maxLength || ""}
              onChange={(e) => onUpdate(index, { maxLength: Number(e.target.value) || undefined })}
            />
            <p className="text-[9px] text-muted-foreground mt-0.5">Cantidad máxima de caracteres</p>
          </div>
        </>
      )}

      {/* Placeholder para texto/textarea */}
      {!isEntity && (field.type === "text" || field.type === "textarea") && (
        <div>
          <Label className="app-field-label text-[10px]">Placeholder</Label>
          <Input
            className="app-input h-8 text-[11px]"
            value={field.placeholder || ""}
            onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
          />
        </div>
      )}

      {/* Filas para textarea */}
      {!isEntity && field.type === "textarea" && (
        <div>
          <Label className="app-field-label text-[10px]">Filas de altura</Label>
          <Input
            type="number"
            className="app-input h-8 text-[11px]"
            value={field.rows || 3}
            onChange={(e) => onUpdate(index, { rows: Number(e.target.value) })}
          />
        </div>
      )}

      {/* ─── Propiedades de fecha ─── */}
      {!isEntity && field.type === "date" && (
        <>
          <div>
            <Label className="app-field-label text-[10px]">Tipo de fecha</Label>
            <select
              className="app-input h-8 text-[11px] w-full"
              value={field.dateType || "date"}
              onChange={(e) => onUpdate(index, { dateType: e.target.value as "date" | "datetime" })}
            >
              <option value="date">Solo fecha</option>
              <option value="datetime">Fecha y hora</option>
            </select>
          </div>

          <div>
            <Label className="app-field-label text-[10px]">Validación de fecha</Label>
            <p className="text-[9px] text-muted-foreground mb-1">Opcional. Valida contra otra fecha o la actual.</p>
            <Select
              value={field.dateValidation?.type || "__none"}
              onValueChange={(v) => {
                const type = (v === "__none" ? "" : (v ?? "")) as DateValidation["type"];
                if (!type) {
                  onUpdate(index, { dateValidation: undefined });
                } else {
                  onUpdate(index, {
                    dateValidation: { type, compareField: field.dateValidation?.compareField },
                  });
                }
              }}
              items={[{ value: "__none", label: "Sin validación" }, ...DATE_VALIDATION_TYPES.map((v) => ({ value: v.code, label: v.label }))]}
            >
              <SelectTrigger className="app-input h-7 w-full">
                <SelectValue placeholder="Sin validación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin validación</SelectItem>
                {DATE_VALIDATION_TYPES.map((v) => (
                  <SelectItem key={v.code} value={v.code}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de comparación */}
          {field.dateValidation?.type && field.dateValidation.type.includes("than") &&
           !field.dateValidation.type.includes("today") && (
            <div>
              <Label className="app-field-label text-[10px]">Comparar con</Label>
              <Select
                value={field.dateValidation.compareField || "__none"}
                onValueChange={(v) => onUpdate(index, {
                  dateValidation: { ...field.dateValidation!, compareField: (v === "__none" ? "" : (v ?? "")) || undefined },
                })}
                items={[{ value: "__none", label: "Seleccionar campo..." }, ...dateFields.map((f) => ({ value: f.id, label: f.label }))]}
              >
                <SelectTrigger className="app-input h-7 w-full">
                  <SelectValue placeholder="Seleccionar campo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Seleccionar campo...</SelectItem>
                  {dateFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Solo campos de fecha del formulario
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── Select: opciones ─── */}
      {!isEntity && (field.type === "select") && (
        <div>
          <Label className="app-field-label text-[10px]">Opciones</Label>
          <p className="text-[9px] text-muted-foreground mb-1">Una por línea. Formato: valor=Etiqueta</p>
          <Textarea
            className="app-input text-[11px]"
            value={field.options?.map((o) => `${o.value}=${o.label}`).join("\n") || ""}
            onChange={(e) => {
              const options = e.target.value
                .split("\n")
                .map((line) => {
                  const [value, label] = line.split("=").map((s) => s.trim());
                  return { value: value || line.trim(), label: label || value || line.trim() };
                })
                .filter((o) => o.value);
              onUpdate(index, { options });
            }}
            rows={5}
          />
        </div>
      )}

      {/* ─── Tabla: columnas ─── */}
      {!isEntity && field.type === "table" && (
        <div>
          <Label className="app-field-label text-[10px]">Columnas</Label>
          <p className="text-[9px] text-muted-foreground mb-1">Una columna por línea</p>
          <Textarea
            className="app-input text-[11px]"
            value={field.columns?.join("\n") || ""}
            onChange={(e) => {
              const columns = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
              onUpdate(index, { columns });
            }}
            rows={4}
          />
        </div>
      )}

      {/* Eliminar */}
      <div className="pt-2 border-t">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="btn-danger btn-sm w-full"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar campo
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Canvas: vista previa de cada campo en el formulario
// ═══════════════════════════════════════════════════════════════

function CanvasField({
  field,
  index,
  selected,
  allFields,
  onSelect,
  onMove,
  onRemove,
}: {
  field: ScreenField;
  index: number;
  selected: boolean;
  allFields: ScreenField[];
  onSelect: () => void;
  onMove: (idx: number, dir: "up" | "down") => void;
  onRemove: (idx: number) => void;
}) {
  const isEntity = field.category !== "own";
  const isComplex = field.category === "complex_entity";

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg border p-3 transition-all cursor-pointer ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : isComplex
          ? "border-violet-200 bg-violet-50/30 dark:bg-violet-900/5 hover:border-violet-400"
          : isEntity
          ? "border-dashed border-border bg-muted/10 hover:border-muted-foreground/30"
          : "border-border bg-card hover:border-muted-foreground/30"
      }`}
    >
      {/* Controles */}
      <div className={`absolute right-2 top-2 flex items-center gap-1 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMove(index, "up"); }}
          disabled={index === 0}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Mover arriba"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMove(index, "down"); }}
          disabled={index === 0}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Mover abajo"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          className="p-1 rounded hover:bg-rose-50 text-rose-600"
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <CanvasFieldPreview field={field} allFields={allFields} />
    </div>
  );
}

function CanvasFieldPreview({ field, allFields }: { field: ScreenField; allFields: ScreenField[] }) {
  const isEntity = field.category !== "own";
  const isComplex = field.category === "complex_entity";
  const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);

  if (field.type === "section") {
    return (
      <div className="pt-1">
        <p className="text-[13px] font-semibold border-b pb-1">{field.label}</p>
      </div>
    );
  }

  const badge = isComplex
    ? <span className="text-[9px] rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0">Entidad compleja</span>
    : isActionEntity
    ? <span className="text-[9px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0">Dato de la gestión</span>
    : isEntity
    ? <span className="text-[9px] rounded bg-muted text-muted-foreground px-1.5 py-0">Dato del siniestro</span>
    : null;

  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] font-medium">{field.label}</span>
      {field.required && <span className="text-red-500 text-[10px]">*</span>}
      {badge}
    </div>
  );

  const inputClass = "w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 text-[12px] text-muted-foreground";

  // Entidad compleja
  if (isComplex) {
    return (
      <div>
        {label}
        <div className="rounded-md border border-dashed border-violet-300 bg-violet-50/30 dark:bg-violet-900/10 p-2 text-[10px] text-muted-foreground">
          {getComplexEntityPreview(field.type)}
        </div>
      </div>
    );
  }

  // Entidad simple
  if (isEntity) {
    return (
      <div>
        {label}
        <div className={inputClass + " flex items-center gap-2"}>
          {isActionEntity ? (
            <>
              <span className="text-muted-foreground">👤</span>
              <span>Se muestra automáticamente</span>
            </>
          ) : (
            <>
              <Database className="h-3 w-3 text-muted-foreground" />
              <span>Se muestra automáticamente</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Campo propio: texto
  if (field.type === "text") {
    return (
      <div>
        {label}
        <div className={inputClass}>{field.placeholder || "..."}</div>
        {field.maxLength && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Máx {field.maxLength} · {field.inputType === "numeric" ? "Numérico" : "Alfanumérico"}
          </p>
        )}
      </div>
    );
  }

  // Campo propio: textarea
  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <div className={inputClass + " min-h-[64px]"}>{field.placeholder || "Texto libre..."}</div>
        {field.maxLength && (
          <p className="text-[9px] text-muted-foreground mt-0.5">Máx {field.maxLength} caracteres</p>
        )}
      </div>
    );
  }

  // Campo propio: fecha
  if (field.type === "date") {
    return (
      <div>
        {label}
        <div className={inputClass + " flex items-center justify-between"}>
          <span>{field.dateType === "datetime" ? "Fecha y hora" : "Fecha"}</span>
          <span>📅</span>
        </div>
        {field.dateValidation && (
          <p className="text-[9px] text-amber-600 mt-0.5">
            ⚠ {getDateValidationShort(field.dateValidation, allFields)}
          </p>
        )}
      </div>
    );
  }

  // Select
  if (field.type === "select") {
    return (
      <div>
        {label}
        <div className={inputClass + " flex items-center justify-between"}>
          <span>Seleccionar...</span>
          <span>▼</span>
        </div>
      </div>
    );
  }

  // Checkbox
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-[12px]">
        <span className="h-4 w-4 rounded border border-input" />
        {field.label}
      </label>
    );
  }

  // Tabla
  if (field.type === "table") {
    return (
      <div>
        {label}
        <div className="rounded-md border border-border overflow-hidden">
          <table className="app-data-table">
            <thead className="bg-muted/50">
              <tr>
                {field.columns?.map((c) => <th key={c} className="px-2 py-1 text-left font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                {field.columns?.map((c) => <td key={c} className="px-2 py-1 text-muted-foreground">...</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

function getComplexEntityPreview(type: string): string {
  switch (type) {
    case "claim_coverages": return "📋 Cobertura | Subcobertura | Monto Asegurado | Monto Afectado | Aplica";
    case "claim_reserve": return "💰 Monto | Moneda | Estado | Fecha";
    case "claim_documents": return "📄 Documento | Solicitado | Recibido | Fecha";
    case "claim_participants": return "👥 Nombre | Rol | Contacto";
    case "claim_history": return "📋 Gestiones anteriores del siniestro";
    default: return "Datos del siniestro";
  }
}

function getDateValidationShort(v: DateValidation, allFields: ScreenField[]): string {
  const compareField = v.compareField ? allFields.find((f) => f.id === v.compareField) : null;
  switch (v.type) {
    case "greater_than_today": return "Mayor que fecha actual";
    case "less_than_today": return "Menor que fecha actual";
    case "equal_today": return "Igual a fecha actual";
    case "greater_than": return `Mayor que ${compareField?.label || "campo"}`;
    case "less_than": return `Menor que ${compareField?.label || "campo"}`;
    case "greater_or_equal": return `Mayor o igual que ${compareField?.label || "campo"}`;
    case "less_or_equal": return `Menor o igual que ${compareField?.label || "campo"}`;
    case "equal_to": return `Igual a ${compareField?.label || "campo"}`;
    default: return "";
  }
}
