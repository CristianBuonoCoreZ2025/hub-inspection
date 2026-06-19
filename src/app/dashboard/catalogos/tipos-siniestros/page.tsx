"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaimTypes, createClaimType, updateClaimType, deleteClaimType } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ClaimTypePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; description: string; sw_type: string; icon: string }>({"name":"","description":"","sw_type":"","icon":""});

  const { data: items, isLoading } = useQuery({
    queryKey: ["tipos_siniestros"],
    queryFn: getClaimTypes,
  });

  const createMutation = useMutation({
    mutationFn: createClaimType,
    onSuccess: () => {
      toast.success("Tipos Siniestro creado");
      queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
      setOpen(false);
      setFormData({"name":"","description":"","sw_type":"","icon":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateClaimType>[1] }) => updateClaimType(id, input),
    onSuccess: () => {
      toast.success("Tipos Siniestro actualizado");
      queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
      setOpen(false);
      setEditingId(null);
      setFormData({"name":"","description":"","sw_type":"","icon":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaimType,
    onSuccess: () => {
      toast.success("Tipos Siniestro desactivado");
      queryClient.invalidateQueries({ queryKey: ["tipos_siniestros"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = items?.filter((c) =>
    [c.name, c.description, c.sw_type, c.icon].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    const payload = { ...formData, sw_type: formData.sw_type ? parseInt(formData.sw_type, 10) : undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Tipos Siniestro</h1>
        <p className="app-page-lead">Mantenedor de catalogo.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Button
          onClick={() => { setEditingId(null); setFormData({"name":"","description":"","sw_type":"","icon":""}); setOpen(true); }}
          className="btn-create btn-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Item
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Nombre</th>
              <th>Descripcion</th>
              <th>SW Type</th>
              <th>Icono</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              filtered?.map((item) => (
                <tr key={item.id}>
                  <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                  <td className="font-medium">{item.name}</td>
                  <td className="font-medium">{item.description}</td>
                  <td className="font-medium">{item.sw_type}</td>
                  <td className="font-medium">{item.icon}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                        setEditingId(item.id);
                        setFormData({ name: item.name || "", description: item.description || "", sw_type: item.sw_type != null ? String(item.sw_type) : "", icon: item.icon || "" });
                        setOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <FileWarning className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nuevo"} Tipos Siniestro
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripcion</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripcion" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">SW Type</Label>
                <Input value={formData.sw_type} onChange={(e) => setFormData({ ...formData, sw_type: e.target.value })} placeholder="SW Type" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Icono</Label>
                <Input value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} placeholder="Icono" className="app-input" />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="btn-save btn-footer">
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
