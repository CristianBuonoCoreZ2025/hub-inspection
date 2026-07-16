"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  getInspectionSessions,
  updateInspectionSession,
} from "@/services/inspections";
import { getUsers } from "@/services/users";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  MapPin,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

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
  const searchParams = useSearchParams();
  const { canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const s = searchParams.get("status");
    return s && ["all", "scheduled", "active", "completed", "cancelled"].includes(s) ? s : "all";
  });

  const { data: sessions, isLoading, error: sessionsError } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });
  const inspectors = users?.filter((u) => u.role === "inspector") || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
      updateInspectionSession(id, input),
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = sessions?.filter((s) => {
    const insuredName = s.claim?.claims_participants?.[0]?.full_name;
    const matchesSearch =
      [s.claim?.claim_number, insuredName, s.claim?.claim_address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      sessionStatusLabels[s.status]?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(filtered);

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Inspecciones</h1>
        <p className="app-page-lead">
          Gestiona las sesiones de inspeccion en terreno asociadas a los siniestros.
        </p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <div className="relative max-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar inspeccion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="liquid-search"
            />
          </div>
          <Select value={statusFilter || "__none"} onValueChange={(v) => setStatusFilter(v === "__none" ? "" : v ?? "all")} items={[{ value: "__none", label: "Sin selección" }, { value: "all", label: "Todos los estados" }, { value: "scheduled", label: "Agendada" }, { value: "active", label: "En progreso" }, { value: "completed", label: "Completada" }, { value: "cancelled", label: "Cancelada" }]}>
            <SelectTrigger className="h-7 w-full sm:w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sin selección</SelectItem>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="active">En progreso</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="min-w-[120px] sm:w-[140px]">Inspección</th>
              <th className="min-w-[90px] sm:w-[110px]">N° Interno</th>
              <th className="min-w-[90px] sm:w-[110px]">Ref. Cliente</th>
              <th className="min-w-[100px] sm:w-[140px]">Inspector</th>
              <th className="min-w-[100px] sm:w-[160px]">Asegurado</th>
              <th>Direccion</th>
              <th className="min-w-[80px] sm:w-[90px]">Estado</th>
              <th className="min-w-[90px] sm:w-[130px]">Programada</th>
              <th className="min-w-[90px] sm:w-[160px] text-right">Acciones</th>
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
            ) : filtered?.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No hay inspecciones registradas.
                </td>
              </tr>
            ) : (
              paginatedData.map((session) => (
                <tr key={session.id} className="hover:bg-muted/40 transition-colors">
                  <td>
                    <div className="flex flex-col gap-0">
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        {session.inspection_number || session.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.inspection_type === "remote" ? "Remota" : "Presencial"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-[11px] font-medium">
                      {session.claim?.liquidation_number || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="text-[11px] text-muted-foreground">
                      {session.claim?.client_reference || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px]">
                        {inspectors.find((i) => i.id === session.claim?.inspector_id)?.full_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="text-[11px]">
                      {session.claim?.claims_participants?.[0]?.full_name || "—"}
                    </span>
                  </td>
                  <td>
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
                  <td>
                    <div className="flex items-center gap-1 text-[11px]">
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
                    <div className="app-row-actions">
                      <Button
                        className="pg-btn-platinum"
                        onClick={() => router.push(`/dashboard/inspecciones/${session.id}`)}
                      >
                        Ver
                      </Button>

                      {canEdit("inspecciones") && session.status === "scheduled" && (
                        <>
                          <Button
                            className="pg-btn-platinum"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "active" },
                              })
                            }
                          >
                            Iniciar
                          </Button>
                          <Button
                            className="pg-btn-platinum"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "cancelled" },
                              })
                            }
                          >
                            Cancelar
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
  );
}
