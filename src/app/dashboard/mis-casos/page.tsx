"use client";

import { useState, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FilePen,
  Search,
  Navigation,
  ScrollText,
  ArrowRight,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyClaims, ROLE_TITLE, type MyClaim, type ClaimRole } from "@/services/my-claims";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";

const ROLE_ICONS: Record<ClaimRole, typeof FilePen> = {
  liquidador: FilePen,
  inspector: Search,
  despachador: Navigation,
  auditor: ScrollText,
};

const ROLE_GRADIENTS: Record<ClaimRole, string> = {
  liquidador: "from-sky-500 to-blue-600",
  inspector: "from-violet-500 to-purple-600",
  despachador: "from-emerald-500 to-teal-600",
  auditor: "from-amber-500 to-orange-600",
};

const ROLE_GLOWS: Record<ClaimRole, string> = {
  liquidador: "rgba(14, 165, 233, 0.08)",
  inspector: "rgba(139, 92, 246, 0.08)",
  despachador: "rgba(16, 185, 129, 0.08)",
  auditor: "rgba(245, 158, 11, 0.08)",
};

const VALID_ROLES: ClaimRole[] = ["liquidador", "inspector", "despachador", "auditor"];

const PAGE_SIZE = 12;

function MisCasosContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const roleParam = (searchParams.get("role") as ClaimRole) || "liquidador";
  const validRole: ClaimRole = VALID_ROLES.includes(roleParam) ? roleParam : "liquidador";

  const { data: claims, isLoading } = useQuery({
    queryKey: ["my-claims", profile?.id, validRole],
    queryFn: () => getMyClaims(profile, validRole),
    enabled: !!profile,
    staleTime: 30000,
  });

  const allClaims = useMemo(() => (Array.isArray(claims) ? claims : []), [claims]);

  const filtered = useMemo(() => {
    if (!search) return allClaims;
    const q = search.toLowerCase();
    return allClaims.filter((c) =>
      [c.claim_number, c.liquidation_number, c.client_reference, c.internal_number, c.insured_name, c.insured_address, c.insurance_company_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [allClaims, search]);

  const { page, totalPages, paginatedData, total, pageSize, setPage, setPageSize } = usePagination(
    filtered as MyClaim[],
    PAGE_SIZE
  );

  const title = ROLE_TITLE[validRole];
  const Icon = ROLE_ICONS[validRole];
  const gradient = ROLE_GRADIENTS[validRole];
  const glow = ROLE_GLOWS[validRole];

  // KPIs
  const kpis = useMemo(() => {
    const inAdjustment = allClaims.filter((c) => c.status_code === "adjustment").length;
    const inDispatch = allClaims.filter((c) => c.status_code === "dispatchment").length;
    const created = allClaims.filter((c) => c.status_code === "created").length;
    const withInspections = allClaims.filter((c) => c.inspection_active_count > 0).length;
    return { total: allClaims.length, inAdjustment, inDispatch, created, withInspections };
  }, [allClaims]);

  return (
    <div className="app-page">
      {/* ── Header premium ── */}
      <div className="dash-section-header" style={{ marginTop: 0 }}>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} text-white shadow-lg shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="app-page-title">{title}</h1>
          <p className="app-page-lead">Siniestros asignados a ti, en flujo activo.</p>
        </div>
        <div className="dash-section-line" />
        <div className="dash-section-count">{kpis.total} casos</div>
      </div>

      {/* ── Tabs de rol — Liquid Glass ── */}
      <div className="my-casos-tabs">
        {VALID_ROLES.map((r) => {
          const TabIcon = ROLE_ICONS[r];
          const isActive = validRole === r;
          const rGradient = ROLE_GRADIENTS[r];
          return (
            <Link
              key={r}
              href={`/dashboard/mis-casos?role=${r}`}
              className={`my-casos-tab ${isActive ? "my-casos-tab-active" : ""}`}
            >
              <div className={`my-casos-tab-icon ${isActive ? `bg-linear-to-br ${rGradient}` : ""}`}>
                <TabIcon className="h-4 w-4" />
              </div>
              <span>{ROLE_TITLE[r].replace("Mis ", "").replace("Mi ", "")}</span>
              {isActive && <div className="my-casos-tab-glow" style={{ ["--tab-glow" as string]: ROLE_GLOWS[r] }} />}
            </Link>
          );
        })}
      </div>

      {/* ── KPI Cards — Liquid Glass ── */}
      <div className="dash-grid" style={{ marginTop: 12 }}>
        <div className="kpi-card dash-col-3" style={{ ["--kpi-glow" as string]: glow }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-label mt-1">Total casos</div>
        </div>

        <div className="kpi-card dash-col-3" style={{ ["--kpi-glow" as string]: "rgba(14, 165, 233, 0.08)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon">
              <FilePen className="h-4 w-4" />
            </div>
          </div>
          <div className="kpi-value">{kpis.inAdjustment}</div>
          <div className="kpi-label mt-1">En liquidación</div>
        </div>

        <div className="kpi-card dash-col-3" style={{ ["--kpi-glow" as string]: "rgba(139, 92, 246, 0.08)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon">
              <Search className="h-4 w-4" />
            </div>
          </div>
          <div className="kpi-value">{kpis.withInspections}</div>
          <div className="kpi-label mt-1">Con inspecciones activas</div>
        </div>

        <div className="kpi-card dash-col-3" style={{ ["--kpi-glow" as string]: "rgba(16, 185, 129, 0.08)" }}>
          <div className="flex items-start justify-between mb-3">
            <div className="kpi-icon">
              <Navigation className="h-4 w-4" />
            </div>
          </div>
          <div className="kpi-value">{kpis.inDispatch}</div>
          <div className="kpi-label mt-1">En despacho</div>
        </div>
      </div>

      {/* ── Buscador + Tabla — Glass Panel ── */}
      <div className="glass-panel dash-col-12" style={{ marginTop: 16, ["--glass-glow" as string]: glow }}>
        <div className="glass-panel-header">
          <div className="glass-panel-title">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span>Buscar en mis casos</span>
          </div>
        </div>
        <div className="glass-panel-body">
          <div className="relative w-full mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por siniestro, asegurado, compañía, dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="liquid-search h-9"
            />
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          {/* Cards grid en vez de tabla — mas premium */}
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">
              <div className="inline-flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Cargando...
              </div>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No hay siniestros asignados como {ROLE_TITLE[validRole].replace("Mis ", "").replace("Mi ", "").toLowerCase()}.
            </div>
          ) : (
            <div className="my-casos-grid">
              {paginatedData.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClaimCard({ claim: c }: { claim: MyClaim }) {
  const statusColor =
    c.status_code === "adjustment"
      ? "text-sky-400"
      : c.status_code === "dispatchment"
        ? "text-violet-400"
        : c.status_code === "created"
          ? "text-amber-400"
          : "text-muted-foreground";

  const statusBg =
    c.status_code === "adjustment"
      ? "bg-sky-500/10 border-sky-500/20"
      : c.status_code === "dispatchment"
        ? "bg-violet-500/10 border-violet-500/20"
        : c.status_code === "created"
          ? "bg-amber-500/10 border-amber-500/20"
          : "bg-muted/30 border-border";

  return (
    <Link href={`/dashboard/claims/${c.id}`} className="my-casos-card">
      {/* Top: liquidation + status */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Liquidación</span>
          <span className="text-sm font-bold truncate">{c.liquidation_number || "—"}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBg} ${statusColor} whitespace-nowrap`}>
          {c.status_name || "—"}
        </span>
      </div>

      {/* Insured */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Asegurado</span>
          <span className="text-[13px] font-medium truncate">{c.insured_name || "—"}</span>
        </div>
      </div>

      {/* Address */}
      {c.insured_address && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">
            {c.insured_address}{c.insured_city ? `, ${c.insured_city}` : ""}
          </span>
        </div>
      )}

      {/* Bottom: company + date + arrow */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{c.insurance_company_name || "—"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.claim_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.claim_date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          )}
          {c.inspection_active_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-violet-400 font-medium">
              <Search className="h-3 w-3" />
              {c.inspection_active_count}
            </span>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}

export default function MisCasosPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page">
          <div className="app-page-header">
            <h1 className="app-page-title">Mis Casos</h1>
          </div>
        </div>
      }
    >
      <MisCasosContent />
    </Suspense>
  );
}
