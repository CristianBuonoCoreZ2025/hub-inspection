"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
  getTemparioChapters,
  getTemparioSubchapters,
  getTemparioTasks,
  getTemparioTasksWithPrice,
  getTemparioPrices,
  getTemparioFilterOptions,
  createTemparioTask,
  updateTemparioTask,
  deleteTemparioTask,
  createTemparioPrice,
  updateTemparioPrice,
  deleteTemparioPrice,
} from "@/services/tempario";
import { getRegions, getCountryCurrencies } from "@/services/catalogs";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { HardHat, Pencil, Plus, Trash2, Search, Coins, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  TEMPARIO_COMPLEXITY_LABELS,
  TEMPARIO_UNITS,
  TEMPARIO_SOURCES,
  type TemparioTask,
  type TemparioPrice,
  type TemparioComplexity,
} from "@/types";

const SECTION = "catalogos";

interface TaskForm {
  chapter_id: string;
  subchapter_id: string;
  code: string;
  description: string;
  unit: string;
  crew_type: string;
  complexity: TemparioComplexity;
  rendimiento: string;
  time_per_unit: string;
  category_sindical: string;
  source: string;
  source_ref: string;
  observations: string;
}

interface PriceForm {
  id: string | null;
  region_id: string;
  currency_code: string;
  price: string;
  factor_zonal: string;
  effective_date: string;
  source: string;
}

const EMPTY_TASK: TaskForm = {
  chapter_id: "",
  subchapter_id: "",
  code: "",
  description: "",
  unit: "m2",
  crew_type: "",
  complexity: "media",
  rendimiento: "0",
  time_per_unit: "0",
  category_sindical: "",
  source: "MINVU DS27",
  source_ref: "",
  observations: "",
};

const EMPTY_PRICE: PriceForm = {
  id: null,
  region_id: "",
  currency_code: "UF",
  price: "0",
  factor_zonal: "1.00",
  effective_date: new Date().toISOString().slice(0, 10),
  source: "MINVU DS27",
};

