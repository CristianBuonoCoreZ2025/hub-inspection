"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Eye, EyeOff, Lock } from "lucide-react";

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

const ALWAYS_VISIBLE = ["age_years", "owner_name", "worker_resident_count"];

const FIELD_GROUPS: {
  title: string;
  icon: React.ElementType;
  fields: { key: string; defaultLabel: string }[];
}[] = [
  {
    title: "Base",
    icon: Lock,
    fields: [
      { key: "age_years", defaultLabel: "Antigüedad del Inmueble" },
      { key: "owner_name", defaultLabel: "Nombre Propietario(s)" },
      { key: "worker_resident_count", defaultLabel: "N° Habitantes" },
    ],
  },
  {
    title: "Propiedad",
    icon: Settings2,
    fields: [
      { key: "apartment_number", defaultLabel: "N° Dpto / Oficina" },
      { key: "floor_count", defaultLabel: "N° Pisos" },
      { key: "built_surface", defaultLabel: "Superficie Construida (m²)" },
      { key: "room_count", defaultLabel: "Cantidad Espacios" },
      { key: "bathroom_count", defaultLabel: "Cantidad Baños" },
      { key: "is_habitable", defaultLabel: "¿Se encuentra habitable?" },
    ],
  },
  {
    title: "Comercial",
    icon: Settings2,
    fields: [
      { key: "office_count", defaultLabel: "N° Oficinas" },
      { key: "warehouse_count", defaultLabel: "N° Bodegas" },
      { key: "branch_count", defaultLabel: "Sucursales" },
      { key: "business_line", defaultLabel: "Rubro de la Empresa" },
    ],
  },
];

export function FieldConfigEditor({ open, onOpenChange, currentConfig, onSave, itemName }: FieldConfigEditorProps) {
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

  if (open && !lastOpen) {
    setLastOpen(true);
    setShowFields(buildShow());
    setHideFields(buildHide());
    setLabels(buildLabels());
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  const toggleField = (field: string) => {
    if (ALWAYS_VISIBLE.includes(field)) return;
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
            {itemName}
          </DialogTitle>
          <DialogDescription className="modal-subtitle">
            Click en el ojo para mostrar u ocultar campos del acta.
          </DialogDescription>
        </div>

        <div className="modal-body space-y-3">
          {FIELD_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.title}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h4>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {group.fields.map((field) => {
                    const isVisible = showFields.has(field.key) || ALWAYS_VISIBLE.includes(field.key);
                    const isLocked = ALWAYS_VISIBLE.includes(field.key);
                    return (
                      <div
                        key={field.key}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                          isVisible ? "bg-background" : "bg-muted/30 opacity-60"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleField(field.key)}
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
                          {isLocked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : isVisible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <span className={`text-[13px] font-medium min-w-[140px] ${isVisible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {field.defaultLabel}
                        </span>
                        <Input
                          type="text"
                          placeholder={field.defaultLabel}
                          value={labels[field.key] || ""}
                          onChange={(e) => updateLabel(field.key, e.target.value)}
                          className="app-input h-7 text-[12px] flex-1"
                          disabled={!isVisible}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
