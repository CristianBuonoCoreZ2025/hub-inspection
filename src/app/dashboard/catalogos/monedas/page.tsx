"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrencies, createCurrency, updateCurrency,
  getCountryCurrenciesAll, createCountryCurrency, updateCountryCurrency, deleteCountryCurrency,
  getCountries, updateCountryReferenceDateType,
} from "@/services/catalogs";
import { toast } from "sonner";
import { Coins, Pencil, Plus, Star, ArrowRightLeft, Globe } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToggleChip } from "@/components/ui/toggle-chip";

export default function MonedasPage() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-sm">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="app-page-title">Monedas</h1>
            <p className="app-page-lead">Catálogo global de monedas y asociación por país.</p>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <MonedasTab />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Monedas (catálogo global)
// ═══════════════════════════════════════════════════════════════

function MonedasTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreate, canEdit } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", decimals: "2" });
  const [onlyActive, setOnlyActive] = useState(true);

  // Modal de países
  const [paisesOpen, setPaisesOpen] = useState(false);
  const [paisesCurrency, setPaisesCurrency] = useState<{ code: string; name: string } | null>(null);

  const { data: currencies, isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: getCurrencies,
  });
  const { data: countryCurrenciesAll } = useQuery({
    queryKey: ["country-currencies-all"],
    queryFn: getCountryCurrenciesAll,
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
  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateCurrency(id, { is_active: isActive }),
    onSuccess: () => { toast.success("Estado actualizado"); queryClient.invalidateQueries({ queryKey: ["currencies"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { toast.error("Código y nombre son requeridos"); return; }
    const data = { code: form.code.toUpperCase(), name: form.name, symbol: form.symbol || undefined, decimals: parseInt(form.decimals) || 2 };
    if (editingId) updateMut.mutate({ id: editingId, input: data });
    else createMut.mutate(data);
  };

  // Filtrar: si onlyActive, solo activas; si no, todas
  const visibleCurrencies = (currencies || []).filter(c => !onlyActive || c.is_active);

  // Contar países asociados por moneda
  const countryCountByCode: Record<string, number> = {};
  for (const cc of countryCurrenciesAll || []) {
    if (cc.is_active) {
      countryCountByCode[cc.currency_code] = (countryCountByCode[cc.currency_code] || 0) + 1;
    }
  }

  const openPaises = (code: string, name: string) => {
    setPaisesCurrency({ code, name });
    setPaisesOpen(true);
  };

  return (
    <div className="app-stack">
      <div className="flex justify-between items-center">
        {/* Toggle: activo = solo activas, inactivo = todas */}
        <div className="flex items-center gap-2">
          <ToggleChip active={onlyActive} onClick={() => setOnlyActive(!onlyActive)}>
            Solo activas
          </ToggleChip>
          <span className="text-[11px] text-muted-foreground">
            {visibleCurrencies.length} de {currencies?.length || 0} monedas
          </span>
        </div>
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingId(null); setForm({ code: "", name: "", symbol: "", decimals: "2" }); setOpen(true); }} className="pg-btn-platinum">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva
          </Button>
        )}
      </div>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Símbolo</th>
                <th>Dec.</th>
                <th className="text-center">Países</th>
                <th className="w-[140px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              : visibleCurrencies.length === 0 ? <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No hay monedas.</td></tr>
              : visibleCurrencies.map((c) => (
                <tr key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                  <td>
                    <ToggleChip
                      active={c.is_active}
                      onClick={() => toggleActiveMut.mutate({ id: c.id, isActive: !c.is_active })}
                      disabled={!canEdit("catalogos")}
                    >
                      {c.is_active ? "Activa" : "Inactiva"}
                    </ToggleChip>
                  </td>
                  <td className="font-mono font-semibold text-[13px]">{c.code}</td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-muted-foreground">{c.symbol || "—"}</td>
                  <td className="text-muted-foreground">{c.decimals}</td>
                  <td className="text-center font-mono text-[12px] text-muted-foreground">{countryCountByCode[c.code] || 0}</td>
                  <td>
                    <div className="app-row-actions">
                      {/* Ver tipos de cambio */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="btn-neutral btn-icon"
                        onClick={() => router.push(`/dashboard/catalogos/tipos-cambio?currency=${c.code}`)}
                        title={`Ver tipos de cambio de ${c.code}`}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                      {/* Asociar países */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="btn-neutral btn-icon"
                        onClick={() => openPaises(c.code, c.name)}
                        title={`Asociar países a ${c.code}`}
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                      {/* Editar */}
                      {canEdit("catalogos") && (
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => { setEditingId(c.id); setForm({ code: c.code, name: c.name, symbol: c.symbol || "", decimals: String(c.decimals) }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
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

      {/* Modal editar/crear moneda */}
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

      {/* Modal asociar países */}
      {paisesCurrency && (
        <PaisesModal
          currencyCode={paisesCurrency.code}
          currencyName={paisesCurrency.name}
          open={paisesOpen}
          onOpenChange={setPaisesOpen}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal: asociar países a una moneda
// ═══════════════════════════════════════════════════════════════

function PaisesModal({
  currencyCode,
  currencyName,
  open,
  onOpenChange,
}: {
  currencyCode: string;
  currencyName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });
  const { data: relations } = useQuery({ queryKey: ["country-currencies-all"], queryFn: getCountryCurrenciesAll });

  // Relaciones existentes para esta moneda
  const existingByCountry: Record<string, { id: string; is_base: boolean; is_active: boolean; sort_order: number }> = {};
  for (const r of relations || []) {
    if (r.currency_code === currencyCode) {
      existingByCountry[r.country_id] = { id: r.id, is_base: r.is_base, is_active: r.is_active, sort_order: r.sort_order };
    }
  }

  const toggleMut = useMutation({
    mutationFn: async ({ countryId, activate }: { countryId: string; activate: boolean }) => {
      const existing = existingByCountry[countryId];
      if (activate && !existing) {
        // Crear relación nueva
        return createCountryCurrency({ country_id: countryId, currency_code: currencyCode, is_base: false, sort_order: 0 });
      } else if (!activate && existing) {
        // Desactivar relación
        return deleteCountryCurrency(existing.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["country-currencies-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setBaseMut = useMutation({
    mutationFn: async ({ countryId, relationId, makeBase }: { countryId: string; relationId: string; makeBase: boolean }) => {
      // Si estamos activando base, primero quitar base de otras monedas del mismo país
      if (makeBase) {
        const otherBase = (relations || []).find(r => r.country_id === countryId && r.is_base && r.currency_code !== currencyCode);
        if (otherBase) {
          await updateCountryCurrency(otherBase.id, { is_base: false });
        }
      }
      return updateCountryCurrency(relationId, { is_base: makeBase });
    },
    onSuccess: () => {
      toast.success(makeBaseToast());
      queryClient.invalidateQueries({ queryKey: ["country-currencies-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function makeBaseToast() {
    return "Moneda base actualizada";
  }

  const refDateMut = useMutation({
    mutationFn: ({ countryId, type }: { countryId: string; type: "claim_date" | "execution_date" }) =>
      updateCountryReferenceDateType(countryId, type),
    onSuccess: () => { toast.success("Fecha de referencia actualizada"); queryClient.invalidateQueries({ queryKey: ["countries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sortedCountries = (countries || []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-lg" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 text-white shadow-sm">
              <Globe className="h-4 w-4" />
            </div>
            <span className="font-mono font-bold">{currencyCode}</span>
            <span className="text-muted-foreground font-normal">— {currencyName}</span>
          </DialogTitle>
        </div>
        <div className="modal-body">
          <p className="text-[12px] text-muted-foreground mb-3">
            Activa los países donde esta moneda se utiliza. Marca <Star className="inline h-3 w-3 fill-current text-amber-500" /> Base para la moneda base de cada país.
          </p>
          <div className="app-data-table-wrap max-h-[400px] overflow-y-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>País</th>
                  <th className="text-center w-20">Asoc.</th>
                  <th className="text-center w-20">Base</th>
                  <th className="w-32">Fecha Ref.</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map((country) => {
                  const rel = existingByCountry[country.id];
                  const isAssociated = rel?.is_active ?? false;
                  const isBase = rel?.is_base ?? false;
                  const refDateType = country.reference_date_type || "claim_date";
                  return (
                    <tr key={country.id}>
                      <td className="font-medium">
                        <span className="font-mono text-[11px] text-muted-foreground mr-2">{country.code}</span>
                        {country.name}
                      </td>
                      <td className="text-center">
                        <ToggleChip
                          active={isAssociated}
                          onClick={() => toggleMut.mutate({ countryId: country.id, activate: !isAssociated })}
                          disabled={!canEdit("catalogos") || toggleMut.isPending}
                        >
                          {isAssociated ? "Sí" : "No"}
                        </ToggleChip>
                      </td>
                      <td className="text-center">
                        {isAssociated ? (
                          <button
                            type="button"
                            disabled={!canEdit("catalogos") || setBaseMut.isPending}
                            onClick={() => setBaseMut.mutate({ countryId: country.id, relationId: rel.id, makeBase: !isBase })}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${
                              isBase
                                ? "border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                : "border-border text-muted-foreground hover:bg-muted/50"
                            } ${!canEdit("catalogos") ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <Star className={`h-3 w-3 ${isBase ? "fill-current" : ""}`} />
                            {isBase ? "Base" : "—"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30 text-[11px]">—</span>
                        )}
                      </td>
                      <td>
                        {isAssociated && (
                          <select
                            className="h-6 rounded border-border bg-transparent text-[11px] px-1"
                            value={refDateType}
                            onChange={(e) => refDateMut.mutate({ countryId: country.id, type: e.target.value as "claim_date" | "execution_date" })}
                          >
                            <option value="claim_date">Siniestro</option>
                            <option value="execution_date">Ejecución</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => onOpenChange(false)} className="pg-btn-platinum ml-auto">Cerrar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
