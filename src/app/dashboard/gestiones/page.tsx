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
  FileText,
  Search,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyGestiones, type MyGestion, type GestionFilter } from "@/services/my-gestiones";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";

const FILTER_CONFIG: Record<
  GestionFilter,
  { label: string; icon: typeof ListTodo; title: string }
> = {
  all: { label: "Todas", icon: ListTodo, title: "Mis Gestiones" },
  "in-progress": { label: "En curso", icon: ListTodo, title: "Gestiones en Curso" },
  reviews: { label: "Revisiones", icon: Eye, title: "Gestiones en Revisión" },
  approvals: { label: "Aprobación", icon: CheckCircle, title: "Gestiones por Aprobar" },
  alert: { label: "En alarma", icon: AlertTriangle, title: "Gestiones en Alarma" },
  overdue: { label: "Atrasadas", icon: Clock, title: "Gestiones Atrasadas" },
};

const PAGE_SIZE = 20;

function GestionesContent() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  // Leer filtro desde query param
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

  const filtered = (Array.isArray(gestiones) ? gestiones : []).filter((g) => {
    if (!search) return true;
    const text = [g.name, g.code, g.claim_number, g.liquidation_number, g.client_reference, g.insured_name]
      .join(" ")
      .toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const { page, totalPages, paginatedData, total, pageSize, setPage, setPageSize } = usePagination(
    filtered as MyGestion[],
    PAGE_SIZE
  );

  const config = FILTER_CONFIG[validFilter];
  const Icon = config.icon;

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-sky-500 text-white shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="app-page-title">{config.title}</h1>
              <p className="app-page-lead">Gestiones asignadas a ti, en flujo activo.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de filtro rápido */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(FILTER_CONFIG) as GestionFilter[]).map((key) => {
          const cfg = FILTER_CONFIG[key];
          const TabIcon = cfg.icon;
          const isActive = validFilter === key;
          return (
            <Link
              key={key}
              href={`/dashboard/gestiones?filter=${key}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
              }`}
            >
              <TabIcon className="size-3.5" />
              {cfg.label}
            </Link>
          );
        })}
      </div>

      <div className="app-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[200px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gestión, siniestro, asegurado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="liquid-search"
            />
          </div>
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="min-w-[180px] sm:w-[220px]">Gestión</th>
              <th className="min-w-[100px] sm:w-[120px]">Siniestro</th>
              <th className="min-w-[120px] sm:w-[160px]">Asegurado</th>
              <th className="min-w-[90px] sm:w-[110px]">Estado</th>
              <th className="min-w-[90px] sm:w-[120px]">Vencimiento</th>
              <th className="min-w-[80px] sm:w-[100px] text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  Cargando...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay gestiones {validFilter === "all" ? "asignadas" : `con filtro "${config.label.toLowerCase()}"`}.
                </td>
              </tr>
            ) : (
              paginatedData.map((g) => (
                <GestionRow key={g.id} gestion={g} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GestionRow({ gestion: g }: { gestion: MyGestion }) {
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
    g.action_status_code === "todo"
      ? isOverdue
        ? "text-red-500"
        : isAlert
          ? "text-amber-500"
          : "text-muted-foreground"
      : "text-sky-500";

  return (
    <tr>
      <td>
        <div className="font-medium truncate max-w-[220px]">{g.name}</div>
        {g.code && <div className="text-[10px] text-muted-foreground">{g.code}</div>}
      </td>
      <td>
        <Link
          href={`/dashboard/claims/${g.claim_id}`}
          className="text-primary hover:underline font-medium"
        >
          {g.liquidation_number || g.claim_number || g.client_reference || "Ver siniestro"}
        </Link>
      </td>
      <td className="text-muted-foreground truncate max-w-[160px]">{g.insured_name || "—"}</td>
      <td>
        <span className={`font-medium ${statusColor}`}>
          {g.action_status_name || "—"}
        </span>
      </td>
      <td>
        {g.expected_date ? (
          <span className={isOverdue ? "text-red-500 font-medium" : isAlert ? "text-amber-500 font-medium" : ""}>
            {new Date(g.expected_date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="text-right">
        <Link
          href={`/dashboard/claims/${g.claim_id}/gestiones/${g.id}`}
          className="liquid-button-outline inline-flex items-center justify-center h-7 px-3 text-[10px]"
        >
          <FileText className="size-3 mr-1" />
          Abrir
        </Link>
      </td>
    </tr>
  );
}

export default function GestionesPage() {
  return (
    <Suspense fallback={<div className="app-page"><div className="app-page-header"><h1 className="app-page-title">Mis Gestiones</h1></div></div>}>
      <GestionesContent />
    </Suspense>
  );
}
