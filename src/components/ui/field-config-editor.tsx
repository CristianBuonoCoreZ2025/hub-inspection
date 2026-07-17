"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Check, X } from "lucide-react";

interface FieldConfig {
  show?: string[];
  hide?: string[];
  labels?: Record<string, string>;
}

interface FieldConfigEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: FieldConfig;
  onSave: (config: FieldConfig) => void;
  itemName: string;
}

// Campos siempre visibles por defecto (no se pueden ocultar)
const ALWAYS_VISIBLE = ["age_years", "owner_name", "worker_resident_count"];

// Grupos de campos para la matriz
const FIELD_GROUPS: {
  title: string;
  fields: { key: string; defaultLabel: string; type: "text" | "number" | "select" | "toggle" }[];
}[] = [
  {
    title: "Campos Base (siempre visibles)",
    fields: [
      { key: "age_years", defaultLabel: "Antigüedad del Inmueble", type: "select" },
      { key: "owner_name", defaultLabel: "Nombre Propietario(s)", type: "text" },
      { key: "worker_resident_count", defaultLabel: "N° Habitantes", type: "number" },
    ],
  },
  {
    title: "Campos de Propiedad",
    fields: [
      { key: "apartment_number", defaultLabel: "N° Dpto / Oficina", type: "text" },
      { key: "floor_count", defaultLabel: "N° Pisos", type: "number" },
      { key: "built_surface", defaultLabel: "Superficie Construida (m²)", type: "number" },
      { key: "room_count", defaultLabel: "Cantidad Espacios", type: "number" },
      { key: "bathroom_count", defaultLabel: "Cantidad Baños", type: "number" },
      { key: "is_habitable", defaultLabel: "¿Se encuentra habitable?", type: "toggle" },
    ],
  },
  {
    title: "Campos Comerciales",
    fields: [
      { key: "office_count", defaultLabel: "N° Oficinas", type: "number" },
      { key: "warehouse_count", defaultLabel: "N° Bodegas", type: "number" },
      { key: "branch_count", defaultLabel: "Sucursales", type: "number" },
      { key: "business_line", defaultLabel: "Rubro de la Empresa", type: "text" },
    ],
  },
];

export function FieldConfigEditor({ open, onOpenChange, currentConfig, onSave, itemName }: FieldConfigEditorProps) {
  // Derivar estado inicial desde currentConfig cada vez que se abre
  const buildShow = () => {
    const show = new Set<string>(ALWAYS_VISIBLE);
    if (currentConfig?.show) currentConfig.show.forEach((f) => show.add(f));
    return show;
  };
  const buildHide = () => new Set(currentConfig?.hide || []);
  const buildLabels = () => ({ ...(currentConfig?.labels || {}) });

  const [showFields, setShowFields] = React.useState<Set<string>>(buildShow);
  const [hideFields, setHideFields] = React.useState<Set<string>>(buildHide);
  const [labels, setLabels] = React.useState<Record<string, string>>(buildLabels);
  const [lastOpen, setLastOpen] = React.useState(false);

  // Reset state when dialog opens (sin useEffect, evita cascading renders)
  if (open && !lastOpen) {
    setLastOpen(true);
    setShowFields(buildShow());
    setHideFields(buildHide());
    setLabels(buildLabels());
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  const toggleField = (field: string) => {
    if (ALWAYS_VISIBLE.includes(field)) return; // No se puede ocultar
    setShowFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        setHideFields((h) => new Set(h).add(field));
      } else {
        next.add(field);
        setHideFields((h) => {
          const nh = new Set(h);
          nh.delete(field);
          return nh;
        });
      }
      return next;
    });
  };

  const updateLabel = (field: string, value: string) => {
    setLabels((prev) => {
      const next = { ...prev };
      if (value.trim() === "") {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave({
      show: Array.from(showFields).filter((f) => !ALWAYS_VISIBLE.includes(f)),
      hide: Array.from(hideFields),
      labels,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-lg" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-purple-500 text-white shadow-sm">
              <Settings2 className="h-4 w-4" />
            </div>
            Configurar Campos — {itemName}
          </DialogTitle>
          <DialogDescription className="modal-subtitle">
            Define qué campos del acta de inspección se muestran para esta clasificación/destino y personaliza los labels.
            Los campos base siempre están visibles.
          </DialogDescription>
        </div>

        <div className="modal-body space-y-4">
          {FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-[13px] font-semibold text-muted-foreground mb-2">{group.title}</h4>
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th className="w-16 text-center">Visible</th>
                    <th className="w-[200px]">Campo</th>
                    <th>Label Personalizado</th>
                  </tr>
                </thead>
                <tbody>
                  {group.fields.map((field) => {
                    const isVisible = showFields.has(field.key) || ALWAYS_VISIBLE.includes(field.key);
                    const isLocked = ALWAYS_VISIBLE.includes(field.key);
                    return (
                      <tr key={field.key} className={!isVisible ? "opacity-50" : ""}>
                        <td className="text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleField(field.key)}
                              className={`inline-flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                                isVisible
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-input hover:bg-muted"
                              }`}
                            >
                              {isVisible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-0" />}
                            </button>
                          )}
                        </td>
                        <td className="font-medium text-[13px]">{field.defaultLabel}</td>
                        <td>
                          <Input
                            type="text"
                            placeholder={field.defaultLabel}
                            value={labels[field.key] || ""}
                            onChange={(e) => updateLabel(field.key, e.target.value)}
                            className="app-input h-7 text-[12px]"
                            disabled={!isVisible}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="pg-btn-platinum" onClick={handleSave}>
            Guardar Configuración
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
