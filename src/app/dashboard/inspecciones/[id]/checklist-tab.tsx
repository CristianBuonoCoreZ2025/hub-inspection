"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChecklists, createChecklistItem, updateChecklistItem, deleteChecklistItem } from "@/services/inspections";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, Circle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const defaultAreas = [
  "Estructura",
  "Instalaciones Eléctricas",
  "Instalaciones Sanitarias",
  "Cubierta / Techumbre",
  "Cierros (ventanas/puertas)",
  "Mobiliario / Equipamiento",
  "Pavimentos / Muros",
  "Seguridad",
];

const statusConfig = {
  reviewed: { label: "Revisado", icon: CheckCircle, className: "text-emerald-500" },
  pending: { label: "Pendiente", icon: Circle, className: "text-amber-500" },
  not_applicable: { label: "N/A", icon: MinusCircle, className: "text-gray-400" },
};

type Status = "reviewed" | "pending" | "not_applicable";

export default function ChecklistTab({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState({ area: "", item: "" });

  const { data: items, isLoading } = useQuery({
    queryKey: ["checklists", sessionId],
    queryFn: () => getChecklists(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createChecklistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", sessionId] });
      setNewItem({ area: "", item: "" });
      toast.success("Item agregado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateChecklistItem>[1] }) =>
      updateChecklistItem(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklists", sessionId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChecklistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", sessionId] });
      toast.success("Item eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grouped = items?.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.area]) acc[item.area] = [];
    acc[item.area].push(item);
    return acc;
  }, {});

  const areas = grouped ? Object.keys(grouped).sort() : [];

  return (
    <div className="space-y-4">
      {/* Agregar item */}
      <div className="app-panel">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Agregar Item
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[150px]">
            <label className="app-field-label text-[11px]">Área</label>
            <select
              value={newItem.area}
              onChange={(e) => setNewItem({ ...newItem, area: e.target.value })}
              className="app-input h-8 w-full text-[13px]"
            >
              <option value="">Seleccionar área...</option>
              {defaultAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="app-field-label text-[11px]">Item a verificar</label>
            <input
              value={newItem.item}
              onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
              placeholder="Ej. Estado de vigas principales..."
              className="app-input h-8 w-full text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.area && newItem.item) {
                  createMutation.mutate({
                    session_id: sessionId,
                    area: newItem.area,
                    item: newItem.item,
                    status: "pending",
                    notes: null,
                  });
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              if (!newItem.area || !newItem.item) return;
              createMutation.mutate({
                session_id: sessionId,
                area: newItem.area,
                item: newItem.item,
                status: "pending",
                notes: null,
              });
            }}
            disabled={!newItem.area || !newItem.item || createMutation.isPending}
            className="btn-create btn-sm h-8"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      </div>

      {/* Lista por área */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando checklist...</div>
      ) : areas.length === 0 ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">
          No hay items en el checklist. Agrega el primero arriba.
        </div>
      ) : (
        areas.map((area) => (
          <div key={area} className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {area}
            </h3>
            <div className="space-y-2">
              {grouped![area].map((item) => {
                const config = statusConfig[item.status as Status] || statusConfig.pending;
                const Icon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <button
                      onClick={() => {
                        const statuses: Status[] = ["pending", "reviewed", "not_applicable"];
                        const next = statuses[(statuses.indexOf(item.status as Status) + 1) % statuses.length];
                        updateMutation.mutate({ id: item.id, data: { status: next } });
                      }}
                      className="shrink-0"
                      title={config.label}
                    >
                      <Icon className={`h-5 w-5 ${config.className}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium">{item.item}</p>
                      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                    </div>
                    <input
                      type="text"
                      placeholder="Notas..."
                      defaultValue={item.notes || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (item.notes || "")) {
                          updateMutation.mutate({ id: item.id, data: { notes: e.target.value || null } });
                        }
                      }}
                      className="app-input h-7 w-full sm:w-[180px] text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="btn-danger btn-icon h-7 w-7"
                      onClick={() => { if (confirm("¿Eliminar este item?")) deleteMutation.mutate(item.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
