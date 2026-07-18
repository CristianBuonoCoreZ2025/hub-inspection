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
// TAB 3: Tipos de Cambio
// ═══════════════════════════════════════════════════════════════

function CambiosTab() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ country_id: "", currency_code: "", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" });

  // Panel de entrada rápida
  const [quickCountry, setQuickCountry] = useState("");
  const [quickCurrency, setQuickCurrency] = useState("");
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split("T")[0]);
  const [quickRate, setQuickRate] = useState("");

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

  // Monedas disponibles para el país seleccionado en entrada rápida
  const quickCurrencyOptions = (countryCurrenciesAll || [])
    .filter(cc => cc.country_id === quickCountry && cc.is_active)
    .map(cc => ({ code: cc.currency_code, name: cc.currency?.name || cc.currency_code }));

  // Agrupar por país → moneda → historial de fechas
  const byCountry: Record<string, { countryName: string; countryCode: string; byCurrency: Record<string, { currencyName: string; currencyCode: string; items: NonNullable<typeof rates> }> }> = {};
  for (const r of rates || []) {
    const key = r.country_id;
    if (!byCountry[key]) byCountry[key] = { countryName: r.country?.name || "—", countryCode: r.country?.code || "", byCurrency: {} };
    const cKey = r.currency_code;
    if (!byCountry[key]!.byCurrency[cKey]) byCountry[key]!.byCurrency[cKey] = { currencyName: r.currency?.name || r.currency_code, currencyCode: r.currency_code, items: [] };
    byCountry[key]!.byCurrency[cKey]!.items.push(r);
  }

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCountry || !quickCurrency || !quickRate) { toast.error("País, moneda y tasa son requeridos"); return; }
    createMut.mutate(
      { country_id: quickCountry, currency_code: quickCurrency, rate_to_base: parseFloat(quickRate), effective_date: quickDate, source: "manual" },
      {
        onSuccess: () => { setQuickRate(""); },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.country_id || !form.currency_code || !form.rate_to_base) { toast.error("País, moneda y tasa son requeridos"); return; }
    const data = { country_id: form.country_id, currency_code: form.currency_code, rate_to_base: parseFloat(form.rate_to_base), effective_date: form.effective_date, source: form.source };
    if (editingId) updateMut.mutate({ id: editingId, input: data });
    else createMut.mutate(data);
  };

  return (
    <div className="app-stack">
      {/* ── Panel de entrada rápida ── */}
      {canCreate("catalogos") && (
        <div className="app-panel">
          <h3 className="app-section-title flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Carga Rápida de Tasa
          </h3>
          <form onSubmit={handleQuickSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="app-field-label">País</Label>
              <select
                className="app-input w-full"
                value={quickCountry}
                onChange={(e) => { setQuickCountry(e.target.value); setQuickCurrency(""); }}
              >
                <option value="">Seleccionar...</option>
                {countries?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="app-field-label">Moneda</Label>
              <select
                className="app-input w-full"
                value={quickCurrency}
                onChange={(e) => setQuickCurrency(e.target.value)}
                disabled={!quickCountry}
              >
                <option value="">Seleccionar...</option>
                {quickCurrencyOptions.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="app-field-label">Fecha</Label>
              <Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className="app-input" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="app-field-label">Tasa → Base</Label>
                <Input type="number" step="0.000001" min={0} value={quickRate} onChange={(e) => setQuickRate(e.target.value)} placeholder="Ej: 950.00" className="app-input font-mono" />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="pg-btn-platinum">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Botones de acción ── */}
      <div className="flex justify-end gap-2">
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
        {canCreate("catalogos") && (
          <Button variant="outline" onClick={() => { setEditingId(null); setForm({ country_id: "", currency_code: "", rate_to_base: "", effective_date: new Date().toISOString().split("T")[0], source: "manual" }); setOpen(true); }} className="pg-btn-platinum-icon">
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo
          </Button>
        )}
      </div>

      {/* ── Historial agrupado por país → moneda ── */}
      <div className="space-y-3">
        {isLoading ? <div className="app-panel text-center py-4 text-muted-foreground text-sm">Cargando...</div>
        : Object.values(byCountry).length === 0 ? <div className="app-panel text-center py-4 text-muted-foreground text-sm">No hay tipos de cambio configurados.</div>
        : Object.values(byCountry).sort((a, b) => a.countryName.localeCompare(b.countryName)).map((group) => {
          const countryData = countries?.find(c => c.id === Object.keys(byCountry).find(k => byCountry[k] === group));
          return (
          <div key={group.countryCode} className="app-panel">
            <h3 className="app-section-title flex items-center gap-2 mb-3">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-[11px] text-muted-foreground">{group.countryCode}</span>
              {group.countryName}
              {countryData?.reference_date_type === "execution_date" && (
                <span className="text-[10px] rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  Ref: Fecha Ejecución
                </span>
              )}
              {countryData?.reference_date_type === "claim_date" && (
                <span className="text-[10px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  Ref: Fecha Siniestro
                </span>
              )}
            </h3>
            <div className="space-y-3">
              {Object.values(group.byCurrency).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)).map((curr) => (
                <div key={curr.currencyCode}>
                  <h4 className="text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-2">
                    <span className="font-mono">{curr.currencyCode}</span>
                    {curr.currencyName}
                    <span className="text-[10px] text-muted-foreground font-normal">({curr.items.length} registros)</span>
                  </h4>
                  <div className="app-data-table-wrap">
                    <table className="app-data-table">
                      <thead><tr><th className="text-right">Tasa → Base</th><th>Fecha</th><th>Origen</th><th className="w-[80px]"></th></tr></thead>
                      <tbody>
                        {curr.items.sort((a, b) => b.effective_date.localeCompare(a.effective_date)).map((r) => (
                          <tr key={r.id}>
                            <td className="text-right font-mono font-semibold">{r.rate_to_base.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                            <td className="text-muted-foreground text-[11px]">{new Date(r.effective_date).toLocaleDateString("es-CL")}</td>
                            <td className="text-muted-foreground text-[11px]">{r.source || "—"}</td>
                            <td>
                              <div className="app-row-actions">
                                {canEdit("catalogos") && (
                                  <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(r.id); setForm({ country_id: r.country_id, currency_code: r.currency_code, rate_to_base: String(r.rate_to_base), effective_date: r.effective_date, source: r.source || "manual" }); setOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete("catalogos") && (
                                  <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Eliminar este tipo de cambio?")) deleteMut.mutate(r.id); }}>
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
              ))}
            </div>
          </div>
        );
        })}
      </div>

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
