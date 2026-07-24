"use client";

import { Database, Layers } from "lucide-react";

import type { ScreenField, DateValidation } from "./types";
import {
  ACTION_ENTITIES,
  CARD_FIELD_MAP,
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
        <p className="app-title border-b pb-1">{field.label}</p>
      </div>
    );
  }

  const badge = isComplex ? (
    <span className="app-body rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0">
      Compleja
    </span>
  ) : isActionEntity ? (
    <span className="app-body rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0">
      Gestión
    </span>
  ) : isEntity ? (
    <span className="app-body rounded bg-muted text-muted-foreground px-1.5 py-0">Siniestro</span>
  ) : null;

  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="app-body font-medium">{field.label}</span>
      {field.required && <span className="text-red-500 app-body">*</span>}
      {field.requiredRule && (
        <span title={`Obligatorio cuando ${field.requiredRule.field} ${field.requiredRule.operator} ${Array.isArray(field.requiredRule.value) ? field.requiredRule.value.join(",") : field.requiredRule.value}`}>
          <span className="app-body rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1 py-0">⚠ req</span>
        </span>
      )}
      {field.visibilityRule && (
        <span title={`Visible cuando ${field.visibilityRule.field} ${field.visibilityRule.operator} ${Array.isArray(field.visibilityRule.value) ? field.visibilityRule.value.join(",") : field.visibilityRule.value}`}>
          <span className="app-body rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 px-1 py-0">👁 if</span>
        </span>
      )}
      {badge}
    </div>
  );

  const inputClass =
    "w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 app-body text-muted-foreground";

  // Entidad compleja
  if (isComplex) {
    const hasSubFields = field.fields && field.fields.length > 0;

    return (
      <div>
        {label}
        <div className="rounded-md border border-dashed border-violet-300 bg-violet-50/30 dark:bg-violet-900/10 p-2 app-body text-muted-foreground">
          {getComplexEntityPreview(field.type)}
        </div>

        {/* Sub-campos por cobertura */}
        {hasSubFields && (
          <div className="mt-2">
            <p className="app-body font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Campos por cobertura ({field.fields!.length})
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="app-data-table">
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
                  <span key={sf.id} className="app-body rounded bg-muted px-1 py-0.5 text-muted-foreground">
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
    // Cards agrupadas del siniestro — mostrar campos internos
    const cardFields = CARD_FIELD_MAP[field.type];
    if (cardFields) {
      return (
        <div>
          {label}
          <div className="rounded-md border border-violet-300/50 dark:border-violet-700/40 bg-violet-50/40 dark:bg-violet-900/10 p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Layers className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              <span className="app-body font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                Card agrupada · {cardFields.length} campos
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {cardFields.map((cf) => (
                <span key={cf.code} className="app-body rounded bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                  {cf.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }

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
          <p className="app-body text-muted-foreground mt-0.5">
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
          <p className="app-body text-muted-foreground mt-0.5">Máx {field.maxLength} caracteres</p>
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
          <p className="app-body text-amber-600 mt-0.5">
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
          <p className="app-body text-muted-foreground mt-0.5">
            {field.options.length} opción{field.options.length !== 1 ? "es" : ""}
          </p>
        )}
      </div>
    );
  }

  // Checkbox (renderizado como toggle)
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 app-body">
        <span className="inline-flex h-[18px] w-[32px] items-center rounded-full bg-input">
          <span className="ml-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm" />
        </span>
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

  // Campos de coordinación (coord_*) — preview genérico según subtipo
  if (field.type === "coord_fecha" || field.type === "coord_fecha_recoord") {
    return (
      <div>
        {label}
        <div className="flex flex-col sm:flex-row gap-1.5">
          {/* Input date pequeño */}
          <div className="flex flex-col gap-0.5 sm:w-[80px] shrink-0">
            <div className="h-5 rounded border border-border bg-background px-1 app-body text-muted-foreground flex items-center">
              📅 {new Date().toISOString().split("T")[0]}
            </div>
            <p className="app-body text-muted-foreground leading-tight">
              {new Date().toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
            </p>
          </div>
          {/* Slots grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="app-body font-medium text-foreground/80">Horarios</span>
              <div className="flex items-center gap-1.5 app-body text-muted-foreground ml-auto">
                <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded bg-emerald-500/40" /> 09-19</span>
                <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded bg-muted" /> Ocup</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-0.5">
              {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"].map((t, i) => (
                <div
                  key={t}
                  className={`h-4 rounded app-body font-medium flex items-center justify-center ${
                    i === 6
                      ? "ring-1 ring-primary bg-primary/5 text-primary"
                      : i < 2
                      ? "bg-muted/40 text-muted-foreground/40 line-through"
                      : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                  }`}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="app-body text-muted-foreground mt-0.5">
          {field.type === "coord_fecha_recoord" ? "Fecha tentativa de próxima coordinación" : "Input date + slots de disponibilidad"}
        </p>
      </div>
    );
  }

  if (field.type.startsWith("coord_")) {
    const coordPreview = getCoordFieldPreview(field.type);
    return (
      <div>
        {label}
        <div className={inputClass + " flex items-center justify-between"}>
          <span>{coordPreview.text}</span>
          <span className="text-muted-foreground">{coordPreview.icon}</span>
        </div>
        <p className="app-body text-muted-foreground mt-0.5">{coordPreview.hint}</p>
      </div>
    );
  }

  // Fallback: cualquier campo propio no reconocido
  return (
    <div>
      {label}
      <div className={inputClass}>...</div>
    </div>
  );
}

function getCoordFieldPreview(type: string): { text: string; icon: string; hint: string } {
  switch (type) {
    case "coord_result":
      return { text: "Seleccionar resultado...", icon: "▾", hint: "Coordinada / Fallida / Desistida" };
    case "coord_inspection_type":
      return { text: "Seleccionar...", icon: "▼", hint: "Presencial / Remota" };
    case "coord_inspector":
      return { text: "Seleccionar inspector...", icon: "👤", hint: "Lista de inspectores" };
    case "coord_ubicacion":
      return { text: "Aclaración de dirección...", icon: "📍", hint: "Detalle adicional" };
    case "coord_contacto":
      return { text: "Contacto alternativo...", icon: "📞", hint: "Opcional" };
    case "coord_comentarios":
      return { text: "Comentarios...", icon: "¶", hint: "Notas finales" };
    case "coord_motivo":
      return { text: "Motivo de falla o desistimiento...", icon: "✎", hint: "Solo si Fallida/Desistida" };
    case "coord_agendar":
      return { text: "Estado de inspección", icon: "✓", hint: "Panel informativo (se crea al emitir)" };
    default:
      return { text: "...", icon: "□", hint: "Campo de coordinación" };
  }
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
    case "inspection_session_view":
      return "� Ver estado y resultados de la inspección";
    case "claim_insured_card":
      return "👤 RUT | Tipo | Nombre | Apellido | Email | Teléfono | Dirección | País | Región | Ciudad | Comuna";
    case "claim_address_card":
      return "📍 Dirección | Tipo | País | Región | Ciudad | Comuna (3 cols, 2 filas)";
    case "claim_contact_card":
      return "📞 Nombre | Apellido | Email | Teléfono (4 cols, 1 fila)";
    // ═══ Campos individuales del Asegurado (tras desagrupar) ═══
    case "insured_rut":
      return "RUT del asegurado";
    case "insured_person_type":
      return "Tipo de persona (Natural/Jurídica)";
    case "insured_first_name":
      return "Nombre del asegurado";
    case "insured_last_name":
      return "Apellido del asegurado";
    case "insured_email":
      return "Email del asegurado";
    case "insured_phone":
      return "Teléfono del asegurado";
    case "insured_address":
      return "Dirección del asegurado";
    case "insured_country":
      return "País del asegurado";
    case "insured_region":
      return "Región del asegurado";
    case "insured_city":
      return "Ciudad del asegurado";
    case "insured_commune":
      return "Comuna del asegurado";
    // ═══ Campos individuales de la Dirección del Siniestro (tras desagrupar) ═══
    case "claim_address":
      return "Dirección del siniestro";
    case "claim_destination_housing":
      return "Tipo de vivienda del siniestro";
    case "claim_country":
      return "País del siniestro";
    case "claim_region":
      return "Región del siniestro";
    case "claim_city":
      return "Ciudad del siniestro";
    case "claim_commune":
      return "Comuna del siniestro";
    // ═══ Campos individuales de la Persona de Contacto (tras desagrupar) ═══
    case "contact_first_name":
      return "Nombre del contacto";
    case "contact_last_name":
      return "Apellido del contacto";
    case "contact_email":
      return "Email del contacto";
    case "contact_phone":
      return "Teléfono del contacto";
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
