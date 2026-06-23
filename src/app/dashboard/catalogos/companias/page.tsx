"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInsuranceCompanies, createInsuranceCompany, updateInsuranceCompany, deleteInsuranceCompany, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CompaniasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", name: "", rut: "", address: "", line_of_business: "", code: "", type: "Generales" });

  const { data: companies, isLoading } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: getInsuranceCompanies,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createInsuranceCompany,
    onSuccess: () => { toast.success("Compañia creada"); queryClient.invalidateQueries({ queryKey: ["insurance-companies"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateInsuranceCompany>[1] }) => updateInsuranceCompany(id, input),
    onSuccess: () => { toast.success("Compañia actualizada"); queryClient.invalidateQueries({ queryKey: ["insurance-companies"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInsuranceCompany,
    onSuccess: () => { toast.success("Compañia desactivada"); queryClient.invalidateQueries({ queryKey: ["insurance-companies"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = companies?.filter((c) =>
    [c.name, c.rut, c.address, c.line_of_business, c.code, c.type].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", rut: "", address: "", line_of_business: "", code: "", type: "Generales" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Compañias de Seguros</h1>
        <p className="app-page-lead">Mantenedor de catalogo de compañias de seguros.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar compañia..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-sm" />
        </div>
        <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="btn-create btn-sm">
          <Plus className="mr-2 h-4 w-4" /> Agregar Item
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead><tr><th className="w-10"></th><th>País</th><th>Nombre</th><th>RUT</th><th>Direccion</th><th>Ramo</th><th>Codigo</th><th>Tipo</th><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={9} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={9} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : filtered?.map((c) => (
              <tr key={c.id}>
                <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                <td>{countries?.find((co) => co.id === c.country_id)?.name || "—"}</td>
                <td className="font-medium">{c.name}</td>
                <td>{c.rut || "—"}</td>
                <td className="max-w-[200px] truncate text-muted-foreground">{c.address || "—"}</td>
                <td>{c.line_of_business || "—"}</td>
                <td>{c.code || "—"}</td>
                <td>{c.type || "—"}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(c.id); setFormData({ country_id: c.country_id || "", name: c.name, rut: c.rut || "", address: c.address || "", line_of_business: c.line_of_business || "", code: c.code || "", type: c.type || "Generales" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta compañia?")) deleteMutation.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Landmark className="h-4 w-4" /></div>
              {editingId ? "Editar Compañia" : "Nueva Compañia"}
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
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: HDI Seguros S.A." className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">RUT</Label><Input value={formData.rut} onChange={(e) => setFormData({ ...formData, rut: e.target.value })} className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Codigo</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="app-input" /></div>
                <div className="modal-field modal-field-full"><Label className="app-field-label">Direccion</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Ramo</Label><Input value={formData.line_of_business} onChange={(e) => setFormData({ ...formData, line_of_business: e.target.value })} className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Tipo</Label><Input value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="Generales" className="app-input" /></div>
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
