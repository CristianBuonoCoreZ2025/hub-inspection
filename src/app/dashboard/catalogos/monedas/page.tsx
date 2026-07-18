"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrencies, createCurrency, updateCurrency, deleteCurrency,
  getCountryCurrenciesAll, createCountryCurrency, updateCountryCurrency, deleteCountryCurrency,
  getExchangeRates, createExchangeRate, updateExchangeRate, deleteExchangeRate,
  getCountries, updateCountryReferenceDateType,
} from "@/services/catalogs";
import { toast } from "sonner";
import { Coins, Pencil, Trash2, Plus, Star, ArrowRightLeft, Calendar } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

type Tab = "monedas" | "paises" | "cambios";

export default function MonedasPage() {
  const [tab, setTab] = useState<Tab>("monedas");

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-sm">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="app-page-title">Monedas y Tipos de Cambio</h1>
            <p className="app-page-lead">Catálogo global de monedas, relación por país y tipos de cambio.</p>
          </div>
        </div>
      </div>

      {/* Tabs internos */}
      <div className="border-b">
        <div className="flex gap-1">
          {([
            { id: "monedas" as Tab, label: "Monedas" },
            { id: "paises" as Tab, label: "Monedas por País" },
            { id: "cambios" as Tab, label: "Tipos de Cambio" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {tab === "monedas" && <MonedasTab />}
        {tab === "paises" && <PaisesTab />}
        {tab === "cambios" && <CambiosTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Monedas (catálogo global)
// ═══════════════════════════════════════════════════════════════

function MonedasTab() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", decimals: "2" });

  const { data: currencies, isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: getCurrencies,
  });

  const createMut = useMutation({
    mutationFn: createCurrency,
    onSuccess: () => { toast.success("Moneda creada"); queryClient.invalidateQueries({ queryKey: ["currencies"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCurrency>[1] }) => updateCurrency(id, input),
    onSuccess: () => { toast.success("Moneda actualizada"); queryClient.invalidateQueries({ queryKey: ["currencies"] }); setOpen(false); setEditingId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteCurrency,
    onSuccess: () => { toast.success("Moneda desactivada"); queryClient.invalidateQueries({ queryKey: ["currencies"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { toast.error("Código y nombre son requeridos"); return; }
    const data = { code: form.code.toUpperCase(), name: form.name, symbol: form.symbol || undefined, decimals: parseInt(form.decimals) || 2 };
    if (editingId) updateMut.mutate({ id: editingId, input: data });
    else createMut.mutate(data);
  };

  return (
    <div className="app-stack">
      <div className="flex justify-end">
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingId(null); setForm({ code: "", name: "", symbol: "", decimals: "2" }); setOpen(true); }} className="pg-btn-platinum">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva
          </Button>
        )}
      </div>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead><tr><th className="w-10"></th><th>Código</th><th>Nombre</th><th>Símbolo</th><th>Decimales</th><th className="w-[80px]"></th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              : currencies?.length === 0 ? <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No hay monedas.</td></tr>
              : currencies?.map((c) => (
                <tr key={c.id}>
                  <td><StatusBadge status={c.is_active ? "active" : "inactive"} label={c.is_active ? "Activo" : "Inactivo"} /></td>
                  <td className="font-mono font-semibold text-[13px]">{c.code}</td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-muted-foreground">{c.symbol || "—"}</td>
                  <td className="text-muted-foreground">{c.decimals}</td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(c.id); setForm({ code: c.code, name: c.name, symbol: c.symbol || "", decimals: String(c.decimals) }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm(`¿Desactivar ${c.code}?`)) deleteMut.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                <Coins className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"} Moneda
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-2">
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="app-field-label">Código ISO (3 letras)</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="USD" maxLength={4} className="app-input font-mono uppercase" disabled={!!editingId} />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Nombre</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dólar Americano" className="app-input" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Símbolo</Label>
                  <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="$" maxLength={5} className="app-input" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Decimales</Label>
                  <Input type="number" min={0} max={6} value={form.decimals} onChange={(e) => setForm({ ...form, decimals: e.target.value })} className="app-input" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="pg-btn-platinum">
                {createMut.isPending || updateMut.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: Monedas por País
// ═══════════════════════════════════════════════════════════════

function PaisesTab() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ country_id: "", currency_code: "", is_base: false, sort_order: "0" });

  const { data: relations, isLoading } = useQuery({
    queryKey: ["country-currencies-all"],
    queryFn: getCountryCurrenciesAll,
  });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: getCurrencies });

  const createMut = useMutation({
    mutationFn: createCountryCurrency,
    onSuccess: () => { toast.success("Relación creada"); queryClient.invalidateQueries({ queryKey: ["country-currencies-all"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCountryCurrency>[1] }) => updateCountryCurrency(id, input),
    onSuccess: () => { toast.success("Relación actualizada"); queryClient.invalidateQueries({ queryKey: ["country-currencies-all"] }); setOpen(false); setEditingId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: deleteCountryCurrency,
    onSuccess: () => { toast.success("Relación desactivada"); queryClient.invalidateQueries({ queryKey: ["country-currencies-all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateRefDateMut = useMutation({
    mutationFn: ({ countryId, type }: { countryId: string; type: "claim_date" | "execution_date" }) =>
      updateCountryReferenceDateType(countryId, type),
    onSuccess: () => { toast.success("Fecha de referencia actualizada"); queryClient.invalidateQueries({ queryKey: ["countries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrupar por país
  const byCountry: Record<string, { countryName: string; countryCode: string; items: NonNullable<typeof relations> }> = {};
  for (const r of relations || []) {
    const key = r.country_id;
    if (!byCountry[key]) byCountry[key] = { countryName: r.country?.name || "—", countryCode: r.country?.code || "", items: [] };
    byCountry[key]!.items.push(r);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.country_id || !form.currency_code) { toast.error("País y moneda son requeridos"); return; }
    const data = { country_id: form.country_id, currency_code: form.currency_code, is_base: form.is_base, sort_order: parseInt(form.sort_order) || 0 };
    if (editingId) updateMut.mutate({ id: editingId, input: data });
    else createMut.mutate(data);
  };

  return (
    <div className="app-stack">
      <div className="flex justify-end">
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingId(null); setForm({ country_id: "", currency_code: "", is_base: false, sort_order: "0" }); setOpen(true); }} className="pg-btn-platinum">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? <div className="app-panel text-center py-4 text-muted-foreground text-sm">Cargando...</div>
        : Object.values(byCountry).length === 0 ? <div className="app-panel text-center py-4 text-muted-foreground text-sm">No hay relaciones configuradas.</div>
        : Object.values(byCountry).sort((a, b) => a.countryName.localeCompare(b.countryName)).map((group) => {
          const countryId = group.items?.[0]?.country_id || "";
          const countryData = countries?.find(c => c.id === countryId);
          const refDateType = countryData?.reference_date_type || "claim_date";
          return (
          <div key={group.countryCode} className="app-panel">
            <h3 className="app-section-title flex items-center gap-2 mb-3">
              <span className="font-mono text-[11px] text-muted-foreground">{group.countryCode}</span>
              {group.countryName}
              <span className="text-[11px] text-muted-foreground font-normal">({group.items?.length || 0} monedas)</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Fecha ref.:
                <select
                  className="h-6 rounded border-border bg-transparent text-[11px] px-1"
                  value={refDateType}
                  onChange={(e) => {
                    updateRefDateMut.mutate({ countryId, type: e.target.value as "claim_date" | "execution_date" });
                  }}
                >
                  <option value="claim_date">Fecha Siniestro</option>
                  <option value="execution_date">Fecha Ejecución</option>
                </select>
              </span>
            </h3>
            <div className="app-data-table-wrap">
              <table className="app-data-table">
                <thead><tr><th>Moneda</th><th>Código</th><th>Base</th><th>Orden</th><th className="w-[80px]"></th></tr></thead>
                <tbody>
                  {group.items?.sort((a, b) => a.sort_order - b.sort_order).map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.currency?.name || r.currency_code}</td>
                      <td className="font-mono font-semibold text-[13px]">{r.currency_code}</td>
                      <td>
                        {r.is_base ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                            <Star className="h-3 w-3 fill-current" /> Base
                          </span>
                        ) : <span className="text-muted-foreground text-[11px]">—</span>}
                      </td>
                      <td className="text-muted-foreground text-[11px]">{r.sort_order}</td>
                      <td>
                        <div className="app-row-actions">
                          {canEdit("catalogos") && (
                            <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(r.id); setForm({ country_id: r.country_id, currency_code: r.currency_code, is_base: r.is_base, sort_order: String(r.sort_order) }); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete("catalogos") && (
                            <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar esta relación?")) deleteMut.mutate(r.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
                <Coins className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"} Relación País-Moneda
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
                    items={[{ value: "__none", label: "Seleccionar..." }, ...(currencies || []).filter(c => c.is_active).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))]}
                  >
                    <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Seleccionar...</SelectItem>
                      {currencies?.filter(c => c.is_active).map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">¿Moneda Base?</Label>
                  <label className="flex items-center gap-2 h-9">
                    <input type="checkbox" checked={form.is_base} onChange={(e) => setForm({ ...form, is_base: e.target.checked })} className="h-4 w-4 rounded border-border" />
                    <span className="text-[13px] text-muted-foreground">Marcar como moneda base del país</span>
                  </label>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Orden</Label>
                  <Input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="app-input" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="pg-btn-platinum">
                {createMut.isPending || updateMut.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Tipos de Cambio — Vista pivote por año (estilo SII)
// ═══════════════════════════════════════════════════════════════

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function CambiosTab() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ country_id: "", currency_code: "", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" });

  // Filtros: país, moneda, año
  const currentYear = new Date().getFullYear();
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));

  const { data: rates, isLoading } = useQuery({ queryKey: ["exchange-rates"], queryFn: getExchangeRates });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: getCurrencies });
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
    onSuccess: () => { toast.success("Tipo de cambio eliminado"); queryClient.invalidateQueries({ queryKey: ["exchange-rates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncChileMut = useMutation({
    mutationFn: async (date?: string) => {
      const resp = await fetch("/api/currencies/sync-chile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(date ? { date } : {}),
      });
      if (!resp.ok) throw new Error("Error al sincronizar");
      return resp.json();
    },
    onSuccess: (data: { summary: { inserted: number; exists: number; errors: number } }) => {
      const s = data.summary;
      toast.success(`Sincronización BCCh: ${s.inserted} nuevas, ${s.exists} ya existían${s.errors > 0 ? `, ${s.errors} errores` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Monedas del país seleccionado
  const countryCurrencyOptions = (countryCurrenciesAll || [])
    .filter(cc => cc.country_id === filterCountry && cc.is_active)
    .map(cc => ({ code: cc.currency_code, name: cc.currency?.name || cc.currency_code, isBase: cc.is_base }));

  // País seleccionado: datos
  const selectedCountry = countries?.find(c => c.id === filterCountry);
  const selectedCurrency = countryCurrencyOptions.find(c => c.code === filterCurrency);

  // Filtrar tasas por país + moneda + año
  const filteredRates = (rates || []).filter(r => {
    if (filterCountry && r.country_id !== filterCountry) return false;
    if (filterCurrency && r.currency_code !== filterCurrency) return false;
    if (filterYear) {
      const rYear = r.effective_date.split("-")[0];
      if (rYear !== filterYear) return false;
    }
    return true;
  });

  // Construir matriz pivote: filas = día (1-31), columnas = mes (0-11)
  // pivot[day][month] = { rate, id, source }
  const pivot: Record<number, Record<number, { rate: number; id: string; source: string | null } | undefined>> = {};
  for (const r of filteredRates) {
    const d = new Date(r.effective_date + "T00:00:00");
    const day = d.getDate();
    const month = d.getMonth();
    if (!pivot[day]) pivot[day] = {};
    pivot[day][month] = { rate: r.rate_to_base, id: r.id, source: r.source };
  }

  // Años disponibles (de los datos + actual)
  const availableYears = new Set<string>();
  for (const r of rates || []) {
    availableYears.add(r.effective_date.split("-")[0]);
  }
  availableYears.add(String(currentYear));
  const yearOptions = Array.from(availableYears).sort().reverse();

  // Estadísticas del año
  const yearRates = filteredRates.map(r => r.rate_to_base);
  const yearStats = yearRates.length > 0 ? {
    min: Math.min(...yearRates),
    max: Math.max(...yearRates),
    avg: yearRates.reduce((a, b) => a + b, 0) / yearRates.length,
    count: yearRates.length,
  } : null;

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

  return (
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
              items={[{ value: "__none", label: "Todos" }, ...(countries || []).map((c) => ({ value: c.id, label: c.name }))]}
            >
              <SelectTrigger className="app-input h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Todos</SelectItem>
                {countries?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Moneda */}
          <div className="min-w-[160px]">
            <Label className="app-field-label">Moneda</Label>
            <Select
              value={filterCurrency || "__none"}
              onValueChange={(v) => setFilterCurrency(v === "__none" ? "" : (v ?? ""))}
              items={[{ value: "__none", label: "Todas" }, ...countryCurrencyOptions.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))]}
            >
              <SelectTrigger className="app-input h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Todas</SelectItem>
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
              items={yearOptions.map(y => ({ value: y, label: y }))}
            >
              <SelectTrigger className="app-input h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Badge de fecha de referencia */}
          {selectedCountry && (
            <div className="ml-auto flex items-center gap-2">
              {selectedCountry.reference_date_type === "execution_date" ? (
                <span className="text-[10px] rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-medium">
                  Ref: Fecha Ejecución
                </span>
              ) : (
                <span className="text-[10px] rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-medium">
                  Ref: Fecha Siniestro
                </span>
              )}
            </div>
          )}

          {/* Botón Sincronizar BCCh */}
          {canCreate("catalogos") && (
            <Button
              variant="outline"
              onClick={() => syncChileMut.mutate(undefined)}
              disabled={syncChileMut.isPending}
              className="pg-btn-platinum-icon"
              title="Descarga USD y UF de los últimos 30 días desde mindicador.cl (Banco Central de Chile)"
            >
              <ArrowRightLeft className={`mr-1.5 h-4 w-4 ${syncChileMut.isPending ? "animate-spin" : ""}`} />
              {syncChileMut.isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          )}

          {/* Botón Nuevo */}
          {canCreate("catalogos") && (
            <Button
              variant="outline"
              onClick={() => { setEditingId(null); setForm({ country_id: filterCountry, currency_code: filterCurrency, rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" }); setOpen(true); }}
              className="pg-btn-platinum-icon"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats del año ── */}
      {yearStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="app-panel py-3 px-4">
            <div className="text-[11px] text-muted-foreground">Registros {filterYear}</div>
            <div className="text-xl font-bold font-mono">{yearStats.count}</div>
          </div>
          <div className="app-panel py-3 px-4">
            <div className="text-[11px] text-muted-foreground">Mínimo</div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatRate(yearStats.min)}</div>
          </div>
          <div className="app-panel py-3 px-4">
            <div className="text-[11px] text-muted-foreground">Promedio</div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatRate(yearStats.avg)}</div>
          </div>
          <div className="app-panel py-3 px-4">
            <div className="text-[11px] text-muted-foreground">Máximo</div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{formatRate(yearStats.max)}</div>
          </div>
        </div>
      )}

      {/* ── Tabla pivote: días × meses ── */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : !filterCountry || !filterCurrency ? (
        <div className="app-panel text-center py-12">
          <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">
            Selecciona un país y una moneda para ver la tabla de tipos de cambio del año.
          </p>
        </div>
      ) : filteredRates.length === 0 ? (
        <div className="app-panel text-center py-12">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">
            No hay tipos de cambio para {selectedCurrency?.name || filterCurrency} en {selectedCountry?.name || filterCountry} durante {filterYear}.
          </p>
          {canCreate("catalogos") && (
            <Button
              variant="outline"
              onClick={() => { setEditingId(null); setForm({ country_id: filterCountry, currency_code: filterCurrency, rate_to_base: "", effective_date: `${filterYear}-01-01`, source: "manual" }); setOpen(true); }}
              className="pg-btn-platinum-icon mt-3"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo
            </Button>
          )}
        </div>
      ) : (
        <div className="app-panel">
          {/* Header de la tabla pivote */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="app-section-title flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{selectedCountry?.code}</span>
              {selectedCountry?.name}
              <span className="text-muted-foreground">·</span>
              <span className="font-mono font-semibold text-[13px]">{filterCurrency}</span>
              {selectedCurrency?.isBase && (
                <span className="text-[10px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-medium">Base</span>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-[12px] text-muted-foreground">{filterYear}</span>
            </h3>
          </div>

          {/* Tabla pivote */}
          <div className="overflow-x-auto">
            <table className="app-data-table text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background w-10 text-center">Día</th>
                  {MONTHS.map(m => <th key={m} className="text-center min-w-[70px]">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                  const hasAny = pivot[day] && Object.keys(pivot[day]).length > 0;
                  if (!hasAny) return null;
                  return (
                    <tr key={day} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-background text-center font-mono font-semibold text-muted-foreground">{day}</td>
                      {MONTHS.map((_, monthIdx) => {
                        const cell = pivot[day]?.[monthIdx];
                        if (!cell) return <td key={monthIdx} className="text-center text-muted-foreground/20">—</td>;
                        return (
                          <td
                            key={monthIdx}
                            className="text-center font-mono cursor-pointer hover:bg-primary/10 rounded transition-colors"
                            title={`${day}/${String(monthIdx + 1).padStart(2, "0")}/${filterYear} — ${cell.source || "manual"}`}
                            onClick={() => { if (canEdit("catalogos")) { setEditingId(cell.id); setForm({ country_id: filterCountry, currency_code: filterCurrency, rate_to_base: String(cell.rate), effective_date: `${filterYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, source: cell.source || "manual" }); setOpen(true); } }}
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
          </div>

          {/* Leyenda */}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-primary/10" /> Clic para editar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">—</span> Sin dato
            </span>
            {selectedCurrency && !selectedCurrency.isBase && (
              <span className="ml-auto">
                Tasa = 1 {filterCurrency} en moneda base ({countryCurrencyOptions.find(c => c.isBase)?.code || "—"})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de edición/creación ── */}
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
                    items={[{ value: "__none", label: "Seleccionar..." }, ...(currencies || []).filter(c => c.is_active).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))]}
                  >
                    <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Seleccionar...</SelectItem>
                      {currencies?.filter(c => c.is_active).map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Tasa hacia Moneda Base</Label>
                  <Input type="number" step="0.000001" min={0} value={form.rate_to_base} onChange={(e) => setForm({ ...form, rate_to_base: e.target.value })} placeholder="Ej: 950.00" className="app-input font-mono" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Fecha de Vigencia</Label>
                  <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} className="app-input" />
                </div>
                <div className="modal-field">
                  <Label className="app-field-label">Origen</Label>
                  <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="manual, API, banco" className="app-input" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {editingId && canDelete("catalogos") ? (
                <button type="button" onClick={() => { if (confirm("¿Eliminar este tipo de cambio?")) { deleteMut.mutate(editingId); setOpen(false); setEditingId(null); } }} className="pg-btn-platinum text-rose-600 dark:text-rose-400">Eliminar</button>
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
