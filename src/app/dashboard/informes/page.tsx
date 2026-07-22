"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  Users,
  Building2,
  Calendar,
  ClipboardCheck,
  Search,
} from "lucide-react";

import { getClaims } from "@/services/claims";
import { getInspectionSessions } from "@/services/inspections";
import { useRealtime } from "@/hooks/use-realtime";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

const STATUS_LABELS: Record<string, string> = {
  created: "Creado",
  adjustment: "Liquidación",
  dispatchment: "Despacho",
  closed: "Cerrado",
  reopened: "Reabierto",
};

const STATUS_COLORS: Record<string, string> = {
  created: "#3b82f6",
  adjustment: "#f59e0b",
  dispatchment: "#8b5cf6",
  closed: "#10b981",
  reopened: "#ef4444",
};

type ReportTab = "resumen" | "responsables" | "companias" | "inspecciones" | "siniestros";
type RoleSubTab = "liquidador" | "inspector" | "auditor" | "despachador" | "asistente";

const ROLE_CONFIG: Record<RoleSubTab, { field: string; label: string }> = {
  liquidador: { field: "adjuster_id", label: "Liquidador" },
  inspector: { field: "inspector_id", label: "Inspector" },
  auditor: { field: "auditor_id", label: "Auditor" },
  despachador: { field: "dispatcher_id", label: "Despachador" },
  asistente: { field: "assistant_id", label: "Asistente" },
};

