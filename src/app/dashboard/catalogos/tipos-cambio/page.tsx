"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
 getExchangeRates, createExchangeRate, updateExchangeRate, deleteExchangeRate,
 getCountries,
 getCountryCurrenciesAll,
} from "@/services/catalogs";
import { toast } from "sonner";
import { ArrowRightLeft, Plus, Calendar, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type ViewMode = "year" | "month";

export default function TiposCambioPage() {
 return (
 <Suspense fallback={<div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>}>
 <TiposCambioContent />
 </Suspense>
 );
}

function TiposCambioContent() {
 const searchParams = useSearchParams();
 const initialCurrency = searchParams.get("currency") || "";

 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState({ country_id: "", currency_code: "", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" });

 // Estado de sincronización
 const [syncState, setSyncState] = useState<{ active: boolean; done: boolean; inserted: number; exists: number; errors: number; total: number; current: number; totalMonths: number }>({
 active: false, done: false, inserted: 0, exists: 0, errors: 0, total: 0, current: 0, totalMonths: 0,
 });

 // Filtros
 const currentYear = new Date().getFullYear();
 const currentMonth = new Date().getMonth();
 const [filterCountry, setFilterCountry] = useState("");
 const [filterCurrency, setFilterCurrency] = useState(initialCurrency);
 const [filterYear, setFilterYear] = useState(String(currentYear));
 const [filterMonth, setFilterMonth] = useState(String(currentMonth));
 const [viewMode, setViewMode] = useState<ViewMode>("year");

 const { data: rates, isLoading } = useQuery({ queryKey: ["exchange-rates"], queryFn: getExchangeRates });
 const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });
 const { data: countryCurrenciesAll } = useQuery({ queryKey: ["country-currencies-all"], queryFn: getCountryCurrenciesAll });

 const createMut = useMutation({
 mutationFn: createExchangeRate,
 onSuccess: () => { toast.success("Tipo de cambio guardado"); queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }); },
 onError: (e: Error) => toast.error(e.message),
 });
 const updateMut = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateExchangeRate>[1] }) => updateExchangeRate(id, input),
 onSuccess: () => { toast.success("Tipo de cambio actualizado"); queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }); setOpen(false); setEditingId(null); },
 onError: (e: Error) => toast.error(e.message),
 });
 const deleteMut = useMutation({
 mutationFn: deleteExchangeRate,
 onSuccess: () => { toast.success("Tipo de cambio eliminado"); queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }); setOpen(false); setEditingId(null); },
 onError: (e: Error) => toast.error(e.message),
 });
 // Sincronización BCCh progresiva: mes a mes mostrando resultados
 const syncChile = async () => {
 if (!effectiveFilterCurrency) {
 toast.error("Selecciona una moneda para sincronizar");
 return;
 }
 const year = parseInt(filterYear);

 // En modo mes: 1 llamada. En modo año: 12 llamadas (una por mes)
 const monthsToSync = viewMode === "month" ? [parseInt(filterMonth)] : Array.from({ length: 12 }, (_, i) => i);

 setSyncState({ active: true, done: false, inserted: 0, exists: 0, errors: 0, total: 0, current: 0, totalMonths: monthsToSync.length });

 let totalInserted = 0, totalExists = 0, totalErrors = 0, totalProcessed = 0;

 for (let i = 0; i < monthsToSync.length; i++) {
 try {
 const resp = await fetch("/api/currencies/sync-chile", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ year, month: monthsToSync[i], currency: effectiveFilterCurrency }),
 });
 if (!resp.ok) throw new Error("Error en mes");
 const data = await resp.json() as { summary: { inserted: number; exists: number; errors: number; total: number } };
 totalInserted += data.summary.inserted;
 totalExists += data.summary.exists;
 totalErrors += data.summary.errors;
 totalProcessed += data.summary.total;
 } catch {
 totalErrors += 1;
 }
 // Actualizar progreso después de cada mes
 setSyncState({
 active: true,
 done: false,
 inserted: totalInserted,
 exists: totalExists,
 errors: totalErrors,
 total: totalProcessed,
 current: i + 1,
 totalMonths: monthsToSync.length,
 });
 }

 setSyncState(s => ({ ...s, active: false, done: true }));
 queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
 };

 const closeSyncModal = () => {
 setSyncState({ active: false, done: false, inserted: 0, exists: 0, errors: 0, total: 0, current: 0, totalMonths: 0 });
 };

 // Sincronizar un solo día desde el modal de edición
 const [syncDayLoading, setSyncDayLoading] = useState(false);
 const syncSingleDay = async () => {
 if (!form.country_id || !form.currency_code || !form.effective_date) return;
 setSyncDayLoading(true);
 try {
 const resp = await fetch("/api/currencies/sync-chile", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ date: form.effective_date, currency: form.currency_code, force: true }),
 });
 if (!resp.ok) throw new Error("Error al sincronizar");
 const data = await resp.json() as { summary: { inserted: number; updated: number; exists: number; errors: number; total: number }, details: Array<{ date: string; currency: string; rate: number; status: string }> };
 const detail = data.details.find(d => d.date === form.effective_date);
 if (detail && detail.status !== "error") {
 // Actualizar el form con el valor descargado
 setForm(f => ({ ...f, rate_to_base: String(detail.rate), source: "mindicador.cl" }));
 toast.success(`Valor sincronizado: ${formatRate(detail.rate)}`);
 queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
 } else {
 toast.error("No se encontró valor para esa fecha en mindicador.cl");
 }
 } catch (e) {
 toast.error(e instanceof Error ? e.message : "Error al sincronizar");
 }
 setSyncDayLoading(false);
 };

 // Monedas del país seleccionado (excluyendo la base, que siempre es tasa 1)
 const countryCurrencyOptions = useMemo(() =>
 (countryCurrenciesAll || [])
 .filter(cc => cc.country_id === filterCountry && cc.is_active && !cc.is_base)
 .map(cc => ({ code: cc.currency_code, name: cc.currency?.name || cc.currency_code, isBase: cc.is_base }))
 , [countryCurrenciesAll, filterCountry]);

 // Países que tienen al menos una moneda activa no-base (para el dropdown)
 const countriesWithCurrencies = useMemo(() => {
 const countryIds = new Set((countryCurrenciesAll || []).filter(cc => cc.is_active && !cc.is_base).map(cc => cc.country_id));
 return (countries || []).filter(c => countryIds.has(c.id));
 }, [countries, countryCurrenciesAll]);

 // Si la moneda seleccionada ya no está en las opciones (ej: era la base), usar string vacío
 const effectiveFilterCurrency = filterCurrency && countryCurrencyOptions.length > 0 && !countryCurrencyOptions.find(c => c.code === filterCurrency)
 ? ""
 : filterCurrency;

 const selectedCountry = countries?.find(c => c.id === filterCountry);
 const selectedCurrency = countryCurrencyOptions.find(c => c.code === effectiveFilterCurrency);

 // Filtrar tasas
 const filteredRates = useMemo(() => (rates || []).filter(r => {
 if (filterCountry && r.country_id !== filterCountry) return false;
 if (effectiveFilterCurrency && r.currency_code !== effectiveFilterCurrency) return false;
 const rYear = r.effective_date.split("-")[0];
 if (filterYear && rYear !== filterYear) return false;
 if (viewMode === "month") {
 const rMonth = String(parseInt(r.effective_date.split("-")[1]) - 1);
 if (rMonth !== filterMonth) return false;
 }
 return true;
 }), [rates, filterCountry, effectiveFilterCurrency, filterYear, filterMonth, viewMode]); // eslint-disable-line react-hooks/preserve-manual-memoization -- effectiveFilterCurrency es derivado, no se muta

 // Pivot: day → month → { rate, id, source }
 const pivot = useMemo(() => {
 const p: Record<number, Record<number, { rate: number; id: string; source: string | null } | undefined>> = {};
 for (const r of filteredRates) {
 const d = new Date(r.effective_date + "T00:00:00");
 const day = d.getDate();
 const month = d.getMonth();
 if (!p[day]) p[day] = {};
 p[day][month] = { rate: r.rate_to_base, id: r.id, source: r.source };
 }
 return p;
 }, [filteredRates]);

 // Años disponibles
 const availableYears = useMemo(() => {
 const years = new Set<string>();
 for (const r of rates || []) years.add(r.effective_date.split("-")[0]);
 years.add(String(currentYear));
 return Array.from(years).sort().reverse();
 }, [rates, currentYear]);

 // Stats con fecha del min/max
 const stats = useMemo(() => {
 if (filteredRates.length === 0) return null;
 let minRate = filteredRates[0], maxRate = filteredRates[0];
 let sum = 0;
 for (const r of filteredRates) {
 sum += r.rate_to_base;
 if (r.rate_to_base < minRate.rate_to_base) minRate = r;
 if (r.rate_to_base > maxRate.rate_to_base) maxRate = r;
 }
 return {
 count: filteredRates.length,
 min: minRate.rate_to_base,
 minDate: minRate.effective_date,
 max: maxRate.rate_to_base,
 maxDate: maxRate.effective_date,
 avg: sum / filteredRates.length,
 };
 }, [filteredRates]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.country_id || !form.currency_code || !form.rate_to_base) { toast.error("País, moneda y tasa son requeridos"); return; }
 const data = { country_id: form.country_id, currency_code: form.currency_code, rate_to_base: parseFloat(form.rate_to_base), effective_date: form.effective_date, source: form.source };
 if (editingId) updateMut.mutate({ id: editingId, input: data });
 else createMut.mutate(data);
 };

 const formatRate = (rate: number) => {
 if (rate >= 1000) return rate.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
 if (rate >= 100) return rate.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
 return rate.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
 };

 // Navegación entre meses
 const navigateMonth = (delta: number) => {
 let m = parseInt(filterMonth) + delta;
 let y = parseInt(filterYear);
 if (m < 0) { m = 11; y--; }
 if (m > 11) { m = 0; y++; }
 setFilterMonth(String(m));
 setFilterYear(String(y));
 };

 // Columnas según modo: año = meses, mes = no se usa pivote
 return (
 <div className="app-page">
 <div className="app-page-header">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
 <ArrowRightLeft className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Tipos de Cambio</h1>
 <p className="app-page-lead">Tasas de conversión a moneda base por país y fecha.</p>
 </div>
 </div>
 </div>

 <div className="app-stack">
 {/* ── Toolbar de filtros ── */}
 <div className="app-panel">
 <div className="flex flex-wrap items-end gap-3">
 {/* País */}
 <div className="min-w-[180px]">
 <Label className="app-field-label">País</Label>
 <Select
 value={filterCountry || "__none"}
 onValueChange={(v) => { const val = v === "__none" ? "" : (v ?? ""); setFilterCountry(val); setFilterCurrency(""); }}
 items={[{ value: "__none", label: "Seleccione..." }, ...countriesWithCurrencies.map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccione...</SelectItem>
 {countriesWithCurrencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 {/* Moneda */}
 <div className="min-w-[160px]">
 <Label className="app-field-label">Moneda</Label>
 <Select
 value={effectiveFilterCurrency || "__none"}
 onValueChange={(v) => setFilterCurrency(v === "__none" ? "" : (v ?? ""))}
 items={[{ value: "__none", label: "Seleccione..." }, ...countryCurrencyOptions.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))]}
 >
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccione...</SelectItem>
 {countryCurrencyOptions.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 {/* Año */}
 <div className="min-w-[100px]">
 <Label className="app-field-label">Año</Label>
 <Select
 value={filterYear}
 onValueChange={(v) => setFilterYear(v ?? String(currentYear))}
 items={availableYears.map(y => ({ value: y, label: y }))}
 >
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 {/* Modo: Año / Mes */}
 <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
 <button
 onClick={() => setViewMode("year")}
 className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${viewMode === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
 >
 Año
 </button>
 <button
 onClick={() => setViewMode("month")}
 className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
 >
 Mes
 </button>
 </div>

 {/* Navegación de mes (solo en modo mes) */}
 {viewMode === "month" && (
 <div className="flex items-center gap-1">
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon h-7 w-7" onClick={() => navigateMonth(-1)}>
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <span className="text-[11px] font-medium min-w-[90px] text-center">
 {MONTHS[parseInt(filterMonth)]} {filterYear}
 </span>
 <Button variant="ghost" size="icon" className="btn-neutral btn-icon h-7 w-7" onClick={() => navigateMonth(1)}>
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 )}

 {/* Badge de fecha de referencia */}
 {selectedCountry && (
 <span className={`text-[10px] rounded-full px-2.5 py-1 font-medium ${
 selectedCountry.reference_date_type === "execution_date"
 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
 : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
 }`}>
 Ref: {selectedCountry.reference_date_type === "execution_date" ? "Fecha Ejecución" : "Fecha Siniestro"}
 </span>
 )}

 {/* Botones */}
 <div className="ml-auto flex gap-2">
 {canCreate("catalogos") && (
 <Button
 variant="outline"
 onClick={syncChile}
 disabled={syncState.active || !effectiveFilterCurrency}
 className="pg-btn-platinum-icon"
 title={effectiveFilterCurrency
 ? `Descargar ${effectiveFilterCurrency} del período seleccionado desde mindicador.cl`
 : "Selecciona una moneda primero"}
 >
 <ArrowRightLeft className={`mr-1.5 h-4 w-4 ${syncState.active ? "animate-spin" : ""}`} />
 {syncState.active ? "Sincronizando" : "Sincronizar"}
 </Button>
 )}
 {canCreate("catalogos") && (
 <Button
 variant="outline"
 onClick={() => { setEditingId(null); setForm({ country_id: filterCountry, currency_code: effectiveFilterCurrency, rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" }); setOpen(true); }}
 disabled={syncState.active}
 className="pg-btn-platinum-icon"
 >
 <Plus className="mr-1.5 h-4 w-4" /> Nuevo
 </Button>
 )}
 </div>
 </div>
 </div>

 {/* ── Stats ── */}
 {stats && (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <div className="app-panel py-3 px-4">
 <div className="text-[11px] text-muted-foreground">Registros</div>
 <div className="text-xl font-bold font-mono">{stats.count}</div>
 </div>
 <div className="app-panel py-3 px-4">
 <div className="text-[11px] text-muted-foreground">Mínimo</div>
 <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatRate(stats.min)}</div>
 <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
 {new Date(stats.minDate + "T00:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
 </div>
 </div>
 <div className="app-panel py-3 px-4">
 <div className="text-[11px] text-muted-foreground">Promedio</div>
 <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatRate(stats.avg)}</div>
 </div>
 <div className="app-panel py-3 px-4">
 <div className="text-[11px] text-muted-foreground">Máximo</div>
 <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{formatRate(stats.max)}</div>
 <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
 {new Date(stats.maxDate + "T00:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
 </div>
 </div>
 </div>
 )}

 {/* ── Tabla pivote ── */}
 {isLoading ? (
 <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>
 ) : !filterCountry || !effectiveFilterCurrency ? (
 <div className="app-panel text-center py-12">
 <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
 <p className="text-[13px] text-muted-foreground">
 Selecciona un país y una moneda para ver la tabla de tipos de cambio.
 </p>
 </div>
 ) : filteredRates.length === 0 ? (
 <div className="app-panel text-center py-12">
 <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
 <p className="text-[13px] text-muted-foreground">
 No hay tipos de cambio para {selectedCurrency?.name || effectiveFilterCurrency} en {selectedCountry?.name || filterCountry}
 {viewMode === "month" ? ` durante ${MONTHS[parseInt(filterMonth)]} ${filterYear}` : ` durante ${filterYear}`}.
 </p>
 {canCreate("catalogos") && (
 <Button
 variant="outline"
 onClick={() => {
 const defaultDate = viewMode === "month"
 ? `${filterYear}-${String(parseInt(filterMonth) + 1).padStart(2, "0")}-01`
 : `${filterYear}-01-01`;
 setEditingId(null);
 setForm({ country_id: filterCountry, currency_code: effectiveFilterCurrency, rate_to_base: "", effective_date: defaultDate, source: "manual" });
 setOpen(true);
 }}
 className="pg-btn-platinum-icon mt-3"
 >
 <Plus className="mr-1.5 h-4 w-4" /> Nuevo
 </Button>
 )}
 </div>
 ) : (
 <div className="app-panel">
 {/* Header */}
 <div className="flex items-center justify-between mb-3 px-1">
 <h3 className="app-section-title flex items-center gap-2">
 <span className="font-mono text-[11px] text-muted-foreground">{selectedCountry?.code}</span>
 {selectedCountry?.name}
 <span className="text-muted-foreground">·</span>
 <span className="font-mono font-semibold text-[13px]">{effectiveFilterCurrency}</span>
 <span className="text-muted-foreground">·</span>
 <span className="text-[11px] text-muted-foreground">
 {viewMode === "month" ? `${MONTHS[parseInt(filterMonth)]} ${filterYear}` : filterYear}
 </span>
 </h3>
 </div>

 {/* Tabla pivote (año) o tabla simple (mes) */}
 <div className="overflow-x-auto">
 {viewMode === "year" ? (
 <table className="app-data-table text-[11px]">
 <thead>
 <tr>
 <th className="sticky left-0 z-10 bg-background w-10 text-center">Día</th>
 {MONTHS_SHORT.map(m => <th key={m} className="text-center min-w-[70px]">{m}</th>)}
 </tr>
 </thead>
 <tbody>
 {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
 const hasAny = pivot[day] && Object.keys(pivot[day]).length > 0;
 if (!hasAny) return null;
 return (
 <tr key={day} className="hover:bg-muted/30">
 <td className="sticky left-0 z-10 bg-background text-center font-mono font-semibold text-muted-foreground">{day}</td>
 {MONTHS_SHORT.map((_, monthIdx) => {
 const cell = pivot[day]?.[monthIdx];
 if (!cell) return <td key={monthIdx} className="text-center text-muted-foreground/20">—</td>;
 return (
 <td
 key={monthIdx}
 className="text-center font-mono cursor-pointer hover:bg-primary/10 rounded transition-colors"
 title={`${day}/${String(monthIdx + 1).padStart(2, "0")}/${filterYear} — ${cell.source || "manual"}`}
 onClick={() => { if (canEdit("catalogos")) { setEditingId(cell.id); setForm({ country_id: filterCountry, currency_code: effectiveFilterCurrency, rate_to_base: String(cell.rate), effective_date: `${filterYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, source: cell.source || "manual" }); setOpen(true); } }}
 >
 {formatRate(cell.rate)}
 </td>
 );
 })}
 </tr>
 );
 })}
 </tbody>
 </table>
 ) : (
 // Vista mensual: tabla simple, una fila por día
 <table className="app-data-table text-[11px]">
 <thead>
 <tr>
 <th className="w-16">Día</th>
 <th className="text-right">Tasa → Base</th>
 <th>Fecha</th>
 <th>Origen</th>
 <th className="w-[60px]"></th>
 </tr>
 </thead>
 <tbody>
 {filteredRates
 .slice()
 .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
 .map((r) => {
 const d = new Date(r.effective_date + "T00:00:00");
 const day = d.getDate();
 return (
 <tr key={r.id} className="hover:bg-muted/30">
 <td className="font-mono font-semibold text-muted-foreground">{day}</td>
 <td
 className="text-right font-mono font-semibold cursor-pointer hover:bg-primary/10 rounded px-2 transition-colors"
 onClick={() => { if (canEdit("catalogos")) { setEditingId(r.id); setForm({ country_id: r.country_id, currency_code: r.currency_code, rate_to_base: String(r.rate_to_base), effective_date: r.effective_date, source: r.source || "manual" }); setOpen(true); } }}
 >
 {formatRate(r.rate_to_base)}
 </td>
 <td className="text-muted-foreground text-[11px]">
 {d.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" })}
 </td>
 <td className="text-muted-foreground text-[11px]">{r.source || "—"}</td>
 <td>
 {canEdit("catalogos") && (
 <Button
 variant="ghost"
 size="icon"
 className="btn-neutral btn-icon"
 onClick={() => { setEditingId(r.id); setForm({ country_id: r.country_id, currency_code: r.currency_code, rate_to_base: String(r.rate_to_base), effective_date: r.effective_date, source: r.source || "manual" }); setOpen(true); }}
 >
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>

 {/* Leyenda */}
 <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
 <span className="flex items-center gap-1.5">
 <span className="inline-block w-3 h-3 rounded bg-primary/10" /> Clic para editar
 </span>
 <span className="flex items-center gap-1.5">
 <span className="font-mono">—</span> Sin dato
 </span>
 {selectedCurrency && effectiveFilterCurrency && (
 <span className="ml-auto">
 Tasa = 1 {effectiveFilterCurrency} en moneda base ({(countryCurrenciesAll || []).find(cc => cc.country_id === filterCountry && cc.is_base)?.currency_code || "—"})
 </span>
 )}
 </div>
 </div>
 )}
 </div>

 {/* ── Modal de sincronización ── */}
 <Dialog open={syncState.active || syncState.done} onOpenChange={(v) => { if (!v) closeSyncModal(); }} dismissible={false}>
 <DialogContent className="modal-sm" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
 <ArrowRightLeft className={`h-4 w-4 ${syncState.active ? "animate-spin" : ""}`} />
 </div>
 {syncState.active ? "Sincronizando BCCh" : "Sincronización Completada"}
 </DialogTitle>
 </div>
 <div className="modal-body space-y-3">
 <p className="text-[11px] text-muted-foreground">
 <span className="font-mono font-medium text-foreground">{effectiveFilterCurrency}</span>
 {" "}—{" "}
 <span className="font-medium text-foreground">
 {viewMode === "month"
 ? `${MONTHS[parseInt(filterMonth)]} ${filterYear}`
 : `Año ${filterYear}`}
 </span>
 </p>

 {/* Barra de progreso real */}
 {syncState.totalMonths > 0 && (
 <div className="space-y-1.5">
 <div className="flex justify-between text-[11px] text-muted-foreground">
 <span>{syncState.active ? "Progreso" : "Completado"}</span>
 <span className="font-mono">
 {syncState.current} / {syncState.totalMonths} {syncState.totalMonths > 1 ? "meses" : "mes"}
 </span>
 </div>
 <div className="h-2.5 rounded-full bg-muted overflow-hidden">
 <div
 className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
 style={{ width: `${syncState.totalMonths > 0 ? (syncState.current / syncState.totalMonths) * 100 : 0}%` }}
 />
 </div>
 </div>
 )}

 {/* Stats en vivo (siempre visibles, se actualizan progresivamente) */}
 <div className="grid grid-cols-3 gap-2">
 <div className="text-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2.5">
 <div className="text-[10px] text-muted-foreground">Nuevas</div>
 <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{syncState.inserted}</div>
 </div>
 <div className="text-center rounded-lg bg-blue-50 dark:bg-blue-900/20 py-2.5">
 <div className="text-[10px] text-muted-foreground">Ya existían</div>
 <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{syncState.exists}</div>
 </div>
 <div className="text-center rounded-lg bg-rose-50 dark:bg-rose-900/20 py-2.5">
 <div className="text-[10px] text-muted-foreground">Errores</div>
 <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">{syncState.errors}</div>
 </div>
 </div>
 <div className="text-center text-[11px] text-muted-foreground">
 Total procesados: <span className="font-mono font-semibold">{syncState.total}</span>
 </div>
 </div>
 {!syncState.active && (
 <div className="modal-footer">
 <button type="button" onClick={closeSyncModal} className="pg-btn-platinum ml-auto">Cerrar</button>
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* ── Modal de editar/crear ── */}
 <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
 <DialogContent className="modal-md" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
 <ArrowRightLeft className="h-4 w-4" />
 </div>
 {editingId ? "Editar" : "Nuevo"} Tipo de Cambio
 </DialogTitle>
 </div>
 <form onSubmit={handleSubmit}>
 <div className="modal-body space-y-2">
 <div className="modal-grid">
 <div className="modal-field">
 <Label className="app-field-label">País</Label>
 <Select
 value={form.country_id || "__none"}
 onValueChange={(v) => setForm({ ...form, country_id: v === "__none" ? "" : (v ?? "") })}
 items={[{ value: "__none", label: "Seleccionar..." }, ...(countries || []).map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar...</SelectItem>
 {countries?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Moneda</Label>
 <Select
 value={form.currency_code || "__none"}
 onValueChange={(v) => setForm({ ...form, currency_code: v === "__none" ? "" : (v ?? "") })}
 items={[{ value: "__none", label: "Seleccionar..." }, ...(countryCurrenciesAll || []).filter(cc => cc.country_id === form.country_id && cc.is_active).map((cc) => ({ value: cc.currency_code, label: `${cc.currency_code} — ${cc.currency?.name || cc.currency_code}` }))]}
 >
 <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar...</SelectItem>
 {(countryCurrenciesAll || []).filter(cc => cc.country_id === form.country_id && cc.is_active).map((cc) => (
 <SelectItem key={cc.currency_code} value={cc.currency_code}>{cc.currency_code} — {cc.currency?.name || cc.currency_code}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Tasa hacia Moneda Base</Label>
 <div className="flex gap-2">
 <Input type="number" step="0.000001" min={0} value={form.rate_to_base} onChange={(e) => setForm({ ...form, rate_to_base: e.target.value })} placeholder="Ej: 950.00" className="app-input font-mono" />
 {canEdit("catalogos") && form.effective_date && form.currency_code && (
 <Button
 type="button"
 variant="outline"
 onClick={syncSingleDay}
 disabled={syncDayLoading}
 className="pg-btn-platinum-icon shrink-0"
 title="Descargar este valor desde mindicador.cl (Banco Central de Chile)"
 >
 <ArrowRightLeft className={`h-4 w-4 ${syncDayLoading ? "animate-spin" : ""}`} />
 </Button>
 )}
 </div>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Fecha de Vigencia</Label>
 <DatePicker value={form.effective_date} onChange={(v) => setForm({ ...form, effective_date: v })} className="w-full" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Origen</Label>
 <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="manual, API, banco" className="app-input" />
 </div>
 </div>
 </div>
 <div className="modal-footer">
 {editingId && canDelete("catalogos") ? (
 <button type="button" onClick={() => { if (confirm("¿Eliminar este tipo de cambio?")) { deleteMut.mutate(editingId); } }} className="pg-btn-platinum text-rose-600 dark:text-rose-400">Eliminar</button>
 ) : <span />}
 <div className="flex gap-2 ml-auto">
 <button type="button" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</button>
 <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="pg-btn-platinum">
 {createMut.isPending || updateMut.isPending ? "Guardando..." : "Guardar"}
 </button>
 </div>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 );
}
