"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Eye, EyeOff, Lock, Home, Building2 } from "lucide-react";

export interface FieldConfig {
  show?: string[] | Record<string, string[]>;
  hide?: string[] | Record<string, string[]>;
  labels?: Record<string, string | Record<string, string>>;
}

interface FieldConfigEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: FieldConfig;
  onSave: (config: FieldConfig) => void;
  itemName: string;
}

const ALWAYS_VISIBLE = ["age_years", "owner_name", "worker_resident_count"];

type DestType = "residential" | "commercial";

const ALL_FIELDS: { key: string; defaultLabel: string }[] = [
  { key: "age_years", defaultLabel: "Antigüedad del Inmueble" },
  { key: "owner_name", defaultLabel: "Nombre Propietario(s)" },
  { key: "worker_resident_count", defaultLabel: "N° Habitantes" },
  { key: "apartment_number", defaultLabel: "N° Dpto / Oficina" },
  { key: "floor_count", defaultLabel: "N° Pisos" },
  { key: "built_surface", defaultLabel: "Superficie Construida (m²)" },
  { key: "room_count", defaultLabel: "Cantidad Espacios" },
  { key: "bathroom_count", defaultLabel: "Cantidad Baños" },
  { key: "is_habitable", defaultLabel: "¿Se encuentra habitable?" },
  { key: "office_count", defaultLabel: "N° Oficinas" },
  { key: "warehouse_count", defaultLabel: "N° Bodegas" },
  { key: "branch_count", defaultLabel: "Sucursales" },
  { key: "business_line", defaultLabel: "Rubro de la Empresa" },
];

type LabelState = Record<string, { residential: string; commercial: string }>;
type ShowState = Record<DestType, Set<string>>;

function normalizeLabels(
  raw: Record<string, string | Record<string, string>> | undefined,
): LabelState {
  const result: LabelState = {};
  if (!raw) return result;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      result[key] = { residential: value, commercial: value };
    } else if (value && typeof value === "object") {
      result[key] = {
        residential: value.residential || "",
        commercial: value.commercial || "",
      };
    }
  }
  return result;
}

function normalizeShow(
  raw: string[] | Record<string, string[]> | undefined,
): ShowState {
  const empty: ShowState = { residential: new Set(), commercial: new Set() };
  if (!raw) return empty;
  if (Array.isArray(raw)) {
    const s = new Set(raw);
    return { residential: new Set(s), commercial: new Set(s) };
  }
  return {
    residential: new Set(raw.residential || []),
    commercial: new Set(raw.commercial || []),
  };
}

