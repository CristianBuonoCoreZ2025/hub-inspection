"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCommunes, createCommune, updateCommune, deleteCommune } from "@/services/catalogs";
import { getCities } from "@/services/catalogs";
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

export default function ComunasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ city_id: "", name: "" });

  const { data: communes, isLoading } = useQuery({
    queryKey: ["communes"],
    queryFn: () => getCommunes(),
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: () => getCities(),
  });

  const createMutation = useMutation({
    mutationFn: createCommune,
    onSuccess: () => {
      toast.success("Comuna creada");
      queryClient.invalidateQueries({ queryKey: ["communes"] });
      setOpen(false);
      setFormData({ city_id: "", name: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCommune>[1] }) => updateCommune(id, input),
    onSuccess: () => {
      toast.success("Comuna actualizada");
      queryClient.invalidateQueries({ queryKey: ["communes"] });
      setOpen(false);
      setEditingId(null);
      setFormData({ city_id: "", name: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCommune,
    onSuccess: () => {
      toast.success("Comuna desactivada");
      queryClient.invalidateQueries({ queryKey: ["communes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = communes?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.city_id) {
      toast.error("Nombre y ciudad son requeridos");
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
        <h1 className="app-page-title">Comunas</h1>
        <p className="app-page-lead">Mantenedor de comunas por ciudad.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comuna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Button
          onClick={() => { setEditingId(null); setFormData({ city_id: "", name: "" }); setOpen(true); }}
          className="btn-create btn-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Comuna
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Nombre</th>
              <th>Ciudad</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              filtered?.map((commune) => (
                <tr key={commune.id}>
                  <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                  <td className="font-medium">{commune.name}</td>
                  <td className="text-muted-foreground">{cities?.find(c => c.id === commune.city_id)?.name || commune.city_id}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                        setEditingId(commune.id);
                        setFormData({ city_id: commune.city_id, name: commune.name });
                        setOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta comuna?")) deleteMutation.mutate(commune.id); }}>
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
                <Landmark className="h-4 w-4" />
              </div>
              {editingId ? "Editar Comuna" : "Nueva Comuna"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-field">
                <Label className="app-field-label">Ciudad <span className="text-red-500">*</span></Label>
                <Select value={formData.city_id} onValueChange={(v) => setFormData({ ...formData, city_id: v ?? "" })}>
                  <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar ciudad..." /></SelectTrigger>
                  <SelectContent>
                    {cities?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Las Condes" className="app-input" />
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
