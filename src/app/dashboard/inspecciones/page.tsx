"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
  getInspectionSessions,
  updateInspectionSession,
  canAccessInspectionSession,
  type SessionClaim,
  type SessionWithRelations,
} from "@/services/inspections";
import { getUsers } from "@/services/users";
import { formatUserDateTime as formatDateTime } from "@/lib/timezone";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  MapPin,
  User,
  ClipboardCheck,
  Eye,
  EyeOff,
  Play,
  Ban,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InspectionSession } from "@/types";

const sessionStatusLabels: Record<string, string> = {
  scheduled: "Agendada",
  active: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export default function InspectionsPage() {
  return (
    <Suspense fallback={<div className="app-page"><p className="text-muted-foreground py-20 text-center">Cargando...</p></div>}>
      <InspectionsPageContent />
    </Suspense>
  );
}

function InspectionsPageContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { canEdit, canView } = usePermissions();
  const { profile, dataAccess } = useAuth();
  useRealtime("inspection_sessions", [["inspection-sessions"], ["inspection-sessions-all"]]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [inspectorFilter, setInspectorFilter] = useState<string[]>([]);
  const [internalNumberFilter, setInternalNumberFilter] = useState("");

  const { data: sessions, isLoading, error: sessionsError } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
      updateInspectionSession(id, input),
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resolveInspectorName = useCallback((inspectorId?: string | null) =>
    users?.find((u) => u.id === inspectorId)?.full_name || "",
    [users]
  );

  const isUserAssignedToClaim = useCallback((claim: SessionClaim | null | undefined) => {
    if (!claim || !profile?.id) return false;
    if (dataAccess?.is_admin || dataAccess?.see_all_client_claims) return true;
    const assigneeIds = [
      claim.assigned_adjuster_id,
      claim.adjuster_id,
      claim.inspector_id,
      claim.auditor_id,
      claim.dispatcher_id,
      claim.assistant_id,
    ];
    return assigneeIds.some((id) => id === profile.id);
  }, [profile, dataAccess]);

  const canOpenClaim = (claim: SessionClaim | null | undefined) =>
    canView("claims") && isUserAssignedToClaim(claim);

  const canOpenSession = (session: SessionWithRelations) =>
    canAccessInspectionSession(session, profile, dataAccess);

  const inspectorOptions = useMemo(() => {
    const ids = new Set<string>();
    sessions?.forEach((s) => {
      const inspectorId = s.inspector_id || s.claim?.inspector_id;
      if (inspectorId) ids.add(inspectorId);
    });
    const activeInspectors = Array.from(ids).map((id) => {
      const user = users?.find((u) => u.id === id);
      return { value: id, label: user?.full_name || user?.email || id };
    });
    return activeInspectors;
  }, [sessions, users]);

  const accessors = useMemo(
    () => ({
      internal_number: (s: { claim?: { liquidation_number?: string | null } | null }) => {
        const match = (s.claim?.liquidation_number || "").match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      },
      inspection: (s: { inspection_number?: string | null }) => {
        const match = (s.inspection_number || "").match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      },
      client_reference: (s: { claim?: { client_reference?: string | null } | null }) => s.claim?.client_reference || "",
      inspector: (s: { inspector_id?: string | null; claim?: { inspector_id?: string | null } | null }) => resolveInspectorName(s.inspector_id || s.claim?.inspector_id),
      insured: (s: { claim?: { claims_participants?: { full_name?: string }[] } | null }) => s.claim?.claims_participants?.[0]?.full_name || "",
      address: (s: { claim?: { claim_address?: string | null } | null }) => s.claim?.claim_address || "",
      status: (s: { status: string }) => s.status,
      scheduled: (s: { scheduled_at?: string | null }) => (s.scheduled_at ? new Date(s.scheduled_at).getTime() : 0),
    }),
    [resolveInspectorName]
  );

  const filtered = useMemo(
    () =>
      sessions?.filter((s) => {
        const insuredName = s.claim?.claims_participants?.[0]?.full_name;
        const matchesSearch =
          [s.claim?.claim_number, insuredName, s.claim?.claim_address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          sessionStatusLabels[s.status]?.toLowerCase().includes(search.toLowerCase()) ||
          s.claim?.liquidation_number?.toLowerCase().includes(search.toLowerCase()) ||
          s.inspection_number?.toLowerCase().includes(search.toLowerCase())
        const matchesStatus = statusFilter.length === 0 || statusFilter.includes(s.status);
        const matchesInspector =
          inspectorFilter.length === 0 ||
          inspectorFilter.includes(s.inspector_id || s.claim?.inspector_id || "");
        const filterDigits = internalNumberFilter.replace(/\D/g, "");
        const matchesInternal =
          filterDigits === "" ||
          (s.claim?.liquidation_number || "").replace(/\D/g, "").includes(filterDigits)
        return matchesSearch && matchesStatus && matchesInspector && matchesInternal;
      }) ?? [],
    [sessions, search, statusFilter, inspectorFilter, internalNumberFilter]
  );

  const { sorted: sortedSessions, sortKey, sortDir, toggleSort } = useTableSort(filtered, accessors, null);

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sortedSessions);

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-amber-500 to-orange-500">
            <ClipboardCheck />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Inspecciones</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
        </div>
      </div>

      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar inspeccion..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liquid-search"
              />
            </div>
            <Tooltip>
              <TooltipTrigger className="w-full">
                <Input
                  placeholder="N° interno..."
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={internalNumberFilter}
                  onChange={(e) => setInternalNumberFilter(e.target.value.replace(/\D/g, ""))}
                  className="app-input app-filter-narrow"
                />
              </TooltipTrigger>
              <TooltipContent>Solo la parte numérica</TooltipContent>
            </Tooltip>
            <Select
              multiple
              value={statusFilter}
              onValueChange={(v: string[]) => setStatusFilter(v ?? [])}
              items={[
                { value: "scheduled", label: "Agendada" },
                { value: "active", label: "En progreso" },
                { value: "completed", label: "Completada" },
                { value: "cancelled", label: "Cancelada" },
              ]}
            >
              <SelectTrigger className="app-input app-filter-narrow">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="active">En progreso</SelectItem>
                <SelectItem value="completed">Completada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select
              multiple
              value={inspectorFilter}
              onValueChange={(v: string[]) => setInspectorFilter(v ?? [])}
              items={inspectorOptions}
            >
              <SelectTrigger className="app-input app-filter-narrow">
                <SelectValue placeholder="Todos los inspectores" />
              </SelectTrigger>
              <SelectContent>
                {inspectorOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <SortableTh sortKey="internal_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-22.5 sm:w-27.5 hidden lg:table-cell">N° Interno</SortableTh>
                <SortableTh sortKey="inspection" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-30 sm:w-35">Inspección</SortableTh>
                <SortableTh sortKey="client_reference" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-22.5 sm:w-27.5 hidden sm:table-cell">Ref. Cliente</SortableTh>
                <SortableTh sortKey="inspector" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-25 sm:w-35 hidden lg:table-cell">Inspector</SortableTh>
                <SortableTh sortKey="insured" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-25 sm:w-40">Asegurado</SortableTh>
                <SortableTh sortKey="address" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-60 sm:w-80 hidden lg:table-cell">Direccion</SortableTh>
                <SortableTh sortKey="status" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-20 sm:w-22.5">Estado</SortableTh>
                <SortableTh sortKey="scheduled" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-32 hidden sm:table-cell">Programada</SortableTh>
                <th className="min-w-22.5 sm:w-40 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    Cargando inspecciones...
                  </td>
                </tr>
              ) : sessionsError ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-destructive">
                    Error al cargar inspecciones: {sessionsError.message}
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No hay inspecciones registradas.
                  </td>
                </tr>
              ) : (
                paginatedData.map((session) => (
                  <tr
                    key={session.id}
                    className={canOpenSession(session) ? "row-clickable" : ""}
                    onClick={canOpenSession(session) ? () => router.push(`/dashboard/inspecciones/${session.id}`) : undefined}
                  >
                    <td className="whitespace-nowrap hidden lg:table-cell">
                      <span className="font-mono text-[11px] font-medium">
                        {session.claim?.liquidation_number ? (
                          canOpenClaim(session.claim) ? (
                            <Link href={`/dashboard/claims/${session.claim_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                              {session.claim.liquidation_number}
                            </Link>
                          ) : (
                            <span>{session.claim.liquidation_number}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {canOpenSession(session) ? (
                          <Link
                            href={`/dashboard/inspecciones/${session.id}`}
                            className="font-mono text-[11px] font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {session.claim_action?.code
                              ? session.claim_action.code.split("-").slice(-2).join("-")
                              : session.inspection_number || session.id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {session.claim_action?.code
                              ? session.claim_action.code.split("-").slice(-2).join("-")
                              : session.inspection_number || session.id.slice(0, 8)}
                          </span>
                        )}
                        <StatusBadge
                          tone={session.inspection_type === "remote" ? "sky" : "emerald"}
                          label={session.inspection_type === "remote" ? "Remota" : "Presencial"}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap hidden sm:table-cell">
                      <span className="text-[11px] text-muted-foreground">
                        {session.claim?.client_reference || "—"}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[11px]">
                          {resolveInspectorName(session.inspector_id || session.claim?.inspector_id) || "—"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px]">
                        {session.claim?.claims_participants?.[0]?.full_name || "—"}
                      </span>
                    </td>
                    <td className="max-w-60 sm:max-w-80 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[11px] truncate">
                          {session.claim?.claim_address || "—"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        tone={session.status === "active" ? "zinc" : undefined}
                        status={session.status}
                        label={sessionStatusLabels[session.status] || session.status}
                      />
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                        {session.scheduled_at ? (
                          <>
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDateTime(session.scheduled_at)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin programar</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="app-row-actions" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="btn-icon-sm"
                          title={
                            canOpenSession(session)
                              ? "Ver"
                              : "No se puede acceder: la inspección está en curso y siendo realizada por otro inspector"
                          }
                          disabled={!canOpenSession(session)}
                          onClick={() => canOpenSession(session) && router.push(`/dashboard/inspecciones/${session.id}`)}
                        >
                          {canOpenSession(session) ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-amber-500" />
                          )}
                        </Button>
                        {canEdit("inspecciones") && session.status === "scheduled" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="btn-icon-sm"
                              title="Iniciar"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: session.id,
                                  input: { status: "active" },
                                })
                              }
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="btn-icon-sm"
                              title="Cancelar"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: session.id,
                                  input: { status: "cancelled" },
                                })
                              }
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
}
