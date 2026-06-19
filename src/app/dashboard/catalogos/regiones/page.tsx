"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRegions, createRegion, updateRegion, deleteRegion } from "@/services/catalogs";
import { getCountries } from "@/services/countries";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, MapPin } from "lucide-react";

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

export default function RegionesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", code: "", name: "" });

  const { data: regions, isLoading } = useQuery({
    queryKey: ["regions"],
    queryFn: () => getRegions(),
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const createMutation = useMutation({
    mutationFn: createRegion,
    onSuccess: () => {
      toast.success("Region creada");
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      setOpen(false);
      setFormData({ country_id: "", code: "", name: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateRegion>[1] }) => updateRegion(id, input),
    onSuccess: () => {
      toast.success("Region actualizada");
      queryClient.invalidateQueries({ queryKey: ["regions"] });
      setOpen(false);
      setEditingId(null);
      setFormData({ country_id: "", code: "", name: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => {
      toast.success("Region desactivada");
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = regions?.filter((r) =>
    [r.name, r.code].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.country_id) {
      toast.error("Nombre y pais son requeridos");
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
        <h1 className="app-page-title">Regiones</h1>
        <p className="app-page-lead">Mantenedor de regiones por pais.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Button
          onClick={() => { setEditingId(null); setFormData({ country_id: "", code: "", name: "" }); setOpen(true); }}
          className="btn-create btn-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Region
        </Button>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Nombre</th>
              <th>Codigo</th>
              <th>Pais</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              filtered?.map((region) => (
                <tr key={region.id}>
                  <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                  <td className="font-medium">{region.name}</td>
                  <td className="text-muted-foreground">{region.code || "—"}</td>
                  <td className="text-muted-foreground">{countries?.find(c => c.id === region.country_id)?.name || region.country_id}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                        setEditingId(region.id);
                        setFormData({ country_id: region.country_id, code: region.code || "", name: region.name });
                        setOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta region?")) deleteMutation.mutate(region.id); }}>
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
                <MapPin className="h-4 w-4" />
              </div>
              {editingId ? "Editar Region" : "Nueva Region"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-field">
                <Label className="app-field-label">Pais <span className="text-red-500">*</span></Label>
                <Select value={formData.country_id} onValueChange={(v) => setFormData({ ...formData, country_id: v ?? "" })}>
                  <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar pais..." /></SelectTrigger>
                  <SelectContent>
                    {countries?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Codigo</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: 07" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Metropolitana de Santiago" className="app-input" />
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
