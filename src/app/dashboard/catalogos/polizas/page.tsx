"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  getPolicies,
  getPolicyRelations,
  getInsuranceCompaniesWithPolicies,
  getBrokersWithPolicies,
  getBusinessLinesWithPolicies,
} from "@/services/policies";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, FileCheck, Pencil } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  expired: "Vencida",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

const typeLabels: Record<string, string> = {
  individual: "Individual",
  collective: "Colectiva",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function PolizasPage() {
  const router = useRouter();
  const { canCreate } = usePermissions();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [insuranceCompanyFilter, setInsuranceCompanyFilter] = useState("");
  const [brokerFilter, setBrokerFilter] = useState("");
  const [businessLineFilter, setBusinessLineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Fetch policies con todos los filtros
  const { data: policies, isLoading } = useQuery({
    queryKey: ["policies", profile?.company_id, insuranceCompanyFilter, brokerFilter, businessLineFilter, statusFilter],
    queryFn: () => getPolicies({
      companyId: profile?.company_id || undefined,
      insuranceCompanyId: insuranceCompanyFilter || undefined,
      brokerId: brokerFilter || undefined,
      businessLineId: businessLineFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  // Filtros dinámicos: compañías, corredores y líneas que tienen pólizas
  const { data: insuranceCompanies } = useQuery({
    queryKey: ["insurance-companies-with-policies", profile?.company_id],
    queryFn: () => getInsuranceCompaniesWithPolicies(profile?.company_id || undefined),
  });

  const { data: brokers } = useQuery({
    queryKey: ["brokers-with-policies", profile?.company_id],
    queryFn: () => getBrokersWithPolicies(profile?.company_id || undefined),
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines-with-policies", profile?.company_id],
    queryFn: () => getBusinessLinesWithPolicies(profile?.company_id || undefined),
  });

  // Mapear pólizas con nombres resueltos
  const policyList = useMemo(() => policies || [], [policies]);
  const { data: relations } = useQuery({
    queryKey: ["policy-relations", policyList.map((p) => p.id).join(",")],
    queryFn: () =>
      getPolicyRelations({
        insuranceCompanyIds: [...new Set(policyList.map((p) => p.insurance_company_id).filter(Boolean))] as string[],
        brokerIds: [...new Set(policyList.map((p) => p.broker_id).filter(Boolean))] as string[],
        businessLineIds: [...new Set(policyList.map((p) => p.business_line_id).filter(Boolean))] as string[],
      }),
    enabled: policyList.length > 0,
  });

  // Mapear pólizas con nombres resueltos
  const policiesWithNames = useMemo(() => {
    return policyList.map((p) => ({
      ...p,
      insurance_company: p.insurance_company_id ? relations?.insuranceCompanies[p.insurance_company_id] : null,
      broker: p.broker_id ? relations?.brokers[p.broker_id] : null,
      business_line: p.business_line_id ? relations?.businessLines[p.business_line_id] : null,
    }));
  }, [policyList, relations]);

  const filtered = policiesWithNames.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (p.policy_number || "").toLowerCase().includes(term) ||
      p.policy_name.toLowerCase().includes(term) ||
      (p.insurance_company?.name || "").toLowerCase().includes(term) ||
      (p.broker?.name || "").toLowerCase().includes(term)
    );
  });

  const { page, pageSize, paginatedData, setPage, totalPages, total } = usePagination(filtered, 15);

  const hasActiveFilters = search || insuranceCompanyFilter || brokerFilter || businessLineFilter || statusFilter;

  function clearFilters() {
    setSearch("");
    setInsuranceCompanyFilter("");
    setBrokerFilter("");
    setBusinessLineFilter("");
    setStatusFilter("");
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="app-page-title">Pólizas</h1>
              <p className="app-page-lead">Gestión de pólizas por compañía de seguros</p>
            </div>
          </div>
          {canCreate("claims") && (
            <Button
              size="sm"
              className="liquid-button"
              onClick={() => router.push("/dashboard/catalogos/polizas/nueva")}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </Button>
          )}
        </div>
      </div>

      <div className="app-toolbar">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="liquid-search"
              placeholder="Buscar por número, nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={insuranceCompanyFilter || "__all"} onValueChange={(v) => setInsuranceCompanyFilter(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todas las compañías" }, ...(insuranceCompanies || []).map(c => ({ value: c.id, label: `${c.name} (${c.policy_count})` }))]}>
            <SelectTrigger className="app-input max-w-[200px]">
              <SelectValue placeholder="Todas las compañías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas las compañías</SelectItem>
              {(insuranceCompanies || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.policy_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brokerFilter || "__all"} onValueChange={(v) => setBrokerFilter(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todos los corredores" }, ...(brokers || []).map(b => ({ value: b.id, label: `${b.name} (${b.policy_count})` }))]}>
            <SelectTrigger className="app-input max-w-[180px]">
              <SelectValue placeholder="Todos los corredores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos los corredores</SelectItem>
              {(brokers || []).map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name} ({b.policy_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={businessLineFilter || "__all"} onValueChange={(v) => setBusinessLineFilter(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todas las líneas" }, ...(businessLines || []).map(b => ({ value: b.id, label: `${b.name} (${b.policy_count})` }))]}>
            <SelectTrigger className="app-input max-w-[180px]">
              <SelectValue placeholder="Todas las líneas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas las líneas</SelectItem>
              {(businessLines || []).map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name} ({b.policy_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "__all"} onValueChange={(v) => setStatusFilter(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todos los estados" }, { value: "active", label: "Activas" }, { value: "draft", label: "Borrador" }, { value: "expired", label: "Vencidas" }, { value: "cancelled", label: "Canceladas" }]}>
            <SelectTrigger className="app-input max-w-[140px]">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos los estados</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="expired">Vencidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[12px] text-muted-foreground hover:text-foreground px-2"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="app-panel p-0 overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Cargando...</p>
        ) : paginatedData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {hasActiveFilters ? "No se encontraron pólizas con los filtros seleccionados." : "No hay pólizas registradas."}
          </p>
        ) : (
          <table className="app-data-table">
            <thead>
              <tr>
                <th>N° Póliza</th>
                <th>Nombre</th>
                <th>Compañía</th>
                <th>Corredor</th>
                <th>Tipo</th>
                <th>Línea</th>
                <th className="text-right">Asegurado</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/dashboard/catalogos/polizas/${p.id}`)}
                >
                  <td className="font-mono font-medium">
                    {p.policy_number || <span className="text-muted-foreground italic">Sin número</span>}
                  </td>
                  <td>{p.policy_name}</td>
                  <td className="text-muted-foreground">{p.insurance_company?.name || "—"}</td>
                  <td className="text-muted-foreground">{p.broker?.name || "—"}</td>
                  <td>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[p.policy_type] || p.policy_type}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">{p.business_line?.name || "—"}</td>
                  <td className="text-right font-mono">
                    {formatMoney(p.insured_amount)}
                    {p.currency && p.insured_amount != null && (
                      <span className="text-[10px] text-muted-foreground ml-1">{p.currency}</span>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    {formatDate(p.start_date)} — {formatDate(p.end_date)}
                  </td>
                  <td>
                    <Badge className={statusColors[p.status] || ""}>
                      {statusLabels[p.status] || p.status}
                    </Badge>
                  </td>
                  <td>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 0 && (
          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {total} póliza{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
            </p>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