export default function InformesPage() {
  const [tab, setTab] = useState<ReportTab>("resumen");
  const [roleSubTab, setRoleSubTab] = useState<RoleSubTab>("liquidador");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  useRealtime("claims", [["claims-all"]]);
  useRealtime("inspection_sessions", [["inspection-sessions-all"]]);

  // ── Data ──
  const { data: claims = [] } = useQuery({
    queryKey: ["claims-all"],
    queryFn: () => getClaims(),
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ["inspection-sessions-all"],
    queryFn: () => getInspectionSessions(),
  });

  // ── Filters ──
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (statusFilter && c.status?.code !== statusFilter) return false;
      if (dateFrom && c.created_at < dateFrom) return false;
      if (dateTo && c.created_at > dateTo + "T23:59:59") return false;
      if (search) {
        const s = search.toLowerCase();
        const match =
          c.claim_number?.toLowerCase().includes(s) ||
          c.liquidation_number?.toLowerCase().includes(s) ||
          c.insurance_company?.name?.toLowerCase().includes(s) ||
          c.adjuster?.full_name?.toLowerCase().includes(s) ||
          c.inspector?.full_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      return true;
    });
  }, [claims, statusFilter, dateFrom, dateTo, search]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      if (dateFrom && i.created_at < dateFrom) return false;
      if (dateTo && i.created_at > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [inspections, dateFrom, dateTo]);

  // ── KPIs ──
  const avgDays = useMemo(() => {
    const closedClaims = filteredClaims.filter((c) => c.status?.code === "closed" && c.created_at);
    if (closedClaims.length === 0) return 0;
    const totalDays = closedClaims.reduce((sum, c) => {
      const created = new Date(c.created_at).getTime();
      const updated = new Date(c.updated_at).getTime();
      return sum + Math.max(1, Math.floor((updated - created) / 86400000));
    }, 0);
    return Math.round(totalDays / closedClaims.length);
  }, [filteredClaims]);

  const kpis = useMemo(() => {
    const total = filteredClaims.length;
    const closed = filteredClaims.filter((c) => c.status?.code === "closed").length;
    const open = filteredClaims.filter((c) => c.status?.code !== "closed" && !c.disabled).length;
    const disabled = filteredClaims.filter((c) => c.disabled).length;
    return { total, closed, open, disabled, avgDays };
  }, [filteredClaims, avgDays]);

  // ── Por estado ──
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredClaims.forEach((c) => {
      const code = c.status?.code || "unknown";
      map[code] = (map[code] || 0) + 1;
    });
    return Object.entries(map).map(([code, count]) => ({
      code,
      label: STATUS_LABELS[code] || code,
      count,
      color: STATUS_COLORS[code] || "#6b7280",
      pct: Math.round((count / filteredClaims.length) * 100) || 0,
    }));
  }, [filteredClaims]);

  // ── Por responsable (rol configurable) ──
  const byRole = useMemo(() => {
    const cfg = ROLE_CONFIG[roleSubTab];
    const map: Record<string, { name: string; total: number; closed: number; open: number }> = {};
    filteredClaims.forEach((c) => {
      const row = c as unknown as Record<string, unknown>;
      const id = row[cfg.field] as string | null;
      const profileKey = cfg.field.replace("_id", "");
      const profile = row[profileKey] as { full_name: string } | null | undefined;
      const name = profile?.full_name || "Sin asignar";
      if (!map[id || "unassigned"]) map[id || "unassigned"] = { name, total: 0, closed: 0, open: 0 };
      map[id || "unassigned"].total++;
      if (c.status?.code === "closed") map[id || "unassigned"].closed++;
      else if (!c.disabled) map[id || "unassigned"].open++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredClaims, roleSubTab]);

  // ── Por compañía ──
  const byCompany = useMemo(() => {
    const map: Record<string, { name: string; total: number; closed: number; open: number }> = {};
    filteredClaims.forEach((c) => {
      const id = c.insurance_company_id || "unknown";
      const name = c.insurance_company?.name || "Sin compañía";
      if (!map[id]) map[id] = { name, total: 0, closed: 0, open: 0 };
      map[id].total++;
      if (c.status?.code === "closed") map[id].closed++;
      else if (!c.disabled) map[id].open++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredClaims]);

  // ── Inspecciones ──
  const inspectionStats = useMemo(() => {
    const total = filteredInspections.length;
    const completed = filteredInspections.filter((i) => i.status === "completed").length;
    const active = filteredInspections.filter((i) => i.status === "active").length;
    const scheduled = filteredInspections.filter((i) => i.status === "scheduled").length;
    const cancelled = filteredInspections.filter((i) => i.status === "cancelled").length;
    return { total, completed, active, scheduled, cancelled };
  }, [filteredInspections]);

  // ── Paginación de grillas (max 20 por página) ──
  const rolePagination = usePagination(byRole, 20);
  const companyPagination = usePagination(byCompany, 20);
  const claimsPagination = usePagination(filteredClaims, 20);

  // ── Export CSV ──
  const exportCSV = () => {
    const headers = ["N° Liquidación", "N° Siniestro", "Compañía", "Liquidador", "Inspector", "Auditor", "Despachador", "Asistente", "Estado", "Fecha Creación", "Fecha Cierre"];
    const rows = filteredClaims.map((c) => [
      c.liquidation_number || "",
      c.claim_number || "",
      c.insurance_company?.name || "",
      c.adjuster?.full_name || "",
      c.inspector?.full_name || "",
      c.auditor?.full_name || "",
      c.dispatcher?.full_name || "",
      c.assistant?.full_name || "",
      STATUS_LABELS[c.status?.code || ""] || c.status?.code || "",
      c.created_at?.slice(0, 10) || "",
      c.status?.code === "closed" ? c.updated_at?.slice(0, 10) || "" : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-siniestros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: ReportTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "resumen", label: "Resumen", icon: BarChart3 },
    { id: "responsables", label: "Por Responsable", icon: Users },
    { id: "companias", label: "Por Compañía", icon: Building2 },
    { id: "inspecciones", label: "Inspecciones", icon: ClipboardCheck },
    { id: "siniestros", label: "Detalle Siniestros", icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-blue-500 to-cyan-500">
            <BarChart3 />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Informes</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          <Button className="pg-btn-platinum" onClick={exportCSV}>
            <Download className="mr-1.5 size-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="app-panel p-3">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liquid-search"
              />
            </div>
            <Select
              value={statusFilter || "__all"}
              onValueChange={(v) => setStatusFilter(v === "__all" || v === null ? "" : v)}
              items={[
                { value: "__all", label: "Todos los estados" },
                ...Object.entries(STATUS_LABELS).map(([code, label]) => ({ value: code, label })),
              ]}
            >
              <SelectTrigger className="app-input app-filter-narrow">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos los estados</SelectItem>
                {Object.entries(STATUS_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              value={dateFrom}
              onChange={(value) => {
                setDateFrom(value);
                if (value && dateTo && value > dateTo) setDateTo(value);
              }}
              placeholder="Desde"
              className="max-w-[110px]"
              maxDate={dateTo || undefined}
            />
            <DatePicker
              value={dateTo}
              onChange={(value) => {
                setDateTo(value);
                if (value && dateFrom && value < dateFrom) setDateFrom(value);
              }}
              placeholder="Hasta"
              className="max-w-[110px]"
              minDate={dateFrom || undefined}
            />
            {(statusFilter || dateFrom || dateTo || search) && (
              <button
                onClick={() => { setStatusFilter(""); setDateFrom(""); setDateTo(""); setSearch(""); }}
                className="text-[12px] text-muted-foreground hover:text-foreground px-2"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard label="Total Siniestros" value={kpis.total} icon={FileText} color="text-blue-500" />
        <KPICard label="Abiertos" value={kpis.open} icon={Clock} color="text-amber-500" />
        <KPICard label="Cerrados" value={kpis.closed} icon={CheckCircle2} color="text-emerald-500" />
        <KPICard label="Inhabilitados" value={kpis.disabled} icon={TrendingDown} color="text-red-500" />
        <KPICard label="Días prom. cierre" value={kpis.avgDays} icon={TrendingUp} color="text-violet-500" suffix="días" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="app-panel">
        {tab === "resumen" && (
          <div className="p-4 space-y-4">
            {/* Por estado — barras horizontales */}
            <div>
              <h3 className="text-[13px] font-semibold mb-3">Distribución por Estado</h3>
              <div className="space-y-2">
                {byStatus.map((s) => (
                  <div key={s.code} className="flex items-center gap-3">
                    <span className="w-24 text-[11px] font-medium shrink-0">{s.label}</span>
                    <div className="flex-1 h-6 rounded-md bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all flex items-center justify-end px-2"
                        style={{ width: `${Math.max(s.pct, 3)}%`, backgroundColor: s.color }}
                      >
                        <span className="text-[10px] font-bold text-white">{s.count}</span>
                      </div>
                    </div>
                    <span className="w-10 text-[11px] text-muted-foreground text-right shrink-0">{s.pct}%</span>
                  </div>
                ))}
                {byStatus.length === 0 && (
                  <p className="text-[12px] text-muted-foreground text-center py-4">Sin datos</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "responsables" && (
          <div className="p-4">
            {/* Sub-tabs de rol — todos del mismo ancho */}
            <div className="flex gap-1.5 mb-4">
              {(Object.keys(ROLE_CONFIG) as RoleSubTab[]).map((r) => (
                <button
                  key={r}
                  onClick={() => { setRoleSubTab(r); rolePagination.setPage(1); }}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors text-center ${
                    roleSubTab === r
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                  }`}
                >
                  {ROLE_CONFIG[r].label}
                </button>
              ))}
            </div>
            <h3 className="text-[13px] font-semibold mb-3">Productividad por {ROLE_CONFIG[roleSubTab].label}</h3>
            <div className="app-grid-toolbar">
              <div className="app-grid-toolbar-left">
              </div>
              <Pagination
                variant="controls"
                page={rolePagination.page}
                totalPages={rolePagination.totalPages}
                total={rolePagination.total}
                pageSize={rolePagination.pageSize}
                onPageChange={rolePagination.setPage}
                onPageSizeChange={rolePagination.setPageSize}
              />
            </div>
            <div className="app-data-table-wrap">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th className="text-left">{ROLE_CONFIG[roleSubTab].label}</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Abiertos</th>
                    <th className="text-right">Cerrados</th>
                    <th className="text-right">% Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {rolePagination.paginatedData.map((a) => (
                    <tr key={a.name}>
                      <td className="font-medium">{a.name}</td>
                      <td className="text-right">{a.total}</td>
                      <td className="text-right text-amber-600">{a.open}</td>
                      <td className="text-right text-emerald-600">{a.closed}</td>
                      <td className="text-right font-semibold">
                        {a.total > 0 ? Math.round((a.closed / a.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  {byRole.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={rolePagination.page}
              totalPages={rolePagination.totalPages}
              total={rolePagination.total}
              pageSize={rolePagination.pageSize}
              onPageChange={rolePagination.setPage}
              onPageSizeChange={rolePagination.setPageSize}
            />
          </div>
        )}

        {tab === "companias" && (
          <div className="p-4">
            <h3 className="text-[13px] font-semibold mb-3">Siniestros por Compañía</h3>
            <div className="app-grid-toolbar">
              <div className="app-grid-toolbar-left">
              </div>
              <Pagination
                variant="controls"
                page={companyPagination.page}
                totalPages={companyPagination.totalPages}
                total={companyPagination.total}
                pageSize={companyPagination.pageSize}
                onPageChange={companyPagination.setPage}
                onPageSizeChange={companyPagination.setPageSize}
              />
            </div>
            <div className="app-data-table-wrap">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th className="text-left">Compañía</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Abiertos</th>
                    <th className="text-right">Cerrados</th>
                    <th className="text-right">% Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {companyPagination.paginatedData.map((c) => (
                    <tr key={c.name}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-right">{c.total}</td>
                      <td className="text-right text-amber-600">{c.open}</td>
                      <td className="text-right text-emerald-600">{c.closed}</td>
                      <td className="text-right font-semibold">
                        {c.total > 0 ? Math.round((c.closed / c.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  {byCompany.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={companyPagination.page}
              totalPages={companyPagination.totalPages}
              total={companyPagination.total}
              pageSize={companyPagination.pageSize}
              onPageChange={companyPagination.setPage}
              onPageSizeChange={companyPagination.setPageSize}
            />
          </div>
        )}

        {tab === "inspecciones" && (
          <div className="p-4 space-y-4">
            <h3 className="text-[13px] font-semibold">Métricas de Inspecciones</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KPICard label="Total" value={inspectionStats.total} icon={ClipboardCheck} color="text-blue-500" />
              <KPICard label="Completadas" value={inspectionStats.completed} icon={CheckCircle2} color="text-emerald-500" />
              <KPICard label="Activas" value={inspectionStats.active} icon={TrendingUp} color="text-amber-500" />
              <KPICard label="Agendadas" value={inspectionStats.scheduled} icon={Calendar} color="text-violet-500" />
              <KPICard label="Canceladas" value={inspectionStats.cancelled} icon={TrendingDown} color="text-red-500" />
            </div>
          </div>
        )}

        {tab === "siniestros" && (
          <div className="p-4">
            <h3 className="text-[13px] font-semibold mb-3">
              Detalle ({filteredClaims.length} siniestros)
            </h3>
            <div className="app-grid-toolbar">
              <div className="app-grid-toolbar-left">
              </div>
              <Pagination
                variant="controls"
                page={claimsPagination.page}
                totalPages={claimsPagination.totalPages}
                total={claimsPagination.total}
                pageSize={claimsPagination.pageSize}
                onPageChange={claimsPagination.setPage}
                onPageSizeChange={claimsPagination.setPageSize}
              />
            </div>
            <div className="app-data-table-wrap">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <th className="text-left">N° Liquidación</th>
                    <th className="text-left">N° Siniestro</th>
                    <th className="text-left">Compañía</th>
                    <th className="text-left">Liquidador</th>
                    <th className="text-left">Inspector</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Creación</th>
                  </tr>
                </thead>
                <tbody>
                  {claimsPagination.paginatedData.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono text-[11px]">{c.liquidation_number || "—"}</td>
                      <td className="font-mono text-[11px]">{c.claim_number || "—"}</td>
                      <td>{c.insurance_company?.name || "—"}</td>
                      <td>{c.adjuster?.full_name || "—"}</td>
                      <td>{c.inspector?.full_name || "—"}</td>
                      <td>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${STATUS_COLORS[c.status?.code || ""] || "#6b7280"}20`,
                            color: STATUS_COLORS[c.status?.code || ""] || "#6b7280",
                          }}
                        >
                          {STATUS_LABELS[c.status?.code || ""] || c.status?.code || "—"}
                        </span>
                      </td>
                      <td className="text-[11px] text-muted-foreground">{c.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                  {filteredClaims.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-4">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={claimsPagination.page}
              totalPages={claimsPagination.totalPages}
              total={claimsPagination.total}
              pageSize={claimsPagination.pageSize}
              onPageChange={claimsPagination.setPage}
              onPageSizeChange={claimsPagination.setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string;
  value: number;
  icon: typeof BarChart3;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="app-panel p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${color}`} />
      </div>
      <div className="mt-1 text-xl font-bold">
        {value}
        {suffix && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
