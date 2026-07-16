"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import type { ScreenField, FieldWidth, DateValidation } from "./types";
import { ACTION_ENTITIES, COMPLEX_ENTITIES } from "./types";

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
];

interface FieldPropertiesPanelProps {
  field: ScreenField;
  allFields: ScreenField[];
  dateFields: ScreenField[];
  onUpdate: (updates: Partial<ScreenField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function FieldPropertiesPanel({
  field,
  dateFields,
  onUpdate,
  onRemove,
  onDuplicate,
}: FieldPropertiesPanelProps) {
  const isEntity = field.category !== "own";
  const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);

  return (
    <div className="space-y-3.5">
      {/* Tipo y categoría — glass */}
      <div className="rounded-lg border border-white/10 dark:border-white/5 bg-card/60 backdrop-blur-md p-2.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-mono font-medium uppercase text-primary">{field.type}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">Categoría</span>
          <span className="font-medium">
            {field.category === "own" && "Campo propio"}
            {field.category === "simple_entity" && "Entidad simple"}
            {field.category === "complex_entity" && "Entidad compleja"}
          </span>
        </div>
        {isEntity && (
          <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-white/10 dark:border-white/5">
            {isActionEntity
              ? "Solo vista. Datos automáticos de la gestión."
              : "Solo vista. Datos automáticos del siniestro."}
          </p>
        )}
      </div>

      {/* ─── Sub-campos por cobertura (entidades complejas como reserva/ajuste) ─── */}
      {field.category === "complex_entity" && field.fields && field.fields.length > 0 && (
        <div className="rounded-lg border border-violet-300/40 dark:border-violet-700/30 bg-violet-50/30 dark:bg-violet-900/10 backdrop-blur-md p-2.5">
          <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1.5">
            Campos por cobertura ({field.fields.length})
          </p>
          <p className="text-[9px] text-muted-foreground mb-2">Cada cobertura del siniestro tiene estos campos</p>
          <div className="space-y-1">
            {field.fields.map((sf) => (
              <div key={sf.id} className="flex items-center justify-between text-[10px] py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium ${sf.editable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {sf.editable ? "✎" : "🔒"}
                  </span>
                  <span className="font-mono text-muted-foreground">{sf.id}</span>
                  <span>{sf.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {sf.formula && (
                    <span className="text-[8px] rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1 py-0">
                      = {sf.formula}
                    </span>
                  )}
                  <span className="text-[8px] text-muted-foreground uppercase">{sf.type}</span>
                  {sf.column && (
                    <span className="text-[8px] rounded bg-muted px-1 py-0 text-muted-foreground">
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
        <div className="rounded-lg border border-violet-300/40 dark:border-violet-700/30 bg-violet-50/30 dark:bg-violet-900/10 backdrop-blur-md p-2.5">
          <p className="text-[10px] text-muted-foreground">
            {COMPLEX_ENTITIES.find((e) => e.code === field.type)?.desc || "Entidad compleja del sistema."}
          </p>
        </div>
      )}

      {/* Etiqueta */}
      <div>
        <Label className="app-field-label text-[10px]">Etiqueta visible</Label>
        <Input
          className="app-input h-8 text-[12px]"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </div>

      {/* ID técnico */}
      <div>
        <Label className="app-field-label text-[10px]">ID técnico</Label>
        <Input
          className="app-input h-8 text-[11px] font-mono"
          value={field.id}
          onChange={(e) => onUpdate({ id: e.target.value })}
        />
        <p className="text-[9px] text-muted-foreground mt-0.5">Identificador único del campo</p>
      </div>

      {/* ─── Ancho de columna (campos propios y entidades simples) ─── */}
      {field.category !== "complex_entity" && (
        <div>
          <Label className="app-field-label text-[10px]">Ancho de columna</Label>
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ width: opt.value })}
                className={`flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] transition-all ${
                  (field.width || "full") === opt.value
                    ? "border-primary bg-primary/10 backdrop-blur-sm text-primary font-medium shadow-sm"
                    : "border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 backdrop-blur-sm text-muted-foreground hover:border-muted-foreground/30 hover:bg-white/10"
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-[8px] opacity-60">{opt.cols}</span>
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            Controla cuántas columnas ocupa el campo en la fila. Ej: 2 campos con 1/2 van en la misma fila.
          </p>
        </div>
      )}

      {/* ─── Propiedades de campos propios ─── */}
      {!isEntity && field.type !== "section" && (
        <label className="flex items-center gap-2 text-[11px] cursor-pointer">
          <Checkbox
            checked={!!field.required}
            onChange={(e) => onUpdate({ required: (e.target as HTMLInputElement).checked })}
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
              onChange={(e) => onUpdate({ inputType: e.target.value as "alphanumeric" | "numeric" })}
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
              onChange={(e) => onUpdate({ maxLength: Number(e.target.value) || undefined })}
            />
          </div>
        </>
      )}

      {/* Placeholder */}
      {!isEntity && (field.type === "text" || field.type === "textarea") && (
        <div>
          <Label className="app-field-label text-[10px]">Placeholder</Label>
          <Input
            className="app-input h-8 text-[11px]"
            value={field.placeholder || ""}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
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
            onChange={(e) => onUpdate({ rows: Number(e.target.value) })}
          />
        </div>
      )}

      {/* Fecha */}
      {!isEntity && field.type === "date" && (
        <>
          <div>
            <Label className="app-field-label text-[10px]">Tipo de fecha</Label>
            <select
              className="app-input h-8 text-[11px] w-full"
              value={field.dateType || "date"}
              onChange={(e) => onUpdate({ dateType: e.target.value as "date" | "datetime" })}
            >
              <option value="date">Solo fecha</option>
              <option value="datetime">Fecha y hora</option>
            </select>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Validación de fecha</Label>
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
              <SelectTrigger className="app-input h-7 w-full">
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
                <Label className="app-field-label text-[10px]">Comparar con</Label>
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
                  <SelectTrigger className="app-input h-7 w-full">
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
        </>
      )}

      {/* Select: opciones */}
      {!isEntity && field.type === "select" && (
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
              onUpdate({ options });
            }}
            rows={5}
          />
        </div>
      )}

      {/* Tabla: columnas */}
      {!isEntity && field.type === "table" && (
        <div>
          <Label className="app-field-label text-[10px]">Columnas</Label>
          <p className="text-[9px] text-muted-foreground mb-1">Una columna por línea</p>
          <Textarea
            className="app-input text-[11px]"
            value={field.columns?.join("\n") || ""}
            onChange={(e) => {
              const columns = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
              onUpdate({ columns });
            }}
            rows={4}
          />
        </div>
      )}

      {/* Acciones */}
      <div className="pt-3 border-t space-y-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="pg-btn-platinum w-full"
          onClick={onDuplicate}
        >
          Duplicar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="pg-btn-platinum w-full"
          onClick={onRemove}
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}
