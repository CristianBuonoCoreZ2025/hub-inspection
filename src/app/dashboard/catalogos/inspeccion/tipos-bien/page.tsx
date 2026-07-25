"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContentGoodTypes, createContentGoodType, updateContentGoodType, deleteContentGoodType } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Package, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ContentGoodType } from "@/types";

export default function TiposBienPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["content-good-types"],
    queryFn: getContentGoodTypes,
  });

  const filtered = useMemo(() => {
    if (!search) return items || [];
    return (items || []).filter((i) =>
      `${i.name} ${i.description || ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const createMutation = useMutation({
    mutationFn: createContentGoodType,
    onSuccess: () => {
      toast.success("Tipo de bien creado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ContentGoodType> }) => updateContentGoodType(id, input),
    onSuccess: () => {
      toast.success("Tipo de bien actualizado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentGoodType,
    onSuccess: () => {
      toast.success("Tipo de bien eliminado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item: ContentGoodType) => {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const payload = { name: name.trim(), description: description.trim() || null };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="app-panel space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="app-section-title flex items-center gap-2">
          <Package className="h-4 w-4" />
          Tipos de Bien
        </h2>
        {canCreate("catalogos_inspeccion") && (
          <Button onClick={openNew} className="pg-btn-platinum">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nuevo
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="app-input w-full max-w-xs"
        />
      </div>

      <div className="app-data-table-wrap overflow-auto">
        <table className="app-data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th className="w-[80px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="text-center app-body py-4">Cargando...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center app-body py-4 text-muted-foreground">Sin tipos de bien registrados.</td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td className="app-body font-medium">{item.name}</td>
                  <td className="app-body text-muted-foreground">{item.description || "—"}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit("catalogos_inspeccion") && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete("catalogos_inspeccion") && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm text-rose-500 hover:text-rose-600" onClick={() => { if (confirm("¿Eliminar este tipo de bien?")) deleteMutation.mutate(item.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{editingId ? "Editar Tipo de Bien" : "Nuevo Tipo de Bien"}</DialogTitle>
          <div className="space-y-3 py-2">
            <div className="modal-field">
              <Label className="app-field-label">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="app-input w-full" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Descripción</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="app-input w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
