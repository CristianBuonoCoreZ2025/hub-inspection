"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Eye, EyeOff, Lock, Home, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface FieldConfig {
  show?: string[] | Record<string, string[]>;
  hide?: string[] | Record<string, string[]>;
  labels?: Record<string, string | Record<string, string>>;
  order?: Record<string, number>;
}

interface FieldConfigEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: FieldConfig;
  onSave: (config: FieldConfig) => void;
  itemName: string;
  // Tipos de destino relacionados con esta clasificacion. Si no se pasa, se asumen ambos.
  availableDestTypes?: DestType[];
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
type OrderState = Record<string, number>;

// Orden por defecto desde field-config.ts
const DEFAULT_ORDER: Record<string, number> = {
  age_years: 1,
  owner_name: 2,
  worker_resident_count: 3,
  apartment_number: 4,
  floor_count: 5,
  built_surface: 6,
  room_count: 7,
  bathroom_count: 8,
  is_habitable: 9,
  office_count: 10,
  warehouse_count: 11,
  branch_count: 12,
  business_line: 13,
};

function normalizeOrder(raw: Record<string, number> | undefined): OrderState {
  return { ...DEFAULT_ORDER, ...(raw || {}) };
}

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

export function FieldConfigEditor({
  open,
  onOpenChange,
  currentConfig,
  onSave,
  itemName,
  availableDestTypes = ["residential", "commercial"],
}: FieldConfigEditorProps) {
  const [showFields, setShowFields] = React.useState<ShowState>(() => normalizeShow(currentConfig?.show));
  const [labels, setLabels] = React.useState<LabelState>(() => normalizeLabels(currentConfig?.labels));
  const [order, setOrder] = React.useState<OrderState>(() => normalizeOrder(currentConfig?.order));
  const [lastOpen, setLastOpen] = React.useState(false);

  if (open && !lastOpen) {
    setLastOpen(true);
    setShowFields(normalizeShow(currentConfig?.show));
    setLabels(normalizeLabels(currentConfig?.labels));
    setOrder(normalizeOrder(currentConfig?.order));
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  const toggleField = (field: string, destType: DestType) => {
    if (ALWAYS_VISIBLE.includes(field) || !availableDestTypes.includes(destType)) return;
    setShowFields((prev) => {
      const next = { ...prev, [destType]: new Set(prev[destType]) };
      if (next[destType].has(field)) {
        next[destType].delete(field);
        // Limpiar el label al desactivar
        setLabels((lp) => ({
          ...lp,
          [field]: { ...lp[field], [destType]: "" },
        }));
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

  const updateOrder = (field: string, value: number) => {
    if (!value) return;
    setOrder((prev) => {
      const next = { ...prev };
      // Buscar si otro campo ya tiene ese numero -> intercambiar
      const otherField = Object.entries(next).find(
        ([k, v]) => k !== field && v === value,
      )?.[0];
      if (otherField) {
        next[otherField] = next[field] ?? DEFAULT_ORDER[field] ?? 0;
      }
      next[field] = value;
      return next;
    });
  };

  const handleSave = () => {
    // Al guardar, no incluir los tipos de destino que no estan disponibles
    const allowed: Record<DestType, boolean> = {
      residential: availableDestTypes.includes("residential"),
      commercial: availableDestTypes.includes("commercial"),
    };

    const resArr = allowed.residential
      ? Array.from(showFields.residential).filter((f) => !ALWAYS_VISIBLE.includes(f)).sort()
      : [];
    const comArr = allowed.commercial
      ? Array.from(showFields.commercial).filter((f) => !ALWAYS_VISIBLE.includes(f)).sort()
      : [];

    const showOut: string[] | Record<string, string[]> =
      resArr.join(",") === comArr.join(",")
        ? resArr
        : { residential: resArr, commercial: comArr };

    const labelsOut: Record<string, string | Record<string, string>> = {};
    for (const [key, { residential, commercial }] of Object.entries(labels)) {
      const lr = allowed.residential ? residential.trim() : "";
      const lc = allowed.commercial ? commercial.trim() : "";
      if (!lr && !lc) continue;
      if (lr === lc) {
        labelsOut[key] = lr;
      } else {
        const labelObj: Record<string, string> = {};
        if (lr) labelObj.residential = lr;
        if (lc) labelObj.commercial = lc;
        labelsOut[key] = labelObj;
      }
    }

    // Orden: solo guardar los que difieren del default
    const orderOut: Record<string, number> = {};
    for (const [key, num] of Object.entries(order)) {
      if (num !== DEFAULT_ORDER[key]) {
        orderOut[key] = num;
      }
    }

    onSave({ show: showOut, labels: labelsOut, ...(Object.keys(orderOut).length > 0 ? { order: orderOut } : {}) });
    onOpenChange(false);
  };

  const renderEye = (field: { key: string; defaultLabel: string }, destType: DestType) => {
    const isAvailable = availableDestTypes.includes(destType);
    const isVisible = showFields[destType].has(field.key) || ALWAYS_VISIBLE.includes(field.key);
    const isLocked = ALWAYS_VISIBLE.includes(field.key);
    const tooltipText = !isAvailable ? "No aplica a esta clasificacion" : isLocked ? "Siempre visible" : isVisible ? "Visible" : "Oculto";
    return (
      <Tooltip>
        <TooltipTrigger className="inline-flex">
          <button
            type="button"
            onClick={() => toggleField(field.key, destType)}
            disabled={isLocked || !isAvailable}
            className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md transition-all ${
              isLocked || !isAvailable
                ? "text-muted-foreground/30 cursor-not-allowed"
                : isVisible
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {isLocked || !isAvailable ? (
              <Lock className="h-3.5 w-3.5" />
            ) : isVisible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Grilla: # orden (72px) + campo (200px) + una columna por cada tipo disponible
  const gridCols = ["72px", "200px", ...availableDestTypes.map(() => "1fr")].join(" ");
  const showRes = availableDestTypes.includes("residential");
  const showCom = availableDestTypes.includes("commercial");

  // Campos ordenados por el número de orden
  const sortedFields = [...ALL_FIELDS].sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99));

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

        <div className="modal-body overflow-hidden p-0">
          {/* Header de la matriz */}
          <div
            className="grid bg-muted/80 border-b border-border"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="flex items-center justify-center px-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              #
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Campo
            </div>
            {showRes && (
              <div className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 border-l border-border">
                <Home className="h-3.5 w-3.5" />
                <span>Habitacional</span>
              </div>
            )}
            {showCom && (
              <div className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600 border-l border-border">
                <Building2 className="h-3.5 w-3.5" />
                <span>Comercial</span>
              </div>
            )}
          </div>

          {/* Filas de la matriz */}
          <div className="flex flex-col">
            {sortedFields.map((field) => {
              const isLocked = ALWAYS_VISIBLE.includes(field.key);
              const fieldLabels = labels[field.key] || { residential: "", commercial: "" };
              const resLabel = fieldLabels.residential ?? "";
              const comLabel = fieldLabels.commercial ?? "";
              const resVisible = showFields.residential.has(field.key) || isLocked;
              const comVisible = showFields.commercial.has(field.key) || isLocked;
              const fieldOrder = order[field.key] ?? 0;
              return (
                <div
                  key={field.key}
                  className="grid border-b border-border/60 last:border-b-0 items-center hover:bg-muted/30 transition-colors"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  {/* Columna: numero de orden */}
                  <div className="flex items-center justify-center px-1 py-2">
                    <Select
                      value={String(fieldOrder)}
                      onValueChange={(v) => updateOrder(field.key, parseInt(v ?? "0") || 0)}
                    >
                      <SelectTrigger className="h-7 w-14 text-[12px] px-1.5 py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Columna: nombre del campo */}
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <span className="text-[13px] font-medium text-foreground">{field.defaultLabel}</span>
                    {isLocked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
                  </div>

                  {/* Columna: Habitacional */}
                  {showRes && (
                    <div className="flex items-center gap-2 px-3 py-2 border-l border-border/60">
                      {renderEye(field, "residential")}
                      <Input
                        type="text"
                        placeholder={field.defaultLabel}
                        value={resLabel}
                        onChange={(e) => updateLabel(field.key, "residential", e.target.value)}
                        className={`app-input flex-1 ${!resVisible ? "opacity-35 bg-transparent cursor-not-allowed" : ""}`}
                        disabled={!resVisible}
                      />
                    </div>
                  )}

                  {/* Columna: Comercial */}
                  {showCom && (
                    <div className="flex items-center gap-2 px-3 py-2 border-l border-border/60">
                      {renderEye(field, "commercial")}
                      <Input
                        type="text"
                        placeholder={field.defaultLabel}
                        value={comLabel}
                        onChange={(e) => updateLabel(field.key, "commercial", e.target.value)}
                        className={`app-input flex-1 ${!comVisible ? "opacity-35 bg-transparent cursor-not-allowed" : ""}`}
                        disabled={!comVisible}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
