"use client";

import { useState, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  ClipboardCheck,
  Send,
  ShieldCheck,
  Search,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyClaims, ROLE_TITLE, type MyClaim, type ClaimRole } from "@/services/my-claims";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";

const ROLE_ICONS: Record<ClaimRole, typeof FileText> = {
  liquidador: FileText,
  inspector: ClipboardCheck,
  despachador: Send,
  auditor: ShieldCheck,
};

const VALID_ROLES: ClaimRole[] = ["liquidador", "inspector", "despachador", "auditor"];

const PAGE_SIZE = 20;

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

  const filtered = useMemo(() => {
    const arr = Array.isArray(claims) ? claims : [];
    if (!search) return arr;
    const q = search.toLowerCase();
    return arr.filter((c) =>
      [c.claim_number, c.liquidation_number, c.client_reference, c.internal_number, c.insured_name, c.insured_address, c.insurance_company_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [claims, search]);

  const { page, totalPages, paginatedData, total, pageSize, setPage, setPageSize } = usePagination(
    filtered as MyClaim[],
    PAGE_SIZE
  );

  const title = ROLE_TITLE[validRole];
  const Icon = ROLE_ICONS[validRole];

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-sky-500 text-white shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="app-page-title">{title}</h1>
              <p className="app-page-lead">Siniestros asignados a ti, en flujo activo (no cerrados).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de rol */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VALID_ROLES.map((r) => {
          const TabIcon = ROLE_ICONS[r];
          const isActive = validRole === r;
          return (
            <Link
              key={r}
              href={`/dashboard/mis-casos?role=${r}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
              }`}
            >
              <TabIcon className="size-3.5" />
              {ROLE_TITLE[r].replace("Mis ", "").replace("Mi ", "")}
            </Link>
          );
        })}
      </div>

      <div className="app-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[240px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar siniestro, asegurado, compañía..."
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
              <th className="min-w-[100px] sm:w-[120px]">Liquidación</th>
              <th className="min-w-[100px] sm:w-[120px]">Siniestro</th>
              <th className="min-w-[120px] sm:w-[180px]">Asegurado</th>
              <th className="min-w-[100px] sm:w-[140px]">Dirección</th>
              <th className="min-w-[80px] sm:w-[120px]">Compañía</th>
              <th className="min-w-[80px] sm:w-[100px]">Estado</th>
              <th className="min-w-[80px] sm:w-[100px]">Fecha</th>
              <th className="min-w-[80px] sm:w-[100px] text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-8">
                  Cargando...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-8">
                  No hay siniestros asignados como {ROLE_TITLE[validRole].replace("Mis ", "").replace("Mi ", "").toLowerCase()}.
                </td>
              </tr>
            ) : (
              paginatedData.map((c) => <ClaimRow key={c.id} claim={c} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimRow({ claim: c }: { claim: MyClaim }) {
  const statusColor =
    c.status_code === "adjustment"
      ? "text-sky-500"
      : c.status_code === "dispatchment"
        ? "text-violet-500"
        : c.status_code === "created"
          ? "text-amber-500"
          : "text-muted-foreground";

  return (
    <tr>
      <td className="font-medium">{c.liquidation_number || "—"}</td>
      <td>
        <Link
          href={`/dashboard/claims/${c.id}`}
          className="text-primary hover:underline font-medium"
        >
          {c.claim_number || c.client_reference || c.internal_number || "Ver"}
        </Link>
      </td>
      <td className="truncate max-w-[180px]">{c.insured_name || "—"}</td>
      <td className="text-muted-foreground truncate max-w-[140px]">
        {c.insured_address ? `${c.insured_address}${c.insured_city ? ", " + c.insured_city : ""}` : "—"}
      </td>
      <td className="text-muted-foreground truncate max-w-[120px]">{c.insurance_company_name || "—"}</td>
      <td>
        <span className={`font-medium ${statusColor}`}>{c.status_name || "—"}</span>
      </td>
      <td className="text-muted-foreground">
        {c.claim_date
          ? new Date(c.claim_date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
          : "—"}
      </td>
      <td className="text-right">
        <Link
          href={`/dashboard/claims/${c.id}`}
          className="liquid-button-outline inline-flex items-center justify-center h-7 px-3 text-[10px]"
        >
          <FileText className="size-3 mr-1" />
          Abrir
        </Link>
      </td>
    </tr>
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
