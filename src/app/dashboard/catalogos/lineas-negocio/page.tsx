"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getBusinessLines, createBusinessLine, updateBusinessLine, deleteBusinessLine, getCountries, getClaimTypes, getDocumentTypes } from "@/services/catalogs";
import { getDocumentRequirementsByBusinessLine, createDocumentRequirement, deleteDocumentRequirement, updateDocumentRequirement } from "@/services/claim-documents";
import { toast } from "sonner";
import { Search, Pencil, Trash2, Tag, Layers, FileText } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

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
import { StatusBadge } from "@/components/ui/status-badge";

export default function LineasNegocioPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ country_id: "", name: "", code_prefix: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

  // Modal de documentos
  const [openDocs, setOpenDocs] = useState(false);
  const [docsLineId, setDocsLineId] = useState<string | null>(null);
  const [docsLineName, setDocsLineName] = useState<string>("");

  const { data: lines, isLoading } = useQuery({
    queryKey: ["business-lines"],
    queryFn: getBusinessLines,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const { data: claimTypes } = useQuery({
    queryKey: ["claim-types"],
    queryFn: getClaimTypes,
  });

  const defaultCountryId = countries?.find((c) => c.code === "CL")?.id || "";

  const createMutation = useMutation({
    mutationFn: createBusinessLine,
    onSuccess: () => { toast.success("Linea creada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBusinessLine>[1] }) => updateBusinessLine(id, input),
    onSuccess: () => { toast.success("Linea actualizada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBusinessLine,
    onSuccess: () => { toast.success("Linea desactivada"); queryClient.invalidateQueries({ queryKey: ["business-lines"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = lines?.filter((l) =>
    [l.name, l.claim_type, l.ramo_fecu, l.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (l) => l.name,
    claim_type: (l) => claimTypes?.find((ct) => ct.id === l.claim_type_id)?.name || l.claim_type || "",
    ramo_fecu: (l) => l.ramo_fecu || "",
    description: (l) => l.description || "",
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const resetForm = () => setFormData({ country_id: defaultCountryId, name: "", code_prefix: "", claim_type: "", claim_type_id: "", ramo_fecu: "", description: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (editingId) { updateMutation.mutate({ id: editingId, input: formData }); }
    else { createMutation.mutate(formData); }
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="app-page-title">Lineas de Negocio</h1>
              <p className="app-page-lead">Gestión de líneas de negocio.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCreate("catalogos") && (
              <Button onClick={() => { setEditingId(null); resetForm(); setOpen(true); }} className="pg-btn-platinum">
                Nueva
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <div className="relative w-[160px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
          </div>
        </div>
      </div>

      <div className="app-panel">
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead><tr><th className="w-10"></th><th>País</th><SortableTh sortKey="claim_type" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Tipo Siniestro</SortableTh><SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Línea de Negocio</SortableTh><SortableTh sortKey="ramo_fecu" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Ramo FECU</SortableTh><SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripcion</SortableTh><th className="w-[80px]"></th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              : filtered?.length === 0 ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
              : paginatedData.map((l) => (
                <tr key={l.id}>
                  <td><StatusBadge status="active" label="Activo" /></td>
                  <td>{countries?.find((c) => c.id === l.country_id)?.name || "—"}</td>
                  <td>{claimTypes?.find((ct) => ct.id === l.claim_type_id)?.name || l.claim_type || "—"}</td>
                  <td className="font-medium">{l.name}</td>
                  <td>{l.ramo_fecu || "—"}</td>
                  <td className="max-w-[300px] truncate text-muted-foreground">{l.description || "—"}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setDocsLineId(l.id); setDocsLineName(l.name); setOpenDocs(true); }} title="Documentos a solicitar"><FileText className="h-4 w-4" /></Button>
                      )}
                      {canEdit("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(l.id); setFormData({ country_id: l.country_id || "", name: l.name, code_prefix: (l as { code_prefix?: string }).code_prefix || "", claim_type: l.claim_type || "", claim_type_id: l.claim_type_id || "", ramo_fecu: l.ramo_fecu || "", description: l.description || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {canDelete("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta linea?")) deleteMutation.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><Tag className="h-4 w-4" /></div>
              {editingId ? "Editar" : "Nuevo"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">País</Label>
                  <Select
                    value={formData.country_id || "__none"}
                    onValueChange={(v) => setFormData({ ...formData, country_id: v === "__none" ? "" : (v ?? "") })}
                    items={[{ value: "__none", label: "Sin selección" }, ...(countries || []).map((c) => ({ value: c.id, label: c.name }))]}
                  >
                    <SelectTrigger className="app-input h-7">
                      <SelectValue placeholder="Seleccionar país..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin selección</SelectItem>
                      {countries?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Tipo Siniestro</Label>
                  <Select
                    value={formData.claim_type_id || "__none"}
                    onValueChange={(v) => setFormData({ ...formData, claim_type_id: v === "__none" ? "" : (v ?? "") })}
                    items={[{ value: "__none", label: "Sin selección" }, ...(claimTypes || []).map((ct) => ({ value: ct.id, label: ct.name }))]}
                  >
                    <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sin selección</SelectItem>
                      {claimTypes?.map((ct) => (<SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field" style={{ flex: "0 0 100px" }}>
                  <Label className="app-field-label">
                    Código {!editingId && <span className="text-red-500">*</span>}
                    {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
                  </Label>
                  <Input
                    value={formData.code_prefix}
                    onChange={(e) => setFormData({ ...formData, code_prefix: e.target.value.toUpperCase().slice(0, 1) })}
                    placeholder="Ej: H"
                    className="app-input font-mono text-center"
                    disabled={!!editingId}
                    required={!editingId}
                  />
                </div>
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Línea de Negocio <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Accidentes Personales" className="app-input" />
                </div>
                <div className="modal-field"><Label className="app-field-label">Ramo FECU</Label><Input value={formData.ramo_fecu} onChange={(e) => setFormData({ ...formData, ramo_fecu: e.target.value })} className="app-input" /></div>
                <div className="modal-field modal-field-full"><Label className="app-field-label">Descripcion</Label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="app-input" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">{createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL: Documentos a solicitar por línea de negocio ═══ */}
      {openDocs && docsLineId && (
        <DocumentosModal
          lineId={docsLineId}
          lineName={docsLineName}
          onClose={() => { setOpenDocs(false); setDocsLineId(null); setDocsLineName(""); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente: Modal de documentos por línea de negocio
// Usa Switch (toggle) en vez de Checkbox para un look más premium
// ═══════════════════════════════════════════════════════════════

function DocumentosModal({ lineId, lineName, onClose }: { lineId: string; lineName: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: documentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn: getDocumentTypes,
  });

  const { data: existingRequirements, isLoading } = useQuery({
    queryKey: ["doc-requirements", lineId],
    queryFn: () => getDocumentRequirementsByBusinessLine(lineId),
  });

  // Construir selección inicial desde los requisitos existentes
  const initialSelection = useMemo(() => {
    const sel: Record<string, { required: boolean }> = {};
    (existingRequirements || []).forEach((r) => {
      sel[r.document_type_code] = { required: r.is_required };
    });
    return sel;
  }, [existingRequirements]);

  const [selection, setSelection] = useState<Record<string, { required: boolean }>>(initialSelection);

  const saveMut = useMutation({
    mutationFn: async () => {
      const existingMap = new Map((existingRequirements || []).map((r) => [r.document_type_code, r]));
      const selectedCodes = new Set(Object.keys(selection));
      const toCreate: { code: string; name: string; required: boolean; sort_order: number }[] = [];
      const toDelete: { id: string }[] = [];
      const toUpdate: { id: string; required: boolean; sort_order: number }[] = [];

      let order = 1;
      for (const [code, info] of Object.entries(selection)) {
        const existing = existingMap.get(code);
        if (existing) {
          if (existing.is_required !== info.required || existing.sort_order !== order) {
            toUpdate.push({ id: existing.id, required: info.required, sort_order: order });
          }
        } else {
          const dt = documentTypes?.find((d) => d.code === code);
          toCreate.push({ code, name: dt?.name || code, required: info.required, sort_order: order });
        }
        order++;
      }

      for (const [code, existing] of existingMap) {
        if (!selectedCodes.has(code)) {
          toDelete.push({ id: existing.id });
        }
      }

      for (const item of toDelete) {
        await deleteDocumentRequirement(item.id);
      }
      for (const item of toCreate) {
        await createDocumentRequirement({
          business_line_id: lineId,
          document_type_code: item.code,
          document_name: item.name,
          is_required: item.required,
          sort_order: item.sort_order,
        });
      }
      for (const item of toUpdate) {
        await updateDocumentRequirement(item.id, { is_required: item.required, sort_order: item.sort_order });
      }
    },
    onSuccess: () => {
      toast.success("Documentos actualizados");
      queryClient.invalidateQueries({ queryKey: ["doc-requirements", lineId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeDocs = (documentTypes || []).filter((d) => d.is_active);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} dismissible={false}>
      <DialogContent className="modal-md" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm"><FileText className="h-4 w-4" /></div>
            Documentos a Solicitar
          </DialogTitle>
          <p className="modal-subtitle">{lineName}</p>
        </div>
        <div className="modal-body space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Activa los documentos que se deben solicitar para esta línea de negocio e indica cuáles son obligatorios.
          </p>
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground py-4 text-center">Cargando...</p>
          ) : activeDocs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-4 text-center">No hay tipos de documentos configurados.</p>
          ) : (
            <div className="space-y-2">
              {activeDocs.map((dt) => {
                const code = dt.code || "";
                const isSelected = !!selection[code];
                const isRequired = selection[code]?.required || false;
                return (
                  <div key={dt.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ToggleChip
                        active={isSelected}
                        onClick={(v) => {
                          setSelection((prev) => {
                            const next = { ...prev };
                            if (v) {
                              next[code] = { required: false };
                            } else {
                              delete next[code];
                            }
                            return next;
                          });
                        }}
                      >
                        {dt.name}
                      </ToggleChip>
                      {dt.description && (
                        <span className="text-[10px] text-muted-foreground truncate">{dt.description}</span>
                      )}
                    </div>
                    {isSelected && (
                      <ToggleChip
                        active={isRequired}
                        onClick={(v) => {
                          setSelection((prev) => {
                            const next = { ...prev };
                            if (next[code]) {
                              next[code] = { ...next[code], required: v };
                            }
                            return next;
                          });
                        }}
                        className={isRequired ? "border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" : ""}
                      >
                        Obligatorio
                      </ToggleChip>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(selection).length > 0 && (
            <p className="text-[10px] text-primary">
              {Object.keys(selection).length} documento(s) seleccionado(s)
              {Object.values(selection).filter((v) => v.required).length > 0 && ` · ${Object.values(selection).filter((v) => v.required).length} obligatorio(s)`}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="pg-btn-platinum">Cancelar</Button>
          <Button type="button" size="sm" disabled={saveMut.isPending} className="pg-btn-platinum" onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