export function TemparioManager() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const confirm = useConfirm();

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [chapterFilter, setChapterFilter] = useState<string>("__all");
  const [countryFilter, setCountryFilter] = useState<string>("__all");
  const [regionFilter, setRegionFilter] = useState<string>("__all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("__all");
  const [onlyActive, setOnlyActive] = useState(true);

  // ── Modal task ──
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_TASK);

  // ── Sub-tabla de precios (dentro del modal) ──
  const [priceForm, setPriceForm] = useState<PriceForm>(EMPTY_PRICE);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  // ── Queries ──
  const { data: chapters } = useQuery({ queryKey: ["tempario-chapters"], queryFn: getTemparioChapters });
  const { data: subchapters } = useQuery({ queryKey: ["tempario-subchapters"], queryFn: () => getTemparioSubchapters() });

  // Opciones de filtro derivadas de lo que realmente tiene tempario_prices.
  // Solo países/regiones/monedas con precios cargados aparecen en los filtros.
  const { data: filterOptions } = useQuery({
    queryKey: ["tempario-filter-options"],
    queryFn: getTemparioFilterOptions,
  });

  // Países disponibles (solo los que tienen tempario)
  const countries = filterOptions?.countries ?? [];

  // Regiones disponibles filtradas por país seleccionado en el filtro.
  // Si no hay país seleccionado, mostrar todas las regiones con tempario.
  const regions = useMemo(() => {
    const all = filterOptions?.regions ?? [];
    if (countryFilter === "__all") return all;
    return all.filter((r) => r.country_id === countryFilter);
  }, [filterOptions, countryFilter]);

  // Monedas disponibles (solo las que tiene tempario: UF + CLP derivable)
  const currencies = filterOptions?.currencies ?? [];

  // Tasks: si hay región+moneda, traer con precio; si no, sin precio
  const hasPriceFilter = regionFilter !== "__all" && currencyFilter !== "__all";
  const tasksQuery = useQuery({
    queryKey: ["tempario-tasks", { chapterFilter, regionFilter, currencyFilter, onlyActive }],
    queryFn: () =>
      hasPriceFilter
        ? getTemparioTasksWithPrice({
            chapterId: chapterFilter !== "__all" ? chapterFilter : undefined,
            regionId: regionFilter,
            currencyCode: currencyFilter,
            onlyActive,
          })
        : getTemparioTasks({
            chapterId: chapterFilter !== "__all" ? chapterFilter : undefined,
            onlyActive,
          }),
  });

  // Precios de la task en edición
  const pricesQuery = useQuery({
    queryKey: ["tempario-prices", editingId],
    queryFn: () => (editingId ? getTemparioPrices({ taskId: editingId, onlyActive: false }) : Promise.resolve([])),
    enabled: !!editingId,
  });

  // Para el modal de precios: cargar TODAS las regiones del país del filtro
  // (no solo las que tienen tempario) para poder agregar precios a regiones nuevas.
  const modalCountryId = countryFilter !== "__all" ? countryFilter : (filterOptions?.countries[0]?.id ?? null);
  const { data: modalRegions } = useQuery({
    queryKey: ["regions-all", modalCountryId],
    queryFn: () => getRegions(modalCountryId ?? undefined),
    enabled: open && !!modalCountryId,
  });

  // País de la región seleccionada en el formulario de precios (dentro del modal).
  // Si no hay región seleccionada, usa el país del filtro; si tampoco, el primero con tempario.
  const priceRegionCountryId = useMemo(() => {
    if (priceForm.region_id) {
      return modalRegions?.find((r) => r.id === priceForm.region_id)?.country_id ?? null;
    }
    return modalCountryId ?? null;
  }, [priceForm.region_id, modalRegions, modalCountryId]);

  // Monedas disponibles para el formulario de precios (según país de la región).
  // Solo UF (CLP se calcula en runtime, no se guarda).
  const { data: priceCountryCurrencies } = useQuery({
    queryKey: ["country-currencies", priceRegionCountryId],
    queryFn: () => getCountryCurrencies(priceRegionCountryId),
    enabled: open,
  });
  const priceCurrencies = useMemo(
    () => (priceCountryCurrencies || []).map((c) => ({ code: c.code, name: c.name, symbol: c.description ?? null })),
    [priceCountryCurrencies],
  );

  // ── Mutations task ──
  const createTaskMut = useMutation({
    mutationFn: createTemparioTask,
    onSuccess: () => {
      toast.success("Partida creada");
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateTemparioTask>[1] }) => updateTemparioTask(id, input),
    onSuccess: () => {
      toast.success("Partida actualizada");
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tempario-prices", editingId] });
      setOpen(false);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTaskMut = useMutation({
    mutationFn: deleteTemparioTask,
    onSuccess: () => {
      toast.success("Partida desactivada");
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mutations price ──
  const createPriceMut = useMutation({
    mutationFn: createTemparioPrice,
    onSuccess: () => {
      toast.success("Precio agregado");
      queryClient.invalidateQueries({ queryKey: ["tempario-prices", editingId] });
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
      resetPriceForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePriceMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateTemparioPrice>[1] }) => updateTemparioPrice(id, input),
    onSuccess: () => {
      toast.success("Precio actualizado");
      queryClient.invalidateQueries({ queryKey: ["tempario-prices", editingId] });
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
      resetPriceForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePriceMut = useMutation({
    mutationFn: deleteTemparioPrice,
    onSuccess: () => {
      toast.success("Precio desactivado");
      queryClient.invalidateQueries({ queryKey: ["tempario-prices", editingId] });
      queryClient.invalidateQueries({ queryKey: ["tempario-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Helpers ──
  function resetPriceForm() {
    setPriceForm(EMPTY_PRICE);
    setEditingPriceId(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_TASK);
    resetPriceForm();
    setOpen(true);
  }

  function openEdit(task: TemparioTask) {
    setEditingId(task.id);
    setForm({
      chapter_id: task.chapter_id,
      subchapter_id: task.subchapter_id ?? "",
      code: task.code,
      description: task.description,
      unit: task.unit,
      crew_type: task.crew_type ?? "",
      complexity: task.complexity,
      rendimiento: String(task.rendimiento),
      time_per_unit: String(task.time_per_unit),
      category_sindical: task.category_sindical ?? "",
      source: task.source,
      source_ref: task.source_ref ?? "",
      observations: task.observations ?? "",
    });
    resetPriceForm();
    setOpen(true);
  }

  function handleTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.description.trim() || !form.chapter_id) {
      toast.error("Código, descripción y capítulo son requeridos");
      return;
    }
    const data = {
      chapter_id: form.chapter_id,
      subchapter_id: form.subchapter_id || null,
      code: form.code.toUpperCase(),
      description: form.description,
      unit: form.unit,
      crew_type: form.crew_type || null,
      complexity: form.complexity,
      rendimiento: parseFloat(form.rendimiento) || 0,
      time_per_unit: parseFloat(form.time_per_unit) || 0,
      category_sindical: form.category_sindical || null,
      source: form.source,
      source_ref: form.source_ref || null,
      observations: form.observations || null,
    };
    if (editingId) updateTaskMut.mutate({ id: editingId, input: data });
    else createTaskMut.mutate(data);
  }

  function handlePriceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) {
      toast.error("Guarda la partida primero");
      return;
    }
    if (!priceForm.region_id || !priceForm.currency_code || !priceForm.effective_date) {
      toast.error("Región, moneda y vigencia son requeridos");
      return;
    }
    const data = {
      task_id: editingId,
      region_id: priceForm.region_id,
      currency_code: priceForm.currency_code,
      price: parseFloat(priceForm.price) || 0,
      factor_zonal: parseFloat(priceForm.factor_zonal) || 1.0,
      effective_date: priceForm.effective_date,
      source: priceForm.source,
    };
    if (editingPriceId) updatePriceMut.mutate({ id: editingPriceId, input: data });
    else createPriceMut.mutate(data);
  }

  function editPrice(p: TemparioPrice) {
    setEditingPriceId(p.id);
    setPriceForm({
      id: p.id,
      region_id: p.region_id,
      currency_code: p.currency_code,
      price: String(p.price),
      factor_zonal: String(p.factor_zonal),
      effective_date: p.effective_date,
      source: p.source,
    });
  }

  // ── Subchapters filtrados por capítulo seleccionado en el form ──
  const formSubchapters = useMemo(
    () => (subchapters || []).filter((s) => s.chapter_id === form.chapter_id),
    [subchapters, form.chapter_id],
  );

  // ── Filtrado + orden + paginación de tasks ──
  const filtered = useMemo(() => {
    const list = (tasksQuery.data || []) as TemparioTask[];
    const q = search.toLowerCase();
    return list.filter((t) => {
      if (q && !(`${t.code} ${t.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasksQuery.data, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    code: (t: TemparioTask) => t.code,
    description: (t: TemparioTask) => t.description,
    unit: (t: TemparioTask) => t.unit,
    rendimiento: (t: TemparioTask) => t.rendimiento,
  }, "code");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const chapterName = (id: string) => chapters?.find((c) => c.id === id)?.code ?? "—";
  const regionName = (id: string) => regions?.find((r) => r.id === id)?.name ?? "—";

  function formatPrice(p: number | null | undefined, currencyCode: string | null | undefined): string {
    if (p == null) return "—";
    if (currencyCode === "CLP") return `$${Math.round(p).toLocaleString("es-CL")}`;
    if (currencyCode === "UF") return `${p.toFixed(4)} UF`;
    return `${p} ${currencyCode ?? ""}`;
  }

  // Indica si un precio es estimado (factor de corrección) vs verificado de la fuente.
  // Sutil: los estimados se muestran en color muted/amber con asterisco.
  const isEstimated = (source: string | null | undefined, factorZonal: number | null | undefined): boolean =>
    !!source && source.toLowerCase().includes("estimado") ||
    (factorZonal != null && factorZonal !== 1.0);

  return (
    <div className="app-page">
      {/* Header unificado */}
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-amber">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Tempario</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          {canCreate(SECTION) && (
            <Button onClick={openCreate} className="pg-btn-platinum">
              <Plus className="mr-1.5 h-4 w-4" /> Nueva
            </Button>
          )}
        </div>
      </div>

      {/* Panel con toolbar + tabla + paginación */}
      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar partida..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liquid-search"
              />
            </div>
            <Select
              value={chapterFilter}
              onValueChange={(v) => setChapterFilter((v as string) ?? "__all")}
              items={[
                { value: "__all", label: "Todos los capítulos" },
                ...(chapters || []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
              ]}
            >
              <SelectTrigger className="app-input h-7 w-[180px]">
                <SelectValue placeholder="Capítulo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos los capítulos</SelectItem>
                {chapters?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={countryFilter}
              onValueChange={(v) => {
                setCountryFilter((v as string) ?? "__all");
                setRegionFilter("__all");
                setCurrencyFilter("__all");
              }}
              items={[
                { value: "__all", label: "Todos los países" },
                ...(countries || []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
              ]}
            >
              <SelectTrigger className="app-input h-7 w-[150px]">
                <SelectValue placeholder="País..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos los países</SelectItem>
                {countries?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={regionFilter}
              onValueChange={(v) => {
                setRegionFilter((v as string) ?? "__all");
                setCurrencyFilter("__all");
              }}
              items={[
                { value: "__all", label: "Todas las regiones" },
                ...(regions || []).map((r) => ({ value: r.id, label: r.name })),
              ]}
            >
              <SelectTrigger className="app-input h-7 w-[160px]">
                <SelectValue placeholder="Región..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas las regiones</SelectItem>
                {regions?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={currencyFilter}
              onValueChange={(v) => setCurrencyFilter((v as string) ?? "__all")}
              items={[
                { value: "__all", label: "Todas las monedas" },
                ...(currencies || []).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
              ]}
            >
              <SelectTrigger className="app-input h-7 w-[140px]">
                <SelectValue placeholder="Moneda..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas las monedas</SelectItem>
                {currencies?.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleChip active={onlyActive} onClick={setOnlyActive}>
              {onlyActive ? "Solo activas" : "Todas"}
            </ToggleChip>
          </div>
          <Pagination
            variant="controls"
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="w-10"></th>
                <SortableTh sortKey="code" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Código</SortableTh>
                <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripción</SortableTh>
                <th>Cap.</th>
                <SortableTh sortKey="unit" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Unidad</SortableTh>
                <SortableTh sortKey="rendimiento" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Rend.</SortableTh>
                <th>Cuadrilla</th>
                {hasPriceFilter && <th>Región</th>}
                {hasPriceFilter && <th>Moneda</th>}
                {hasPriceFilter && <th>Precio</th>}
                {hasPriceFilter && <th>FZ</th>}
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {tasksQuery.isLoading ? (
                <tr><td colSpan={hasPriceFilter ? 12 : 8} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={hasPriceFilter ? 12 : 8} className="text-center text-muted-foreground py-4">No se encontraron partidas.</td></tr>
              ) : (
                paginatedData.map((t) => {
                  const tp = t as TemparioTask & {
                    price?: number | null;
                    factor_zonal?: number | null;
                    currency_code?: string | null;
                    region_id?: string | null;
                    price_source?: string | null;
                  };
                  return (
                    <tr key={t.id} className={`row-clickable ${!t.is_active ? "opacity-50" : ""}`} onClick={() => openEdit(t)}>
                      <td><span className={`app-status-dot ${t.is_active ? "app-status-on" : "app-status-off"}`} /></td>
                      <td className="font-mono font-semibold text-[13px]" onClick={(e) => e.stopPropagation()}>{t.code}</td>
                      <td className="font-medium">{t.description}</td>
                      <td className="text-muted-foreground font-mono">{chapterName(t.chapter_id)}</td>
                      <td className="text-muted-foreground font-mono">{t.unit}</td>
                      <td className="text-muted-foreground tabular-nums">{t.rendimiento}</td>
                      <td className="text-muted-foreground">{t.crew_type ?? "—"}</td>
                      {hasPriceFilter && <td className="text-muted-foreground">{tp.region_id ? regionName(tp.region_id) : "—"}</td>}
                      {hasPriceFilter && <td className="text-muted-foreground font-mono">{tp.currency_code ?? "—"}</td>}
                      {hasPriceFilter && (
                        <td className="tabular-nums font-medium">
                          <span
                            className={isEstimated(tp.price_source, tp.factor_zonal) ? "text-amber-600 dark:text-amber-500" : ""}
                            aria-label={tp.price_source ?? undefined}
                          >
                            {formatPrice(tp.price ?? null, tp.currency_code ?? null)}
                            {isEstimated(tp.price_source, tp.factor_zonal) && <span className="text-amber-500"> *</span>}
                          </span>
                        </td>
                      )}
                      {hasPriceFilter && (
                        <td className="text-muted-foreground tabular-nums">
                          {tp.factor_zonal?.toFixed(2) ?? "—"}
                          {tp.factor_zonal != null && tp.factor_zonal !== 1.0 && (
                            <span className="text-amber-500/70 text-[10px] ml-0.5">FZ</span>
                          )}
                        </td>
                      )}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="app-row-actions">
                          {canEdit(SECTION) && (
                            <Tooltip>
                              <TooltipTrigger className="inline-flex">
                                <button type="button" className="btn-icon-sm" onClick={() => openEdit(t)}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Editar</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete(SECTION) && (
                            <Tooltip>
                              <TooltipTrigger className="inline-flex">
                                <button type="button" className="btn-icon-sm btn-danger-hover"
                                  onClick={async () => { const ok = await confirm({ title: "Desactivar", description: "Desactivar partida?", confirmLabel: "Desactivar", destructive: true }); if (!ok) return; deleteTaskMut.mutate(t.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Desactivar</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal crear/editar task con sub-tabla de precios */}
      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-xl" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icn-amber text-white shadow-sm">
                <HardHat className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"} Partida
            </DialogTitle>
          </div>

          <form onSubmit={handleTaskSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="modal-body space-y-3">
              {/* ── Sección 1: Datos de la partida ── */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Datos de la partida</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="modal-field">
                    <Label className="app-field-label">Capítulo <span className="text-red-500">*</span></Label>
                    <Select
                      value={form.chapter_id || "__none"}
                      onValueChange={(v) => setForm({ ...form, chapter_id: v === "__none" ? "" : (v as string) ?? "", subchapter_id: "" })}
                      items={[{ value: "__none", label: "Sin selección" }, ...(chapters || []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))]}
                    >
                      <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sin selección</SelectItem>
                        {chapters?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Subcapítulo</Label>
                    <Select
                      value={form.subchapter_id || "__none"}
                      onValueChange={(v) => setForm({ ...form, subchapter_id: v === "__none" ? "" : (v as string) ?? "" })}
                      items={[{ value: "__none", label: "Sin selección" }, ...formSubchapters.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))]}
                    >
                      <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Sin selección</SelectItem>
                        {formSubchapters.map((s) => (<SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="modal-field">
                    <Label className="app-field-label">Código <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="Ej: A 03 03 02 90007"
                      className="app-input font-mono"
                      disabled={!!editingId}
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Unidad</Label>
                    <Select
                      value={form.unit}
                      onValueChange={(v) => setForm({ ...form, unit: (v as string) ?? "m2" })}
                      items={TEMPARIO_UNITS.map((u) => ({ value: u, label: u }))}
                    >
                      <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEMPARIO_UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Descripción <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripción de la partida..."
                    className="app-input min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="modal-field">
                    <Label className="app-field-label">Rendimiento</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.rendimiento}
                      onChange={(e) => setForm({ ...form, rendimiento: e.target.value })}
                      placeholder="0"
                      className="app-input tabular-nums"
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Tiempo/Unidad (hh)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.time_per_unit}
                      onChange={(e) => setForm({ ...form, time_per_unit: e.target.value })}
                      placeholder="0"
                      className="app-input tabular-nums"
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Complejidad</Label>
                    <Select
                      value={form.complexity}
                      onValueChange={(v) => setForm({ ...form, complexity: (v as TemparioComplexity) ?? "media" })}
                      items={(Object.keys(TEMPARIO_COMPLEXITY_LABELS) as TemparioComplexity[]).map((k) => ({ value: k, label: TEMPARIO_COMPLEXITY_LABELS[k] }))}
                    >
                      <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TEMPARIO_COMPLEXITY_LABELS) as TemparioComplexity[]).map((k) => (
                          <SelectItem key={k} value={k}>{TEMPARIO_COMPLEXITY_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="modal-field">
                    <Label className="app-field-label">Cuadrilla</Label>
                    <Input
                      value={form.crew_type}
                      onChange={(e) => setForm({ ...form, crew_type: e.target.value })}
                      placeholder="Ej: 1 oficial + 1 ayudante"
                      className="app-input"
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Categoría Sindical</Label>
                    <Input
                      value={form.category_sindical}
                      onChange={(e) => setForm({ ...form, category_sindical: e.target.value })}
                      placeholder="Ej: oficial 1º"
                      className="app-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="modal-field">
                    <Label className="app-field-label">Fuente</Label>
                    <Select
                      value={form.source}
                      onValueChange={(v) => setForm({ ...form, source: (v as string) ?? "MINVU DS27" })}
                      items={TEMPARIO_SOURCES.map((s) => ({ value: s, label: s }))}
                    >
                      <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEMPARIO_SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="modal-field">
                    <Label className="app-field-label">Referencia</Label>
                    <Input
                      value={form.source_ref}
                      onChange={(e) => setForm({ ...form, source_ref: e.target.value })}
                      placeholder="Ej: DS27 V 2026; Manual p.12"
                      className="app-input"
                    />
                  </div>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Observaciones</Label>
                  <Textarea
                    value={form.observations}
                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                    placeholder="Condiciones de aplicación, exclusiones..."
                    className="app-input min-h-[40px]"
                  />
                </div>
              </div>

              {/* ── Sección 2: Precios por región (solo en edición) ── */}
              {editingId && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5" /> Precios por región
                    </div>
                    <span className="text-[10px] text-muted-foreground">{pricesQuery.data?.length ?? 0} precios</span>
                  </div>

                  {/* Sub-tabla de precios existentes */}
                  <div className="app-data-table-wrap max-h-[200px]">
                    <table className="app-data-table">
                      <thead>
                        <tr>
                          <th>Región</th>
                          <th>Moneda</th>
                          <th>Precio</th>
                          <th>FZ</th>
                          <th>Vigencia</th>
                          <th>Fuente</th>
                          <th className="w-[60px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricesQuery.isLoading ? (
                          <tr><td colSpan={7} className="text-center text-muted-foreground py-2">Cargando...</td></tr>
                        ) : (pricesQuery.data || []).length === 0 ? (
                          <tr><td colSpan={7} className="text-center text-muted-foreground py-2">Sin precios. Agrega uno abajo.</td></tr>
                        ) : (
                          (pricesQuery.data || []).map((p) => {
                            const est = isEstimated(p.source, p.factor_zonal);
                            return (
                            <tr key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                              <td className="text-muted-foreground">{p.region?.name ?? "—"}</td>
                              <td className="font-mono text-muted-foreground">{p.currency_code}</td>
                              <td className="tabular-nums font-medium">
                                <span className={est ? "text-amber-600 dark:text-amber-500" : ""} aria-label={p.source ?? undefined}>
                                  {formatPrice(p.price, p.currency_code)}
                                  {est && <span className="text-amber-500"> *</span>}
                                </span>
                              </td>
                              <td className="text-muted-foreground tabular-nums">
                                {p.factor_zonal.toFixed(2)}
                                {p.factor_zonal !== 1.0 && <span className="text-amber-500/70 text-[10px] ml-0.5">FZ</span>}
                              </td>
                              <td className="text-muted-foreground">{p.effective_date}</td>
                              <td className="text-muted-foreground text-[10px]">{p.source}</td>
                              <td>
                                <div className="app-row-actions">
                                  <Tooltip>
                                    <TooltipTrigger className="inline-flex">
                                      <button type="button" className="btn-icon-sm" onClick={() => editPrice(p)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Editar</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger className="inline-flex">
                                      <button type="button" className="btn-icon-sm btn-danger-hover"
                                        onClick={async () => { const ok = await confirm({ title: "Desactivar", description: "Desactivar precio?", confirmLabel: "Desactivar", destructive: true }); if (!ok) return; deletePriceMut.mutate(p.id); }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Desactivar</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Formulario inline de precio */}
                  <div className="rounded-md border border-dashed border-border p-2 space-y-2 bg-muted/20">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {editingPriceId ? "Editar precio" : "Agregar precio"}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="modal-field">
                        <Label className="app-field-label">Región</Label>
                        <Select
                          value={priceForm.region_id || "__none"}
                          onValueChange={(v) => setPriceForm({ ...priceForm, region_id: v === "__none" ? "" : (v as string) ?? "" })}
                          items={[{ value: "__none", label: "Sin selección" }, ...(modalRegions || []).map((r) => ({ value: r.id, label: r.name }))]}
                        >
                          <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Sin selección</SelectItem>
                            {modalRegions?.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="modal-field">
                        <Label className="app-field-label">Moneda</Label>
                        <Select
                          value={priceForm.currency_code}
                          onValueChange={(v) => setPriceForm({ ...priceForm, currency_code: (v as string) ?? "UF" })}
                          items={(priceCurrencies || []).filter((c) => c.code === "UF").map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
                        >
                          <SelectTrigger className="app-input h-7"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(priceCurrencies || []).filter((c) => c.code === "UF").map((c) => (<SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground mt-0.5">El tempario se guarda en la moneda de la fuente (UF para DS27). Sin conversiones.</p>
                      </div>
                      <div className="modal-field">
                        <Label className="app-field-label">Vigencia</Label>
                        <DatePicker
                          value={priceForm.effective_date}
                          onChange={(d) => setPriceForm({ ...priceForm, effective_date: d })}
                          clearable
                        />
                        {!priceForm.effective_date && (
                          <Input
                            type="hidden"
                            value=""
                            onChange={() => {}}
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="modal-field">
                        <Label className="app-field-label">Precio</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={priceForm.price}
                          onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                          placeholder="0"
                          className="app-input h-7 tabular-nums"
                        />
                      </div>
                      <div className="modal-field">
                        <Label className="app-field-label">Factor Zonal</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={priceForm.factor_zonal}
                          onChange={(e) => setPriceForm({ ...priceForm, factor_zonal: e.target.value })}
                          placeholder="1.00"
                          className="app-input h-7 tabular-nums"
                        />
                      </div>
                      <div className="modal-field col-span-2">
                        <Label className="app-field-label">Fuente del precio</Label>
                        <Input
                          value={priceForm.source}
                          onChange={(e) => setPriceForm({ ...priceForm, source: e.target.value })}
                          placeholder="Ej: MINVU DS27 2026"
                          className="app-input h-7"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      {editingPriceId && (
                        <Button type="button" className="pg-btn-platinum" onClick={resetPriceForm}>Cancelar</Button>
                      )}
                      <Button
                        type="button"
                        className="pg-btn-platinum"
                        onClick={handlePriceSubmit}
                        disabled={createPriceMut.isPending || updatePriceMut.isPending}
                      >
                        {createPriceMut.isPending || updatePriceMut.isPending ? "Guardando..." : editingPriceId ? "Guardar" : "Agregar"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!editingId && (
                <div className="text-[10px] text-muted-foreground italic">
                  Guarda la partida para poder agregarle precios por región.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <Button type="button" className="pg-btn-platinum" onClick={() => { setOpen(false); setEditingId(null); }}>Cerrar</Button>
              <Button type="submit" className="pg-btn-platinum" disabled={createTaskMut.isPending || updateTaskMut.isPending}>
                {createTaskMut.isPending || updateTaskMut.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
