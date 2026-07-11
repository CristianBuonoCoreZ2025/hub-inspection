"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getBuildingAges, createBuildingAge, updateBuildingAge, deleteBuildingAge } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, CalendarDays } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BuildingAgePage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string }>({"name":""});

  const { data: items, isLoading } = useQuery({
    queryKey: ["antiguedades"],
    queryFn: getBuildingAges,
  });

  const createMutation = useMutation({
    mutationFn: createBuildingAge,
    onSuccess: () => {
      toast.success("Antiguedad Inmueble creado");
      queryClient.invalidateQueries({ queryKey: ["antiguedades"] });
      setOpen(false);
      setFormData({"name":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBuildingAge>[1] }) => updateBuildingAge(id, input),
    onSuccess: () => {
      toast.success("Antiguedad Inmueble actualizado");
      queryClient.invalidateQueries({ queryKey: ["antiguedades"] });
      setOpen(false);
      setEditingId(null);
      setFormData({"name":""});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBuildingAge,
    onSuccess: () => {
      toast.success("Antiguedad Inmueble desactivado");
      queryClient.invalidateQueries({ queryKey: ["antiguedades"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = items?.filter((c) =>
    [c.name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (c) => c.name,
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nombre es requerido");
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
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Antiguedad Inmueble</h1>
        <div className="app-grid-filters">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="app-input h-8 max-w-[180px]" />
        </div>
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingId(null); setFormData({"name":""}); setOpen(true); }} className="btn-create btn-sm shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id}>
                  <td><span className={`app-status-dot ${item.is_active ? "app-status-on" : "app-status-off"}`} /></td>
                  <td className="font-medium">{item.name}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                          setEditingId(item.id);
                          setFormData({ name: item.name || "" });
                          setOpen(true);
                        }}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {canDelete("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
                          <Trash2 className="h-4 w-4" />
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
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <CalendarDays className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nuevo"} Antiguedad Inmueble
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="btn-save btn-footer">
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
