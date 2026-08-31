"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getPendingInspectionSessionsForReassign, reassignInspectionSession } from "@/services/inspections";
import { getUsersByRoleForCompany } from "@/services/users";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Users, Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReasignarInspeccionesPage() {
  const { profile } = useAuth();
  const { canEdit } = usePermissions();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newInspectorId, setNewInspectorId] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions", "pending-reassign"],
    queryFn: () => getPendingInspectionSessionsForReassign(),
  });

  const selectedSession = (sessions || []).find((s) => s.id === selectedSessionId);

  const { data: inspectors } = useQuery({
    queryKey: ["inspectors", "for-reassign", selectedSession?.company_id],
    queryFn: () => getUsersByRoleForCompany("inspector", selectedSession?.company_id),
    enabled: !!selectedSession,
  });

  const reassignMutation = useMutation({
    mutationFn: ({ id, inspectorId, reason }: { id: string; inspectorId: string; reason: string }) =>
      reassignInspectionSession(id, inspectorId, reason, profile?.id),
    onSuccess: () => {
      toast.success("Inspección reasignada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", "pending-reassign"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-max-date"] });
      setSelectedSessionId(null);
      setNewInspectorId("");
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
    inspection_date: (s) => s.inspection_date || s.scheduled_at || "",
    inspection_time: (s) => s.inspection_time || "",
  }, "inspection_date");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-amber">
            <Users />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Reasignar Inspecciones</h1>
          </div>
        </div>
      </div>

      <div className="app-panel">
        <h2 className="app-section-title mb-4">Inspecciones Agendadas</h2>

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
            {searchTerm ? "No se encontraron inspecciones." : "No hay inspecciones agendadas."}
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
                    <SortableTh sortKey="inspector" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Inspector Actual</SortableTh>
                    <SortableTh sortKey="inspection_date" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Fecha</SortableTh>
                    <SortableTh sortKey="inspection_time" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Hora</SortableTh>
                    <th className="w-15"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((session) => (
                    <tr
                      key={session.id}
                      className={`row-clickable ${selectedSessionId === session.id ? "bg-amber-500/5" : ""}`}
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setNewInspectorId("");
                        setReason("");
                      }}
                    >
                      <td className="text-[11px] font-mono">{session.inspection_number || "—"}</td>
                      <td className="text-[11px]">{session.claim?.liquidation_number || "—"}</td>
                      <td className="text-[11px]">{session.claim?.client_reference || "—"}</td>
                      <td className="text-[11px]">{session.inspector?.full_name || "—"}</td>
                      <td className="text-[11px]">
                        {session.inspection_date
                          ? new Date(session.inspection_date).toLocaleDateString("es-CL")
                          : "—"}
                      </td>
                      <td className="text-[11px]">{session.inspection_time || "—"}</td>
                      <td>
                        {selectedSessionId === session.id && (
                          <Users className="h-4 w-4 text-amber-500" />
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

        {selectedSession && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium">Reasignar inspección {selectedSession.inspection_number}</p>
                <p className="text-[11px] text-muted-foreground">
                  Se cambiará únicamente el inspector. No se modifica la hora, el tipo ni la fecha de la inspección.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="app-field-label text-[11px]">Nuevo Inspector *</label>
                <Select
                  value={newInspectorId}
                  onValueChange={(v) => setNewInspectorId(v || "")}
                >
                  <SelectTrigger className="app-input w-full">
                    <SelectValue placeholder="Seleccionar inspector..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(inspectors || []).map((inspector) => (
                      <SelectItem key={inspector.id} value={inspector.id}>
                        {inspector.full_name} {inspector.email ? `(${inspector.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="app-field-label text-[11px]">Motivo De Reasignación *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: urgencia, inspector no disponible, cambio de zona..."
                  className="app-input w-full min-h-12.5 sm:min-h-15 text-[13px]"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="pg-btn-platinum"
                  onClick={() => { setSelectedSessionId(null); setNewInspectorId(""); setReason(""); }}
                >
                  Cancelar
                </Button>
                {canEdit("operaciones") && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum"
                    disabled={!newInspectorId || !reason.trim() || reassignMutation.isPending}
                    onClick={() =>
                      reassignMutation.mutate({
                        id: selectedSession.id,
                        inspectorId: newInspectorId,
                        reason: reason.trim(),
                      })
                    }
                  >
                    {reassignMutation.isPending ? "Reasignando..." : "Reasignar"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
