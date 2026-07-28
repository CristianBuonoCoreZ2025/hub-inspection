"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getContentGoodBrands, createContentGoodBrand, updateContentGoodBrand } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, Tag } from "lucide-react";

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
  country: string;
}

const EMPTY_FORM: FormState = { name: "", country: "" };

export default function MarcasPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const { data: items, isLoading } = useQuery({
    queryKey: ["content-good-brands"],
    queryFn: getContentGoodBrands,
  });

  const createMutation = useMutation({
    mutationFn: createContentGoodBrand,
    onSuccess: () => {
      toast.success("Marca creada");
      queryClient.invalidateQueries({ queryKey: ["content-good-brands"] });
      setOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string; country?: string | null } }) =>
      updateContentGoodBrand(id, input),
    onSuccess: () => {
      toast.success("Marca actualizada");
      queryClient.invalidateQueries({ queryKey: ["content-good-brands"] });
      setOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateContentGoodBrand(id, { is_active: isActive }),
    onSuccess: (data) => {
      toast.success(data.is_active ? "Marca activada" : "Marca desactivada");
      queryClient.invalidateQueries({ queryKey: ["content-good-brands"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(
    () =>
      (items || []).filter((i) => {
        const matchesSearch = `${i.name} ${i.country || ""}`.toLowerCase().includes(search.toLowerCase());
        const matchesActive = !onlyActive || i.is_active;
        return matchesSearch && matchesActive;
      }),
    [items, search, onlyActive]
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (i) => i.name,
    country: (i) => i.country || "",
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
      country: formData.country.trim() || null,
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
          <Tag className="h-5 w-5" />
          Marcas
        </h1>
        <div className="app-grid-filters">
          <ToggleChip active={onlyActive} onClick={() => setOnlyActive(!onlyActive)}>
            {onlyActive ? "Solo activos" : "Ver todos"}
          </ToggleChip>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-input h-8 w-full sm:max-w-45"
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
              <SortableTh sortKey="country" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>País</SortableTh>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                  <td>
                    {canEdit(SECTION) ? (
                      <ToggleChip
                        active={item.is_active}
                        onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.is_active })}
                      >
                        {item.is_active ? "Activo" : "Inactivo"}
                      </ToggleChip>
                    ) : (
                      <span className={`app-status-dot ${item.is_active ? "app-status-on" : "app-status-off"}`} />
                    )}
                  </td>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-muted-foreground">{item.country || "—"}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit(SECTION) && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => {
                          setEditingId(item.id);
                          setFormData({
                            name: item.name || "",
                            country: item.country || "",
                          });
                          setOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
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
                <Tag className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"} Marca
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body modal-grid">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="app-input h-7"
                  placeholder="Ej: Samsung"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">País (código ISO 2)</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase().slice(0, 2) })}
                  className="app-input h-7"
                  placeholder="Ej: KR"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" className="pg-btn-platinum" onClick={() => { setOpen(false); setEditingId(null); setFormData(EMPTY_FORM); }}>Cancelar</Button>
              <Button type="submit" className="pg-btn-platinum" disabled={createMutation.isPending || updateMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
