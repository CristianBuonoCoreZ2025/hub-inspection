"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getBrokers, createBroker, updateBroker, deleteBroker, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Briefcase } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

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

export default function CorredoresPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", name: "", rut: "", address: "", contact: "" });

  const { data: brokers, isLoading } = useQuery({
    queryKey: ["brokers"],
    queryFn: getBrokers,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createBroker,
    onSuccess: () => { toast.success("Corredor creado"); queryClient.invalidateQueries({ queryKey: ["brokers"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBroker>[1] }) => updateBroker(id, input),
    onSuccess: () => { toast.success("Corredor actualizado"); queryClient.invalidateQueries({ queryKey: ["brokers"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBroker,
    onSuccess: () => { toast.success("Corredor desactivado"); queryClient.invalidateQueries({ queryKey: ["brokers"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = brokers?.filter((b) =>
    [b.name, b.rut, b.address, b.contact].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (b) => b.name,
    rut: (b) => b.rut,
    contact: (b) => b.contact,
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", rut: "", address: "", contact: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Corredores</h1>
        <div className="app-grid-filters">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="app-input h-8 max-w-[180px]" />
        </div>
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="btn-create btn-sm shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead><tr><th className="w-10"></th><th>País</th><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh><SortableTh sortKey="rut" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>RUT</SortableTh><th>Direccion</th><SortableTh sortKey="contact" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Contacto</SortableTh><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : paginatedData.map((b) => (
              <tr key={b.id}>
                <td><span className={`app-status-dot ${b.is_active ? "app-status-on" : "app-status-off"}`} /></td>
                <td>{countries?.find((c) => c.id === b.country_id)?.name || "—"}</td>
                <td className="font-medium">{b.name}</td>
                <td>{b.rut || "—"}</td>
                <td className="max-w-[200px] truncate text-muted-foreground">{b.address || "—"}</td>
                <td>{b.contact || "—"}</td>
                <td>
                  <div className="app-row-actions">
                    {canEdit("catalogos") && (
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(b.id); setFormData({ country_id: b.country_id || "", name: b.name, rut: b.rut || "", address: b.address || "", contact: b.contact || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {canDelete("catalogos") && (
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este corredor?")) deleteMutation.mutate(b.id); }}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Briefcase className="h-4 w-4" /></div>
              {editingId ? "Editar" : "Nuevo"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">País</Label>
                  <Select
                    value={formData.country_id}
                    onValueChange={(v) => setFormData({ ...formData, country_id: v || "" })}
                    items={countries?.map((c) => ({ value: c.id, label: c.name })) || []}
                  >
                    <SelectTrigger className="app-input h-7">
                      <SelectValue placeholder="Seleccionar país..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin selección</SelectItem>
                      {countries?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Arthur J. Gallagher" className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">RUT</Label><Input value={formData.rut} onChange={(e) => setFormData({ ...formData, rut: e.target.value })} className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Contacto</Label><Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="app-input" /></div>
                <div className="modal-field modal-field-full"><Label className="app-field-label">Direccion</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="app-input" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="btn-save btn-footer">{createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
