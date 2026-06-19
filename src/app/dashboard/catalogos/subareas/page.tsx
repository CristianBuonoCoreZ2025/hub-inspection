"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSubareas, createSubarea, updateSubarea, deleteSubarea } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Grid3X3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SubareaPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ letter: string; name: string }>({"letter":"","name":""});

  const { data: items, isLoading } = useQuery({
    queryKey: ["subareas"],
    queryFn: getSubareas,
  });

  const createMutation = useMutation({
    mutationFn: createSubarea,
    onSuccess: () => {
      toast.success("Subareas creado");
      queryClient.invalidateQueries({ queryKey: ["subareas"] });
      setOpen(false);
      setFormData({"letter":"","name":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSubarea>[1] }) => updateSubarea(id, input),
    onSuccess: () => {
      toast.success("Subareas actualizado");
      queryClient.invalidateQueries({ queryKey: ["subareas"] });
      setOpen(false);
      setEditingId(null);
      setFormData({"letter":"","name":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubarea,
    onSuccess: () => {
      toast.success("Subareas desactivado");
      queryClient.invalidateQueries({ queryKey: ["subareas"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = items?.filter((c) =>
    [c.letter, c.name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.letter.trim()) {
      toast.error("Letra es requerido");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Subareas</h1>
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
          onClick={() => { setEditingId(null); setFormData({"letter":"","name":""}); setOpen(true); }}
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
              <th>Letra</th>
              <th>Nombre</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              filtered?.map((item) => (
                <tr key={item.id}>
                  <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                  <td className="font-medium">{item.letter}</td>
                  <td className="font-medium">{item.name}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                        setEditingId(item.id);
                        setFormData({ letter: item.letter || "", name: item.name || "" });
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
                <Grid3X3 className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nuevo"} Subareas
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-field">
                <Label className="app-field-label">Letra <span className="text-red-500">*</span></Label>
                <Input value={formData.letter} onChange={(e) => setFormData({ ...formData, letter: e.target.value })} placeholder="Letra" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
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
