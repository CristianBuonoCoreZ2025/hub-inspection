"use client";

import { Database } from "lucide-react";

import type { ScreenField, DateValidation } from "./types";
import {
  ACTION_ENTITIES,
} from "./types";

interface FieldPreviewProps {
  field: ScreenField;
  allFields: ScreenField[];
}

export function FieldPreview({ field, allFields }: FieldPreviewProps) {
  const isEntity = field.category !== "own";
  const isComplex = field.category === "complex_entity";
  const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);

  // Sección
  if (field.type === "section") {
    return (
      <div className="pt-1">
        <p className="text-[13px] font-semibold border-b pb-1">{field.label}</p>
      </div>
    );
  }

  const badge = isComplex ? (
    <span className="text-[9px] rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0">
      Compleja
    </span>
  ) : isActionEntity ? (
    <span className="text-[9px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0">
      Gestión
    </span>
  ) : isEntity ? (
    <span className="text-[9px] rounded bg-muted text-muted-foreground px-1.5 py-0">Siniestro</span>
  ) : null;

  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11px] font-medium">{field.label}</span>
      {field.required && <span className="text-red-500 text-[10px]">*</span>}
      {badge}
    </div>
  );

  const inputClass =
    "w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 text-[12px] text-muted-foreground";

  // Entidad compleja
  if (isComplex) {
    const hasSubFields = field.fields && field.fields.length > 0;

    return (
      <div>
        {label}
        <div className="rounded-md border border-dashed border-violet-300 bg-violet-50/30 dark:bg-violet-900/10 p-2 text-[10px] text-muted-foreground">
          {getComplexEntityPreview(field.type)}
        </div>

        {/* Sub-campos por cobertura */}
        {hasSubFields && (
          <div className="mt-2">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Campos por cobertura ({field.fields!.length})
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-[9px]">
                <thead className="bg-muted/40">
                  <tr>
                    {field.fields!.filter(f => f.column).map((sf) => (
                      <th key={sf.id} className="px-1.5 py-1 text-left font-medium text-muted-foreground">
                        {sf.column}
                        {sf.editable ? <span className="text-emerald-600 ml-0.5">✎</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    {field.fields!.filter(f => f.column).map((sf) => (
                      <td key={sf.id} className="px-1.5 py-1 text-muted-foreground font-mono">
                        {sf.type === "number" ? "0" : sf.type === "date" ? "—" : "..."}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Campos sin columna (informativos) */}
            {field.fields!.filter(f => !f.column).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {field.fields!.filter(f => !f.column).map((sf) => (
                  <span key={sf.id} className="text-[8px] rounded bg-muted px-1 py-0.5 text-muted-foreground">
                    {sf.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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

  // Textarea
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

  // Fecha
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
        {field.options && field.options.length > 0 && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {field.options.length} opción{field.options.length !== 1 ? "es" : ""}
          </p>
        )}
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
          <table className="w-full text-[10px]">
            <thead className="bg-muted/50">
              <tr>
                {field.columns?.map((c) => (
                  <th key={c} className="px-2 py-1 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                {field.columns?.map((c) => (
                  <td key={c} className="px-2 py-1 text-muted-foreground">
                    ...
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Número
  if (field.type === "number") {
    return (
      <div>
        {label}
        <div className={inputClass}>0</div>
      </div>
    );
  }

  return null;
}

function getComplexEntityPreview(type: string): string {
  switch (type) {
    case "review_levels":
      return "✓ Emisión → Revisión → Aprobación (según config de la gestión)";
    case "claim_coverages":
      return "📋 Cobertura | Subcobertura | Monto Asegurado | Monto Afectado | Aplica";
    case "claim_reserve":
      return "💰 Monto | Moneda | Estado | Fecha (solo lectura)";
    case "claim_reserve_form":
      return "✎ Editor de reserva por cobertura con montos editables";
    case "claim_adjustment_form":
      return "⚖ Editor de ajuste por cobertura con montos ajustados";
    case "claim_documents":
      return "📄 Seleccionar documentos a solicitar según línea de negocio";
    case "claim_document_receipt":
      return "✓ Controlar recepción de documentos solicitados";
    case "claim_participants":
      return "👥 Nombre | Rol | Contacto";
    case "claim_history":
      return "📋 Gestiones anteriores del siniestro";
    default:
      return "Datos del siniestro";
  }
}

function getDateValidationShort(v: DateValidation, allFields: ScreenField[]): string {
  const compareField = v.compareField ? allFields.find((f) => f.id === v.compareField) : null;
  switch (v.type) {
    case "greater_than_today":
      return "Mayor que fecha actual";
    case "less_than_today":
      return "Menor que fecha actual";
    case "equal_today":
      return "Igual a fecha actual";
    case "greater_than":
      return `Mayor que ${compareField?.label || "campo"}`;
    case "less_than":
      return `Menor que ${compareField?.label || "campo"}`;
    case "greater_or_equal":
      return `Mayor o igual que ${compareField?.label || "campo"}`;
    case "less_or_equal":
      return `Menor o igual que ${compareField?.label || "campo"}`;
    case "equal_to":
      return `Igual a ${compareField?.label || "campo"}`;
    default:
      return "";
  }
}
