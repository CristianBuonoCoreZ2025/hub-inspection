"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
  getCompletedInspectionSessionsForReopen,
  getReopenedInspectionSessions,
  reopenInspectionSession,
} from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { LockOpen, Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ReabrirInspeccionesPage() {
  const { profile } = useAuth();
  const { canEdit } = usePermissions();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Inspecciones completadas (para reabrir)
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions", "completed-for-reopen"],
    queryFn: () => getCompletedInspectionSessionsForReopen(),
  });

  // Inspecciones reabiertas recientemente (sección 2)
  const { data: reopenedSessions } = useQuery({
    queryKey: ["inspection-sessions", "reopened"],
    queryFn: () => getReopenedInspectionSessions(),
  });

  const reopenMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reopenInspectionSession(id, reason, profile?.id),
    onSuccess: () => {
      toast.success("Inspección reabierta");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", "completed-for-reopen"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", "reopened"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-work-periods"] });
      setSelectedSessionId(null);
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (sessions || []).filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.inspection_number || "").toLowerCase().includes(term) ||
      (s.claim?.claim_number || "").toLowerCase().includes(term) ||
      (s.claim?.liquidation_number || "").toLowerCase().includes(term) ||
      (s.claim?.client_reference || "").toLowerCase().includes(term) ||
      (s.inspector?.full_name || "").toLowerCase().includes(term)
    );
  });

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    inspection_number: (s) => s.inspection_number,
    liquidation_number: (s) => s.claim?.liquidation_number || "",
    client_reference: (s) => s.claim?.client_reference || "",
    inspector: (s) => s.inspector?.full_name || "",
    ended_at: (s) => s.ended_at || "",
  }, "ended_at");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const selectedSession = filtered.find((s) => s.id === selectedSessionId);

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-purple">
            <LockOpen />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Reabrir Inspecciones</h1>
          </div>
        </div>
      </div>

      {/* Sección 1: Buscar inspección completada */}
      <div className="app-panel">
        <h2 className="app-section-title mb-4">Inspecciones Completadas</h2>

        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar por inspección, siniestro, liquidación, referencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? "No se encontraron inspecciones." : "No hay inspecciones completadas."}
          </p>
        ) : (
          <>
            <div className="app-data-table-wrap max-h-75">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <SortableTh sortKey="inspection_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>N° Inspección</SortableTh>
                    <SortableTh sortKey="liquidation_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Liquidación</SortableTh>
                    <SortableTh sortKey="client_reference" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Ref. Cliente</SortableTh>
                    <SortableTh sortKey="inspector" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Inspector</SortableTh>
                    <SortableTh sortKey="ended_at" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Fecha Cierre</SortableTh>
                    <th className="w-15"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((session) => (
                    <tr
                      key={session.id}
                      className={`row-clickable ${selectedSessionId === session.id ? "bg-purple-500/5" : ""}`}
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setReason("");
                      }}
                    >
                      <td className="text-[11px] font-mono">{session.inspection_number || "—"}</td>
                      <td className="text-[11px]">{session.claim?.liquidation_number || "—"}</td>
                      <td className="text-[11px]">{session.claim?.client_reference || "—"}</td>
                      <td className="text-[11px]">{session.inspector?.full_name || "—"}</td>
                      <td className="text-[11px]">
                        {session.ended_at
                          ? new Date(session.ended_at).toLocaleDateString("es-CL")
                          : "—"}
                      </td>
                      <td>
                        {selectedSessionId === session.id && (
                          <LockOpen className="h-4 w-4 text-purple-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}

        {/* Formulario de reapertura */}
        {selectedSession && (
          <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium">Reabrir inspección {selectedSession.inspection_number}</p>
                <p className="text-[11px] text-muted-foreground">
                  La inspección volverá a estado Activa para que el inspector pueda hacer cambios.
                  La gestión asociada deja de estar emitida. Al completarla nuevamente, la gestión
                  se emitirá otra vez. La acción queda registrada en el log de auditoría.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="app-field-label text-[11px]">Causal de reapertura *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique el motivo (ej: error en el acta, evidencia faltante, solicitud de compañía...)"
                  className="app-input w-full min-h-12.5 sm:min-h-15 text-[13px]"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="pg-btn-platinum"
                  onClick={() => { setSelectedSessionId(null); setReason(""); }}
                >
                  Cancelar
                </Button>
                {canEdit("operaciones") && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum"
                    disabled={!reason.trim() || reopenMutation.isPending}
                    onClick={() =>
                      reopenMutation.mutate({
                        id: selectedSession.id,
                        reason: reason.trim(),
                      })
                    }
                  >
                    {reopenMutation.isPending ? "Reabriendo..." : "Reabrir"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sección 2: Inspecciones reabiertas recientemente */}
      <div className="app-panel">
        <h2 className="app-section-title mb-4">Inspecciones Reabiertas Recientemente</h2>
        {(reopenedSessions || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay inspecciones reabiertas.
          </p>
        ) : (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>N° Inspección</th>
                  <th>Liquidación</th>
                  <th>Inspector</th>
                  <th>Estado Actual</th>
                  <th>Causal</th>
                  <th>Fecha Reapertura</th>
                </tr>
              </thead>
              <tbody>
                {(reopenedSessions || []).map((session) => (
                  <tr key={session.id}>
                    <td className="text-[11px] font-mono">
                      <Link
                        href={`/dashboard/inspecciones/${session.id}`}
                        className="text-primary hover:underline"
                      >
                        {session.inspection_number || "—"}
                      </Link>
                    </td>
                    <td className="text-[11px]">{session.claim?.liquidation_number || "—"}</td>
                    <td className="text-[11px]">{session.inspector?.full_name || "—"}</td>
                    <td className="text-[11px]">
                      {session.status === "active" ? "Activa" : session.status === "completed" ? "Completada" : session.status}
                    </td>
                    <td className="text-[11px] max-w-75 truncate text-muted-foreground">
                      {session.reopened_reason || "—"}
                    </td>
                    <td className="text-[11px]">
                      {session.reopened_at
                        ? new Date(session.reopened_at).toLocaleDateString("es-CL")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
