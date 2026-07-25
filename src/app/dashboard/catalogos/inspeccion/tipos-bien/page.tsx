"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getContentGoodTypes, createContentGoodType, updateContentGoodType, deleteContentGoodType } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const SECTION = "catalogos_inspeccion";

interface FormState {
  name: string;
  description: string;
  requires_detail: boolean;
}

const EMPTY_FORM: FormState = { name: "", description: "", requires_detail: false };

export default function TiposBienPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const { data: items, isLoading } = useQuery({
    queryKey: ["content-good-types"],
    queryFn: getContentGoodTypes,
  });

  const createMutation = useMutation({
    mutationFn: createContentGoodType,
    onSuccess: () => {
      toast.success("Tipo de bien creado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
      setOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string; description?: string | null; requires_detail: boolean } }) =>
      updateContentGoodType(id, input),
    onSuccess: () => {
      toast.success("Tipo de bien actualizado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
      setOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentGoodType,
    onSuccess: () => {
      toast.success("Tipo de bien desactivado");
      queryClient.invalidateQueries({ queryKey: ["content-good-types"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(
    () =>
      (items || []).filter((i) =>
        `${i.name} ${i.description || ""}`.toLowerCase().includes(search.toLowerCase())
      ),
    [items, search]
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (i) => i.name,
    description: (i) => i.description || "",
  }, "name");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      requires_detail: formData.requires_detail,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title flex items-center gap-2 shrink-0">
          <Package className="h-5 w-5" />
          Tipos de Bien
        </h1>
        <div className="app-grid-filters">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-input h-8 w-full sm:max-w-[180px]"
          />
        </div>
        {canCreate(SECTION) && (
          <Button
            onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); setOpen(true); }}
            className="pg-btn-platinum"
          >
            Agregar
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
              <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripción</SortableTh>
              <th className="text-center">Detalle</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id}>
                  <td><span className={`app-status-dot ${item.is_active ? "app-status-on" : "app-status-off"}`} /></td>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-muted-foreground">{item.description || "—"}</td>
                  <td className="text-center text-muted-foreground">{item.requires_detail ? "Sí" : "—"}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit(SECTION) && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => {
                          setEditingId(item.id);
                          setFormData({
                            name: item.name || "",
                            description: item.description || "",
                            requires_detail: item.requires_detail || false,
                          });
                          setOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete(SECTION) && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar?")) deleteMutation.mutate(item.id); }}>
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
                <Package className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nuevo"} Tipo de Bien
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre"
                  className="app-input"
                />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripción</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción (opcional)"
                  className="app-input"
                />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Comportamiento</Label>
                <ToggleChip
                  active={formData.requires_detail}
                  onClick={(v) => setFormData({ ...formData, requires_detail: v })}
                >
                  Requiere detalle al seleccionar
                </ToggleChip>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
