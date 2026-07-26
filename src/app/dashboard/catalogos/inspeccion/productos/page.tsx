"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { getContentGoodProducts, createContentGoodProduct, updateContentGoodProduct, getContentGoodTypes } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
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

const SECTION = "catalogos_inspeccion";

interface FormState {
  content_good_type_id: string;
  name: string;
  description: string;
}

const EMPTY_FORM: FormState = { content_good_type_id: "", name: "", description: "" };

export default function ProductosBienPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const { data: items, isLoading } = useQuery({
    queryKey: ["content-good-products"],
    queryFn: getContentGoodProducts,
  });

  const { data: types } = useQuery({
    queryKey: ["content-good-types"],
    queryFn: getContentGoodTypes,
  });

  const createMutation = useMutation({
    mutationFn: createContentGoodProduct,
    onSuccess: () => {
      toast.success("Producto creado");
      queryClient.invalidateQueries({ queryKey: ["content-good-products"] });
      setOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateContentGoodProduct>[1] }) =>
      updateContentGoodProduct(id, input),
    onSuccess: () => {
      toast.success("Producto actualizado");
      queryClient.invalidateQueries({ queryKey: ["content-good-products"] });
      setOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateContentGoodProduct(id, { is_active: isActive }),
    onSuccess: (data) => {
      toast.success(data.is_active ? "Producto activado" : "Producto desactivado");
      queryClient.invalidateQueries({ queryKey: ["content-good-products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(
    () =>
      (items || []).filter((i) => {
        const matchesSearch = `${i.name} ${i.description || ""} ${i.content_good_type?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesType = !typeFilter || i.content_good_type_id === typeFilter;
        const matchesActive = !onlyActive || i.is_active;
        return matchesSearch && matchesType && matchesActive;
      }),
    [items, search, typeFilter, onlyActive]
  );

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(filtered);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    if (!formData.content_good_type_id) {
      toast.error("Debe seleccionar un tipo de bien");
      return;
    }
    const payload = {
      content_good_type_id: formData.content_good_type_id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
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
          Productos de Bien
        </h1>
        <div className="app-grid-filters">
          <ToggleChip active={onlyActive} onClick={() => setOnlyActive(!onlyActive)}>
            {onlyActive ? "Solo activos" : "Ver todos"}
          </ToggleChip>
          <Select
            value={typeFilter || "__all"}
            onValueChange={(v) => setTypeFilter(v === "__all" ? "" : (v ?? ""))}
            items={[{ value: "__all", label: "Todos los tipos" }, ...(types || []).map((t) => ({ value: t.id, label: t.name }))]}
          >
            <SelectTrigger className="app-input h-8 w-full sm:max-w-45">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos los tipos</SelectItem>
              {types?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <th>Nombre</th>
              <th>Línea</th>
              <th className="text-center">Activo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-muted-foreground">{item.content_good_type?.name || "—"}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
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
                      {canEdit(SECTION) && (
                        <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => {
                          setEditingId(item.id);
                          setFormData({
                            content_good_type_id: item.content_good_type_id,
                            name: item.name || "",
                            description: item.description || "",
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
                <Package className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nuevo"} Producto
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-field">
                <Label className="app-field-label">Tipo de Bien <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.content_good_type_id || "__none"}
                  onValueChange={(v) => setFormData({ ...formData, content_good_type_id: v === "__none" ? "" : (v ?? "") })}
                  items={[{ value: "__none", label: "Sin selección" }, ...(types || []).map((t) => ({ value: t.id, label: t.name }))]}
                >
                  <SelectTrigger className="app-input h-7">
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin selección</SelectItem>
                    {types?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="app-input h-7"
                  placeholder="Ej: Refrigerador"
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripción</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="app-input h-7"
                  placeholder="Ej: Refrigerador / heladera"
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
