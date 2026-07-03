"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDamages, createDamage, updateDamage, deleteDamage } from "@/services/inspections";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InspectionDamage } from "@/types";

const severityLabels: Record<string, string> = {
  low: "Leve",
  medium: "Moderado",
  high: "Grave",
  total: "Total",
};

const severityOptions = [
  { value: "low", label: "Leve" },
  { value: "medium", label: "Moderado" },
  { value: "high", label: "Grave" },
  { value: "total", label: "Total" },
];

// Categorías específicas de daño (edificio + contenido)
const damageCategories = [
  { value: "structural", label: "Estructural" },
  { value: "roof", label: "Cubierta / Techumbre" },
  { value: "electrical", label: "Inst. Eléctricas" },
  { value: "plumbing", label: "Inst. Sanitarias / Gas" },
  { value: "finishes", label: "Terminaciones (muros/pisos/cielos)" },
  { value: "openings", label: "Aberturas (ventanas/puertas)" },
  { value: "content", label: "Contenido" },
];

const categoryLabels: Record<string, string> = Object.fromEntries(
  damageCategories.map((c) => [c.value, c.label])
);

// Dependencias / recintos comunes
const dependencyOptions = [
  "Cocina", "Baño", "Dormitorio principal", "Dormitorio secundario",
  "Living / Comedor", "Pasillo", "Hall", "Lavadero", "Bodega",
  "Garage", "Exterior", "Terraza", "Azotea", "Sótano", "Otro",
];

const emptyDamage: Omit<InspectionDamage, "id" | "created_at" | "updated_at"> = {
  session_id: "",
  category: "structural",
  subcategory: null,
  description: "",
  observations: null,
  severity: "low",
  dependency: null,
  sector: null,
  materiality_type: null,
  unit: null,
  quantity: null,
  damage_type: "structural",
  product: null,
  brand_model: null,
  purchase_date: null,
  estimated_amount: null,
};

export default function DamagesTab({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyDamage>({ ...emptyDamage, session_id: sessionId });

  const { data: damages, isLoading } = useQuery({
    queryKey: ["damages", sessionId],
    queryFn: () => getDamages(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createDamage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
      setForm({ ...emptyDamage, session_id: sessionId });
      setEditing(null);
      toast.success("Daño registrado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateDamage>[1] }) =>
      updateDamage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
      setEditing(null);
      toast.success("Daño actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDamage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
      toast.success("Daño eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isEditingNew = editing === "new";
  const totalAmount = damages?.reduce((sum, d) => sum + (d.estimated_amount || 0), 0) || 0;

  return (
    <div className="app-stack">
      {/* Header con total */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {damages?.length || 0} registros · Total estimado: <span className="font-semibold text-foreground">${totalAmount.toLocaleString("es-CL")}</span>
        </div>
        <Button
          onClick={() => { setEditing("new"); setForm({ ...emptyDamage, session_id: sessionId }); }}
          className="btn-create btn-sm"
          disabled={isEditingNew}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Nuevo Daño
        </Button>
      </div>

      {/* Formulario de nuevo/edición */}
      {isEditingNew && (
        <div className="app-panel space-y-3">
          <h3 className="app-section-title">
            Nuevo Registro de Daño
          </h3>
          <div className="modal-grid-3">
            <div>
              <label className="app-field-label text-[11px]">Categoría</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, damage_type: e.target.value })} className="app-input h-7 w-full text-[13px]">
                {damageCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="app-field-label text-[11px]">Dependencia / Recinto</label>
              <select value={form.dependency || ""} onChange={(e) => setForm({ ...form, dependency: e.target.value || null })} className="app-input h-7 w-full text-[13px]">
                <option value="">Seleccionar...</option>
                {dependencyOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="app-field-label text-[11px]">Severidad</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as InspectionDamage["severity"] })} className="app-input h-7 w-full text-[13px]">
                {severityOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="app-field-label text-[11px]">Descripción</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Grieta en muro de carga, filtración en techumbre..." className="app-input h-7 w-full text-[13px]" />
            </div>
            <div className="col-span-2">
              <label className="app-field-label text-[11px]">Observaciones</label>
              <input value={form.observations || ""} onChange={(e) => setForm({ ...form, observations: e.target.value || null })} placeholder="Observaciones adicionales..." className="app-input h-7 w-full text-[13px]" />
            </div>
            <div>
              <label className="app-field-label text-[11px]">Monto Estimado ($)</label>
              <input type="number" value={form.estimated_amount ?? ""} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value ? Number(e.target.value) : null })} placeholder="0" className="app-input h-7 w-full text-[13px]" />
            </div>
            {form.category === "content" && (
              <>
                <div>
                  <label className="app-field-label text-[11px]">Producto</label>
                  <input value={form.product || ""} onChange={(e) => setForm({ ...form, product: e.target.value || null })} placeholder="Ej. Televisor" className="app-input h-7 w-full text-[13px]" />
                </div>
                <div>
                  <label className="app-field-label text-[11px]">Marca/Modelo</label>
                  <input value={form.brand_model || ""} onChange={(e) => setForm({ ...form, brand_model: e.target.value || null })} placeholder="Ej. Samsung 55 pulgadas" className="app-input h-7 w-full text-[13px]" />
                </div>
                <div>
                  <label className="app-field-label text-[11px]">Fecha Compra</label>
                  <input type="date" value={form.purchase_date || ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })} className="app-input h-7 w-full text-[13px]" />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="btn-cancel btn-sm">Cancelar</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.description || createMutation.isPending}
              className="btn-save btn-sm"
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* Tabla de daños */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando daños...</div>
      ) : !damages?.length ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">
          No hay daños registrados. Crea el primero con el botón &quot;Nuevo Daño&quot;.
        </div>
      ) : (
        <div className="app-data-table-wrap overflow-auto">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Dependencia</th>
                <th>Descripción</th>
                <th>Severidad</th>
                <th className="text-right">Monto ($)</th>
                <th className="w-[80px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {damages.map((d) => (
                <tr key={d.id}>
                  <td><Badge variant="outline" className="text-[11px]">{categoryLabels[d.category] || d.category}</Badge></td>
                  <td className="text-[11px]">{d.dependency || "—"}</td>
                  <td className="text-[11px] max-w-[200px] truncate">{d.description}</td>
                  <td>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      d.severity === "total" ? "bg-red-100 text-red-700" :
                      d.severity === "high" ? "bg-orange-100 text-orange-700" :
                      d.severity === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {severityLabels[d.severity] || d.severity}
                    </span>
                  </td>
                  <td className="text-right text-[13px] font-medium">${(d.estimated_amount || 0).toLocaleString("es-CL")}</td>
                  <td>
                    <div className="app-row-actions">
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon h-7 w-7" onClick={() => { setEditing(d.id); setForm({ ...d, session_id: sessionId }); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon h-7 w-7" onClick={() => { if (confirm("¿Eliminar este daño?")) deleteMutation.mutate(d.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
