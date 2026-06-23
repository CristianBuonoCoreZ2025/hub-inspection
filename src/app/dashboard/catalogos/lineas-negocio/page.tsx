"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBusinessLines, createBusinessLine, updateBusinessLine, deleteBusinessLine, getCountries, getClaimTypes } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Tag } from "lucide-react";

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

export default function LineasNegocioPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", name: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

  const { data: lines, isLoading } = useQuery({
    queryKey: ["business-lines"],
    queryFn: getBusinessLines,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const { data: claimTypes } = useQuery({
    queryKey: ["claim-types"],
    queryFn: getClaimTypes,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createBusinessLine,
    onSuccess: () => { toast.success("Linea creada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBusinessLine>[1] }) => updateBusinessLine(id, input),
    onSuccess: () => { toast.success("Linea actualizada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBusinessLine,
    onSuccess: () => { toast.success("Linea desactivada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = lines?.filter((l) =>
    [l.name, l.claim_type, l.ramo_fecu, l.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Lineas de Negocio</h1>
        <p className="app-page-lead">Mantenedor de catalogo de lineas de negocio / ramos.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar linea..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-sm" />
        </div>
        <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="btn-create btn-sm">
          <Plus className="mr-2 h-4 w-4" /> Agregar Item
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead><tr><th className="w-10"></th><th>País</th><th>Tipo Siniestro</th><th>Línea de Negocio</th><th>Ramo FECU</th><th>Descripcion</th><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : filtered?.map((l) => (
              <tr key={l.id}>
                <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                <td>{countries?.find((c) => c.id === l.country_id)?.name || "—"}</td>
                <td>{claimTypes?.find((ct) => ct.id === l.claim_type_id)?.name || l.claim_type || "—"}</td>
                <td className="font-medium">{l.name}</td>
                <td>{l.ramo_fecu || "—"}</td>
                <td className="max-w-[300px] truncate text-muted-foreground">{l.description || "—"}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(l.id); setFormData({ country_id: l.country_id || "", name: l.name, claim_type: l.claim_type || "", claim_type_id: l.claim_type_id || "", ramo_fecu: l.ramo_fecu || "", description: l.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta linea?")) deleteMutation.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen} modal={true}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Tag className="h-4 w-4" /></div>
              {editingId ? "Editar Linea" : "Nueva Linea"}
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
                  <Label className="app-field-label">Tipo Siniestro</Label>
                  <Select
                    value={formData.claim_type_id}
                    onValueChange={(v) => setFormData({ ...formData, claim_type_id: v ?? "" })}
                    items={claimTypes?.map((ct) => ({ value: ct.id, label: ct.name })) || []}
                  >
                    <SelectTrigger className="app-input h-9"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      {claimTypes?.map((ct) => (<SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Línea de Negocio <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Accidentes Personales" className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">Ramo FECU</Label><Input value={formData.ramo_fecu} onChange={(e) => setFormData({ ...formData, ramo_fecu: e.target.value })} className="app-input" /></div>
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