export function FieldConfigEditor({ open, onOpenChange, currentConfig, onSave, itemName }: FieldConfigEditorProps) {
  const [showFields, setShowFields] = React.useState<ShowState>(() => normalizeShow(currentConfig?.show));
  const [labels, setLabels] = React.useState<LabelState>(() => normalizeLabels(currentConfig?.labels));
  const [lastOpen, setLastOpen] = React.useState(false);

  if (open && !lastOpen) {
    setLastOpen(true);
    setShowFields(normalizeShow(currentConfig?.show));
    setLabels(normalizeLabels(currentConfig?.labels));
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  const toggleField = (field: string, destType: DestType) => {
    if (ALWAYS_VISIBLE.includes(field)) return;
    setShowFields((prev) => {
      const next = { ...prev, [destType]: new Set(prev[destType]) };
      if (next[destType].has(field)) {
        next[destType].delete(field);
      } else {
        next[destType].add(field);
      }
      return next;
    });
  };

  const updateLabel = (field: string, column: DestType, value: string) => {
    setLabels((prev) => ({
      ...prev,
      [field]: { ...prev[field], [column]: value },
    }));
  };

  const handleSave = () => {
    const resArr = Array.from(showFields.residential).filter((f) => !ALWAYS_VISIBLE.includes(f)).sort();
    const comArr = Array.from(showFields.commercial).filter((f) => !ALWAYS_VISIBLE.includes(f)).sort();
    const showOut: string[] | Record<string, string[]> =
      resArr.join(",") === comArr.join(",")
        ? resArr
        : { residential: resArr, commercial: comArr };

    const labelsOut: Record<string, string | Record<string, string>> = {};
    for (const [key, { residential, commercial }] of Object.entries(labels)) {
      if (!residential.trim() && !commercial.trim()) continue;
      if (residential.trim() === commercial.trim()) {
        labelsOut[key] = residential.trim();
      } else {
        labelsOut[key] = {
          ...(residential.trim() ? { residential: residential.trim() } : {}),
          ...(commercial.trim() ? { commercial: commercial.trim() } : {}),
        };
      }
    }

    onSave({ show: showOut, labels: labelsOut });
    onOpenChange(false);
  };

  const renderEye = (field: { key: string; defaultLabel: string }, destType: DestType) => {
    const isVisible = showFields[destType].has(field.key) || ALWAYS_VISIBLE.includes(field.key);
    const isLocked = ALWAYS_VISIBLE.includes(field.key);
    return (
      <button
        type="button"
        onClick={() => toggleField(field.key, destType)}
        disabled={isLocked}
        className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md transition-all ${
          isLocked
            ? "text-muted-foreground/40 cursor-default"
            : isVisible
            ? "text-emerald-500 hover:bg-emerald-500/10"
            : "text-muted-foreground hover:bg-muted"
        }`}
        title={isLocked ? "Siempre visible" : isVisible ? "Visible" : "Oculto"}
      >
        {isLocked ? <Lock className="h-3.5 w-3.5" /> : isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-lg" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-purple-500 text-white shadow-sm">
              <Settings2 className="h-4 w-4" />
            </div>
            {itemName}
          </DialogTitle>
          <DialogDescription className="modal-subtitle">
            Activa o desactiva campos y define etiquetas por tipo de destino.
          </DialogDescription>
        </div>

        <div className="modal-body">
          <div className="field-config-matrix">
            {/* Header de la matriz */}
            <div className="field-config-matrix-header">
              <div className="field-config-col-field">Campo</div>
              <div className="field-config-col-dest field-config-col-residential">
                <Home className="h-3.5 w-3.5" />
                <span>Habitacional</span>
              </div>
              <div className="field-config-col-dest field-config-col-commercial">
                <Building2 className="h-3.5 w-3.5" />
                <span>Comercial</span>
              </div>
            </div>

            {/* Filas de la matriz */}
            <div className="field-config-matrix-body">
              {ALL_FIELDS.map((field) => {
                const isLocked = ALWAYS_VISIBLE.includes(field.key);
                const fieldLabels = labels[field.key] || { residential: "", commercial: "" };
                const resVisible = showFields.residential.has(field.key) || isLocked;
                const comVisible = showFields.commercial.has(field.key) || isLocked;
                return (
                  <div
                    key={field.key}
                    className={`field-config-matrix-row ${isLocked ? "field-config-row-locked" : ""}`}
                  >
                    {/* Columna: nombre del campo */}
                    <div className="field-config-col-field">
                      <span className="text-[13px] font-medium text-foreground">{field.defaultLabel}</span>
                      {isLocked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
                    </div>

                    {/* Columna: Habitacional */}
                    <div className="field-config-col-dest field-config-col-residential">
                      {renderEye(field, "residential")}
                      <Input
                        type="text"
                        placeholder={field.defaultLabel}
                        value={fieldLabels.residential}
                        onChange={(e) => updateLabel(field.key, "residential", e.target.value)}
                        className="app-input flex-1"
                        disabled={!resVisible}
                      />
                    </div>

                    {/* Columna: Comercial */}
                    <div className="field-config-col-dest field-config-col-commercial">
                      {renderEye(field, "commercial")}
                      <Input
                        type="text"
                        placeholder={field.defaultLabel}
                        value={fieldLabels.commercial}
                        onChange={(e) => updateLabel(field.key, "commercial", e.target.value)}
                        className="app-input flex-1"
                        disabled={!comVisible}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button className="pg-btn-platinum" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button className="pg-btn-platinum" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
