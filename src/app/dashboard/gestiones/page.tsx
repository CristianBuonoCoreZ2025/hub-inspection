"use client";

import { useState, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ListTodo,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  ArrowRight,
  Calendar,
  User,
  Activity,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyGestiones, type MyGestion, type GestionFilter } from "@/services/my-gestiones";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";

const FILTER_CONFIG: Record<
  GestionFilter,
  { label: string; icon: typeof ListTodo; title: string; gradient: string; glow: string }
> = {
  all: { label: "Todas", icon: ListTodo, title: "Mis Gestiones", gradient: "from-slate-500 to-zinc-600", glow: "rgba(100, 116, 139, 0.08)" },
  "in-progress": { label: "En curso", icon: ListTodo, title: "Gestiones en Curso", gradient: "from-sky-500 to-blue-600", glow: "rgba(14, 165, 233, 0.08)" },
  reviews: { label: "Revisiones", icon: Eye, title: "Gestiones en Revisión", gradient: "from-violet-500 to-purple-600", glow: "rgba(139, 92, 246, 0.08)" },
  approvals: { label: "Aprobación", icon: CheckCircle, title: "Gestiones por Aprobar", gradient: "from-emerald-500 to-teal-600", glow: "rgba(16, 185, 129, 0.08)" },
  alert: { label: "En alarma", icon: AlertTriangle, title: "Gestiones en Alarma", gradient: "from-amber-500 to-orange-600", glow: "rgba(245, 158, 11, 0.08)" },
  overdue: { label: "Atrasadas", icon: Clock, title: "Gestiones Atrasadas", gradient: "from-red-500 to-rose-600", glow: "rgba(239, 68, 68, 0.08)" },
};

const PAGE_SIZE = 12;

function GestionesContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const filterParam = (searchParams.get("filter") as GestionFilter) || "all";
  const validFilter: GestionFilter = ["all", "in-progress", "reviews", "approvals", "alert", "overdue"].includes(filterParam)
    ? filterParam
    : "all";

  const { data: gestiones, isLoading } = useQuery({
    queryKey: ["my-gestiones", profile?.id, validFilter],
    queryFn: () => getMyGestiones(profile, validFilter),
    enabled: !!profile,
    staleTime: 30000,
  });

  const allGestiones = useMemo(() => (Array.isArray(gestiones) ? gestiones : []), [gestiones]);

  const filtered = useMemo(() => {
    if (!search) return allGestiones;
    const q = search.toLowerCase();
    return allGestiones.filter((g) =>
      [g.name, g.code, g.claim_number, g.liquidation_number, g.client_reference, g.insured_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [allGestiones, search]);

  const { page, totalPages, paginatedData, total, pageSize, setPage, setPageSize } = usePagination(
    filtered as MyGestion[],
    PAGE_SIZE
  );

  const config = FILTER_CONFIG[validFilter];
  const Icon = config.icon;

  // KPIs rápidos del filtro actual
  const kpis = useMemo(() => {
    const withDate = allGestiones.filter((g) => g.expected_date).length;
    const withoutDate = allGestiones.length - withDate;
    return { total: allGestiones.length, withDate, withoutDate };
  }, [allGestiones]);

  return (
    <div className="app-page">
      {/* ── Header ── */}
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className={`app-grid-icon bg-linear-to-br ${config.gradient}`}>
            <Icon />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">{config.title}</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          <div className="dash-section-count">{kpis.total} gestiones</div>
        </div>
      </div>

      {/* ── Tabs de filtro — Liquid Glass ── */}
      <div className="my-casos-tabs">
        {(Object.keys(FILTER_CONFIG) as GestionFilter[]).map((key) => {
          const cfg = FILTER_CONFIG[key];
          const TabIcon = cfg.icon;
          const isActive = validFilter === key;
          return (
            <Link
              key={key}
              href={`/dashboard/gestiones?filter=${key}`}
              className={`my-casos-tab ${isActive ? "my-casos-tab-active" : ""}`}
            >
              <div className={`my-casos-tab-icon ${isActive ? `bg-linear-to-br ${cfg.gradient}` : ""}`}>
                <TabIcon className="h-4 w-4" />
              </div>
              <span>{cfg.label}</span>
              {isActive && <div className="my-casos-tab-glow" style={{ ["--tab-glow" as string]: cfg.glow }} />}
            </Link>
          );
        })}
      </div>

      {/* ── KPI Cards ── */}
      <div className="dash-grid" style={{ marginTop: 12 }}>
        <div className="kpi-card dash-col-4" style={{ ["--kpi-glow" as string]: config.glow }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon" style={{ background: `linear-gradient(135deg, ${config.glow.replace("0.08", "0.9")}, ${config.glow.replace("0.08", "1")})` }}>
              <Activity className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-label mt-1">Total gestiones</div>
        </div>

        <div className="kpi-card dash-col-4" style={{ ["--kpi-glow" as string]: "rgba(245, 158, 11, 0.08)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 1))" }}>
              <Calendar className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="kpi-value">{kpis.withDate}</div>
          <div className="kpi-label mt-1">Con fecha límite</div>
        </div>

        <div className="kpi-card dash-col-4" style={{ ["--kpi-glow" as string]: "rgba(100, 116, 139, 0.08)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon" style={{ background: "linear-gradient(135deg, rgba(100, 116, 139, 0.9), rgba(71, 85, 105, 1))" }}>
              <Clock className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="kpi-value">{kpis.withoutDate}</div>
          <div className="kpi-label mt-1">Sin fecha</div>
        </div>
      </div>

      {/* ── Buscador + Cards ── */}
      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar por gestión, siniestro, asegurado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liquid-search"
              />
            </div>
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

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            <div className="inline-flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              Cargando...
            </div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No hay gestiones {validFilter === "all" ? "asignadas" : `con filtro "${config.label.toLowerCase()}"`}.
          </div>
        ) : (
          <div className="my-casos-grid">
            {paginatedData.map((g) => (
              <GestionCard key={g.id} gestion={g} />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}

function GestionCard({ gestion: g }: { gestion: MyGestion }) {
  const { isOverdue, isAlert } = useMemo(() => {
    if (!g.expected_date) return { isOverdue: false, isAlert: false };
    const now = new Date().getTime();
    const expected = new Date(g.expected_date).getTime();
    const daysUntilDue = (expected - now) / 86400000;
    return {
      isOverdue: daysUntilDue < 0,
      isAlert: daysUntilDue >= 0 && daysUntilDue <= 3,
    };
  }, [g.expected_date]);

  const statusColor =
    isOverdue
      ? "text-red-400"
      : isAlert
        ? "text-amber-400"
        : g.action_status_code === "todo"
          ? "text-sky-400"
          : g.action_status_code === "issued"
            ? "text-violet-400"
            : g.action_status_code === "reviewed"
              ? "text-emerald-400"
              : "text-muted-foreground";

  const statusBg =
    isOverdue
      ? "bg-red-500/10 border-red-500/20"
      : isAlert
        ? "bg-amber-500/10 border-amber-500/20"
        : g.action_status_code === "todo"
          ? "bg-sky-500/10 border-sky-500/20"
          : g.action_status_code === "issued"
            ? "bg-violet-500/10 border-violet-500/20"
            : g.action_status_code === "reviewed"
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-muted/30 border-border";

  return (
    <Link href={`/dashboard/claims/${g.claim_id}/gestiones/${g.id}`} className="my-casos-card group">
      {/* Top: status badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Gestión</span>
          <span className="text-sm font-bold truncate">{g.name}</span>
          {g.code && <span className="text-[10px] text-muted-foreground">{g.code}</span>}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBg} ${statusColor} whitespace-nowrap`}>
          {g.action_status_name || "—"}
        </span>
      </div>

      {/* Claim link */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Siniestro</span>
          <span className="text-[13px] font-medium text-primary truncate">
            {g.liquidation_number || g.claim_number || g.client_reference || "Ver siniestro"}
          </span>
        </div>
      </div>

      {/* Insured */}
      {g.insured_name && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <User className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{g.insured_name}</span>
        </div>
      )}

      {/* Bottom: date + arrow */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          {g.expected_date ? (
            <>
              <Calendar className={`h-3 w-3 ${isOverdue ? "text-red-400" : isAlert ? "text-amber-400" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium ${isOverdue ? "text-red-400" : isAlert ? "text-amber-400" : "text-muted-foreground"}`}>
                {new Date(g.expected_date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
              {isOverdue && <span className="text-[9px] text-red-400 font-bold uppercase">Vencida</span>}
              {isAlert && <span className="text-[9px] text-amber-400 font-bold uppercase">Alerta</span>}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">Sin fecha</span>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function GestionesPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page">
          <div className="app-page-header">
            <h1 className="app-page-title">Mis Gestiones</h1>
          </div>
        </div>
      }
    >
      <GestionesContent />
    </Suspense>
  );
}
