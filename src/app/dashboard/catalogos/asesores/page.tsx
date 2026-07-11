"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getAdvisors, createAdvisor, updateAdvisor, deleteAdvisor, getCountries } from "@/services/catalogs";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, UserCheck } from "lucide-react";
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

export default function AsesoresPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", name: "", email: "", phone: "" });

  const { data: advisors, isLoading } = useQuery({
    queryKey: ["advisors"],
    queryFn: getAdvisors,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createAdvisor,
    onSuccess: () => { toast.success("Asesor creado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAdvisor>[1] }) => updateAdvisor(id, input),
    onSuccess: () => { toast.success("Asesor actualizado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdvisor,
    onSuccess: () => { toast.success("Asesor desactivado"); queryClient.invalidateQueries({ queryKey: ["advisors"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = advisors?.filter((a) =>
    [a.name, a.email, a.phone].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (a) => a.name,
    email: (a) => a.email,
    phone: (a) => a.phone,
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", email: "", phone: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Asesores</h1>
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
          <thead><tr><th className="w-10"></th><th>País</th><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh><SortableTh sortKey="email" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Email</SortableTh><SortableTh sortKey="phone" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Teléfono</SortableTh><th className="w-[80px]"></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            : filtered?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            : paginatedData.map((a) => (
              <tr key={a.id}>
                <td><span className={`app-status-dot ${a.is_active ? "app-status-on" : "app-status-off"}`} /></td>
                <td>{countries?.find((c) => c.id === a.country_id)?.name || "—"}</td>
                <td className="font-medium">{a.name}</td>
                <td>{a.email || "—"}</td>
                <td>{a.phone || "—"}</td>
                <td>
                  <div className="app-row-actions">
                    {canEdit("catalogos") && (
                      <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(a.id); setFormData({ country_id: a.country_id || "", name: a.name, email: a.email || "", phone: a.phone || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {canDelete("catalogos") && (
                      <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este asesor?")) deleteMutation.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><UserCheck className="h-4 w-4" /></div>
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
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Juan Perez" className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">Email</Label><Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className="app-input" /></div>
                <div className="modal-field"><Label className="app-field-label">Teléfono</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="app-input" /></div>
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
