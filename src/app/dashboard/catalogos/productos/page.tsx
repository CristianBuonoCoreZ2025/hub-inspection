"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInsuranceProducts, createInsuranceProduct, updateInsuranceProduct, deleteInsuranceProduct, getBusinessLines, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", business_line_id: "", name: "", description: "" });

  const { data: products, isLoading } = useQuery({
    queryKey: ["insurance-products"],
    queryFn: getInsuranceProducts,
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: getBusinessLines,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createInsuranceProduct,
    onSuccess: () => { toast.success("Producto creado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateInsuranceProduct>[1] }) => updateInsuranceProduct(id, input),
    onSuccess: () => { toast.success("Producto actualizado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInsuranceProduct,
    onSuccess: () => { toast.success("Producto desactivado"); queryClient.invalidateQueries({ queryKey: ["insurance-products"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = products?.filter((p) =>
    [p.name, p.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setFormData({ country_id: defaultCountryId, business_line_id: "", name: "", description: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!formData.business_line_id) { toast.error("Debe seleccionar una linea de negocio"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Ramos / Productos</h1>
        <p className="app-page-lead">Mantenedor de catalogo de productos y ramos dentro de lineas de negocio.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-sm" />
        </div>
        <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="btn-create btn-sm">
          <Plus className="mr-2 h-4 w-4" /> Agregar Item
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead><tr><th className="w-10"></th><th>País</th><th>Nombre</th><th>Linea de Negocio</th><th>Descripcion</th><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : filtered?.map((p) => (
              <tr key={p.id}>
                <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                <td>{countries?.find((c) => c.id === p.country_id)?.name || "—"}</td>
                <td className="font-medium">{p.name}</td>
                <td>{businessLines?.find((l) => l.id === p.business_line_id)?.name || "—"}</td>
                <td className="max-w-[300px] truncate text-muted-foreground">{p.description || "—"}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(p.id); setFormData({ country_id: p.country_id || "", business_line_id: p.business_line_id, name: p.name, description: p.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este producto?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Box className="h-4 w-4" /></div>
              {editingId ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">País</Label>
                  <Select
                    value={formData.country_id}
                    onValueChange={(v) => setFormData({ ...formData, country_id: v || "" })}
                    items={countries?.map((c) => ({ value: c.id, label: c.name })) || []}
                  >
                    <SelectTrigger className="app-input h-9">
                      <SelectValue placeholder="Seleccionar país..." />
                    </SelectTrigger>
                    <SelectContent>
                      {countries?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Linea de Negocio <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.business_line_id}
                    onValueChange={(v) => setFormData({ ...formData, business_line_id: v ?? "" })}
                    items={businessLines?.map((l) => ({ value: l.id, label: l.name })) || []}
                  >
                    <SelectTrigger className="app-input h-9"><SelectValue placeholder="Seleccionar linea..." /></SelectTrigger>
                    <SelectContent>
                      {businessLines?.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Hogar Full Protegido" className="app-input" />
                </div>
                <div className="modal-field modal-field-full"><Label className="app-field-label">Descripcion</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="app-input" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="btn-save btn-footer">{createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
