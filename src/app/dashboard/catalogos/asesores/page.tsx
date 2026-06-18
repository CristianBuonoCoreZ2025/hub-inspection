"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdvisors, createAdvisor, updateAdvisor, deleteAdvisor } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AsesoresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", country: "Chile" });

  const { data: advisors, isLoading } = useQuery({
    queryKey: ["advisors"],
    queryFn: getAdvisors,
  });

  const createMutation = useMutation({
    mutationFn: createAdvisor,
    onSuccess: () => { toast.success("Asesor creado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); setOpen(false); setFormData({ name: "", email: "", phone: "", country: "Chile" }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAdvisor>[1] }) => updateAdvisor(id, input),
    onSuccess: () => { toast.success("Asesor actualizado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdvisor,
    onSuccess: () => { toast.success("Asesor desactivado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = advisors?.filter((a) =>
    [a.name, a.email, a.phone].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Asesores</h1>
        <p className="app-page-lead">Mantenedor de catalogo de asesores de seguros.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar asesor..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full max-w-sm" />
        </div>
        <Button onClick={() => { setEditingId(null); setFormData({ name: "", email: "", phone: "", country: "Chile" }); setOpen(true); }} className="btn-create btn-sm">
          <Plus className="mr-2 h-4 w-4" /> Agregar Item
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead><tr><th className="w-10"></th><th>Nombre</th><th>Email</th><th>Telefono</th><th>Pais</th><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : filtered?.map((a) => (
              <tr key={a.id}>
                <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                <td className="font-medium">{a.name}</td>
                <td>{a.email || "—"}</td>
                <td>{a.phone || "—"}</td>
                <td>{a.country}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(a.id); setFormData({ name: a.name, email: a.email || "", phone: a.phone || "", country: a.country }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este asesor?")) deleteMutation.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><UserCheck className="h-4 w-4" /></div>
              {editingId ? "Editar Asesor" : "Nuevo Asesor"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-grid">
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Juan Perez" className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">Email</Label><Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Telefono</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Pais</Label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="app-input" /></div>
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
