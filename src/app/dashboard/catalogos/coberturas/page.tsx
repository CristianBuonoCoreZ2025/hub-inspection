"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  getCoverageCatalog,
  getSubcoveragesByCoverageIds,
  createCoverageCatalog,
  updateCoverageCatalog,
  deactivateCoverageCatalog,
  createSubcoverageCatalog,
  updateSubcoverageCatalog,
  deactivateSubcoverageCatalog,
  type CoverageCatalogItem,
  type SubcoverageCatalogItem,
} from "@/services/coverage-catalog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ShieldCheck, ChevronRight, ChevronDown, Layers, Globe, ExternalLink } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { getCountries } from "@/services/countries";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ID de Chile — país por defecto (todas las coberturas cargadas son de CL)
const CHILE_CODE = "CL";

export default function CoberturasPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "", description: "", theme: "" });

  // Subcoberturas
  const [expandedCovs, setExpandedCovs] = useState<Set<string>>(new Set());
  const [subOpen, setSubOpen] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subFormData, setSubFormData] = useState({ code: "", name: "", description: "" });
  const [subParentId, setSubParentId] = useState<string>("");

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => getCountries(),
    staleTime: 5 * 60 * 1000,
  });

  // Default a Chile cuando cargan los países
  const chile = countries?.find((c) => c.code === CHILE_CODE);
  const effectiveCountryId = selectedCountryId || chile?.id || "";

  const { data: coverages, isLoading: covLoading } = useQuery({
    queryKey: ["coverage-catalog", effectiveCountryId],
    queryFn: () => getCoverageCatalog(effectiveCountryId || undefined),
    enabled: !!effectiveCountryId,
    staleTime: 2 * 60 * 1000,
  });
  const isLoading = covLoading || !effectiveCountryId;

  // Cargar subcoberturas en batch para las coberturas expandidas (instantáneo)
  const expandedCovIds = useMemo(() => Array.from(expandedCovs), [expandedCovs]);
  const { data: allSubs } = useQuery({
    queryKey: ["subcoverages-batch", expandedCovIds],
    queryFn: () => getSubcoveragesByCoverageIds(expandedCovIds),
    enabled: expandedCovIds.length > 0,
  });

  const subsByCoverage = useMemo(() => {
    const map = new Map<string, SubcoverageCatalogItem[]>();
    for (const s of allSubs || []) {
      if (!s.coverage_catalog_id) continue;
      const arr = map.get(s.coverage_catalog_id) || [];
      arr.push(s);
      map.set(s.coverage_catalog_id, arr);
    }
    return map;
  }, [allSubs]);

  // Mutations coberturas
  const createMut = useMutation({
    mutationFn: createCoverageCatalog,
    onSuccess: () => {
      toast.success("Cobertura creada");
      queryClient.invalidateQueries({ queryKey: ["coverage-catalog"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCoverageCatalog>[1] }) =>
      updateCoverageCatalog(id, input),
    onSuccess: () => {
      toast.success("Cobertura actualizada");
      queryClient.invalidateQueries({ queryKey: ["coverage-catalog"] });
      setOpen(false);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deactivateCoverageCatalog,
    onSuccess: () => {
      toast.success("Cobertura desactivada");
      queryClient.invalidateQueries({ queryKey: ["coverage-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutations subcoberturas
  const createSubMut = useMutation({
    mutationFn: createSubcoverageCatalog,
    onSuccess: () => {
      toast.success("Subcobertura creada");
      queryClient.invalidateQueries({ queryKey: ["subcoverages-batch"] });
      queryClient.invalidateQueries({ queryKey: ["coverage-catalog"] });
      setSubOpen(false);
      setSubFormData({ code: "", name: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSubcoverageCatalog>[1] }) =>
      updateSubcoverageCatalog(id, input),
    onSuccess: () => {
      toast.success("Subcobertura actualizada");
      queryClient.invalidateQueries({ queryKey: ["subcoverages-batch"] });
      setSubOpen(false);
      setEditingSubId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSubMut = useMutation({
    mutationFn: deactivateSubcoverageCatalog,
    onSuccess: () => {
      toast.success("Subcobertura desactivada");
      queryClient.invalidateQueries({ queryKey: ["subcoverages-batch"] });
      queryClient.invalidateQueries({ queryKey: ["coverage-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!coverages) return [];
    return coverages.filter((c) => {
      if (selectedTheme && c.theme !== selectedTheme) return false;
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.theme.toLowerCase().includes(term)
      );
    });
  }, [coverages, search, selectedTheme]);

  const { page, pageSize, paginatedData, setPage, totalPages, total } = usePagination(filtered, 25);

  // Stats por tema para el rail
  const themeStats = useMemo(() => {
    const map = new Map<string, { covs: number; subs: number }>();
    for (const c of coverages || []) {
      const s = map.get(c.theme) || { covs: 0, subs: 0 };
      s.covs += 1;
      s.subs += c.subcoverage_count ?? 0;
      map.set(c.theme, s);
    }
    return Array.from(map.entries())
      .map(([theme, st]) => ({ theme, ...st }))
      .sort((a, b) => b.covs - a.covs);
  }, [coverages]);

  const selectedThemeStats = themeStats.find((t) => t.theme === selectedTheme);

  const toggleCov = useCallback((id: string) => {
    setExpandedCovs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function resetForm() {
    setFormData({ code: "", name: "", description: "", theme: "" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!formData.code.trim()) { toast.error("El código es requerido"); return; }
    if (!formData.theme.trim()) { toast.error("El tema es requerido"); return; }
    if (editingId) {
      updateMut.mutate({ id: editingId, input: formData });
    } else {
      createMut.mutate({ ...formData, country_id: effectiveCountryId || undefined });
    }
  }

  function handleSubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subFormData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!subFormData.code.trim()) { toast.error("El código es requerido"); return; }
    if (editingSubId) {
      updateSubMut.mutate({ id: editingSubId, input: subFormData });
    } else {
      createSubMut.mutate({
        coverage_catalog_id: subParentId,
        code: subFormData.code,
        name: subFormData.name,
        description: subFormData.description,
      });
    }
  }

  const canCreateCat = canCreate("catalogos");
  const canEditCat = canEdit("catalogos");
  const canDeleteCat = canDelete("catalogos");
  const showThemeCol = selectedTheme === "";

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Coberturas</h1>
        <div className="app-grid-filters">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={selectedCountryId || "__none"}
            onValueChange={(v) => {
              const id = v === "__none" ? "" : (v ?? "");
              setSelectedCountryId(id);
              setSelectedTheme("");
              setSearch("");
              setExpandedCovs(new Set());
            }}
          >
            <SelectTrigger className="app-input h-7 max-w-[160px]">
              <SelectValue placeholder="Chile (CL)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Chile (CL)</SelectItem>
              {(countries || [])
                .filter((c) => c.code !== CHILE_CODE)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar cobertura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="app-input h-8 max-w-[200px]"
          />
        </div>
        {canCreateCat && (
          <Button
            onClick={() => { setEditingId(null); resetForm(); setOpen(true); }}
            className="btn-save btn-sm shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 items-start">
        {/* ── Rail de temas ── */}
        <aside className="app-panel p-0! overflow-hidden lg:sticky lg:top-2">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Temas · {themeStats.length}
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <button
              onClick={() => { setSelectedTheme(""); setSearch(""); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left hover:bg-muted/40 transition-colors ${selectedTheme === "" ? "bg-primary/10 text-primary font-semibold" : ""}`}
            >
              <span>Todos</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{coverages?.length || 0}</span>
            </button>
            {themeStats.map((t) => (
              <button
                key={t.theme}
                onClick={() => { setSelectedTheme(t.theme); setSearch(""); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-muted/40 transition-colors ${selectedTheme === t.theme ? "bg-primary/10 text-primary font-semibold" : ""}`}
              >
                <span className="truncate">{t.theme}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{t.covs}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Panel principal: grilla de coberturas ── */}
        <section className="app-panel p-0! overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[12px] font-semibold text-foreground truncate">
                {selectedTheme || "Todas las coberturas"}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {filtered.length} coberturas
                {selectedThemeStats ? ` · ${selectedThemeStats.subs} subcoberturas` : ""}
              </span>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {search ? "No se encontraron coberturas." : "No hay coberturas en este tema."}
            </p>
          ) : (
            <table className="app-data-table">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">Código</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                  {showThemeCol && (
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[120px]">Tema</th>
                  )}
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[60px]">Subcob.</th>
                  <th className="px-3 py-2 w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((c) => (
                  <CoberturaRow
                    key={c.id}
                    coverage={c}
                    expanded={expandedCovs.has(c.id)}
                    subs={expandedCovs.has(c.id) ? subsByCoverage.get(c.id) : undefined}
                    showTheme={showThemeCol}
                    onToggle={() => toggleCov(c.id)}
                    canEdit={canEditCat}
                    canDelete={canDeleteCat}
                    canCreate={canCreateCat}
                    onEdit={() => {
                      setEditingId(c.id);
                      setFormData({ code: c.code, name: c.name, description: c.description || "", theme: c.theme });
                      setOpen(true);
                    }}
                    onDelete={() => {
                      const subs = c.subcoverage_count ?? 0;
                      const msg = subs > 0
                        ? `¿Desactivar "${c.name}"? Se desactivarán también ${subs} subcobertura${subs !== 1 ? "s" : ""}.`
                        : `¿Desactivar "${c.name}"?`;
                      if (confirm(msg)) deleteMut.mutate(c.id);
                    }}
                    onAddSub={() => {
                      setSubParentId(c.id);
                      setEditingSubId(null);
                      setSubFormData({ code: "", name: "", description: "" });
                      setSubOpen(true);
                    }}
                    onEditSub={(sub) => {
                      setEditingSubId(sub.id);
                      setSubParentId(c.id);
                      setSubFormData({ code: sub.code, name: sub.name, description: sub.description || "" });
                      setSubOpen(true);
                    }}
                    onDeleteSub={(subId) => {
                      if (confirm("¿Desactivar esta subcobertura?")) deleteSubMut.mutate(subId);
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
          {total > 0 && (
            <div className="border-t border-border px-4 py-2 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {total} cobertura{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
              </p>
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>
          )}
        </section>
      </div>

      {/* Modal cobertura */}
      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">Código <span className="text-red-500">*</span></Label>
                  <Input
                    className="app-input h-7"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ej: POL120131268"
                  />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Tema <span className="text-red-500">*</span></Label>
                  <Input
                    className="app-input h-7"
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                    placeholder="Ej: Incendio"
                    list="theme-list"
                  />
                  <datalist id="theme-list">
                    {themeStats.map((t) => <option key={t.theme} value={t.theme} />)}
                  </datalist>
                </div>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input
                  className="app-input h-7"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la cobertura"
                />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripción</Label>
                <Input
                  className="app-input h-7"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" className="btn-cancel btn-sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="btn-save btn-sm" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal subcobertura */}
      <Dialog open={subOpen} onOpenChange={setSubOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <Layers className="h-4 w-4" />
              </div>
              {editingSubId ? "Editar" : "Nueva"} Subcobertura
            </DialogTitle>
          </div>
          <form onSubmit={handleSubSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">Código <span className="text-red-500">*</span></Label>
                  <Input
                    className="app-input h-7"
                    value={subFormData.code}
                    onChange={(e) => setSubFormData({ ...subFormData, code: e.target.value })}
                    placeholder="Ej: CAD120140384"
                  />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                  <Input
                    className="app-input h-7"
                    value={subFormData.name}
                    onChange={(e) => setSubFormData({ ...subFormData, name: e.target.value })}
                    placeholder="Nombre de la subcobertura"
                  />
                </div>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripción</Label>
                <Input
                  className="app-input h-7"
                  value={subFormData.description}
                  onChange={(e) => setSubFormData({ ...subFormData, description: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" className="btn-cancel btn-sm" onClick={() => setSubOpen(false)}>Cancelar</Button>
              <Button type="submit" className="btn-save btn-sm" disabled={createSubMut.isPending || updateSubMut.isPending}>
                {createSubMut.isPending || updateSubMut.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Fila de cobertura con subcoberturas inline ──
function CoberturaRow({
  coverage, expanded, subs, showTheme,
  onToggle, canEdit, canDelete, canCreate,
  onEdit, onDelete, onAddSub, onEditSub, onDeleteSub,
}: {
  coverage: CoverageCatalogItem;
  expanded: boolean;
  subs?: SubcoverageCatalogItem[];
  showTheme: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: () => void;
  onEditSub: (sub: SubcoverageCatalogItem) => void;
  onDeleteSub: (subId: string) => void;
}) {
  const subCount = coverage.subcoverage_count ?? 0;
  const hasSubs = subCount > 0;
  const colCount = showTheme ? 8 : 7;

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
        <td className="px-3 py-2 w-8">
          {hasSubs && (
            <button
              onClick={onToggle}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              title={expanded ? "Contraer" : "Expandir subcoberturas"}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
        </td>
        <td className="px-3 py-2 w-8">
          {coverage.document_url && (
            <a
              href={coverage.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
              title="Ver documento CMF"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{coverage.code}</td>
        <td className="px-3 py-2 font-medium wrap-break-word whitespace-normal">{coverage.name}</td>
        {showTheme && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{coverage.theme}</td>}
        <td className="px-3 py-2 text-center">
          {hasSubs ? (
            <button
              onClick={onToggle}
              className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
              title={`${subCount} subcobertura${subCount !== 1 ? "s" : ""}`}
            >
              {subCount}
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">0</span>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="app-row-actions">
            {canEdit && (
              <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && hasSubs && (
        <tr className="bg-muted/10">
          <td colSpan={colCount} className="px-3 py-2">
            <div className="pl-6 border-l-2 border-primary/20 ml-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Subcoberturas ({subCount})
                </span>
                {canCreate && (
                  <button
                    onClick={onAddSub}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                )}
              </div>
              {!subs ? (
                <p className="text-[11px] text-muted-foreground py-1">Cargando...</p>
              ) : subs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">Sin subcoberturas</p>
              ) : (
                <div className="space-y-0.5">
                  {subs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/40 transition-colors group/sub"
                    >
                      {s.document_url ? (
                        <a
                          href={s.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted shrink-0 mt-0.5"
                          title="Ver documento CMF"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="w-5 shrink-0" />
                      )}
                      <Layers className="h-3 w-3 text-violet-500 shrink-0 mt-1" />
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-[120px] whitespace-nowrap mt-0.5">{s.code}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-foreground/90 wrap-break-word">{s.name}</span>
                        {s.description && (
                          <span className="block text-[10px] text-muted-foreground/60 wrap-break-word">{s.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0 mt-0.5">
                        {canEdit && (
                          <button
                            onClick={() => onEditSub(s)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => onDeleteSub(s.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-rose-600 hover:bg-muted"
                            title="Desactivar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
