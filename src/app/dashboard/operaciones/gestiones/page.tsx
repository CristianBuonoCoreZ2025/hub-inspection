"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getClaims } from "@/services/claims";
import { getClaimActions, rejectClaimAction, hardDeleteClaimAction } from "@/services/claim-actions";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Loader2, AlertTriangle, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function GestionesPage() {
  const { user } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: activeClaims, isLoading: loadingActive } = useQuery({
    queryKey: ["claims", "active-for-actions"],
    queryFn: () => getClaims(),
  });

  const { data: actions, isLoading: loadingActions } = useQuery({
    queryKey: ["claim-actions", selectedClaimId],
    queryFn: () => getClaimActions(selectedClaimId!, false),
    enabled: !!selectedClaimId,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectClaimAction(id, "issue", user?.id, reason),
    onSuccess: () => {
      toast.success("Acción rechazada");
      queryClient.invalidateQueries({ queryKey: ["claim-actions", selectedClaimId] });
      setRejectReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hardDeleteClaimAction(id),
    onSuccess: () => {
      toast.success("Acción eliminada");
      queryClient.invalidateQueries({ queryKey: ["claim-actions", selectedClaimId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredActive = (activeClaims || []).filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.claim_number?.toLowerCase().includes(term) ||
      c.liquidation_number?.toLowerCase().includes(term) ||
      c.internal_number?.toLowerCase().includes(term) ||
      c.client_reference?.toLowerCase().includes(term)
    );
  });

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filteredActive, {
    claim_number: (c) => c.claim_number,
    liquidation_number: (c) => c.liquidation_number,
    client_reference: (c) => c.client_reference,
    claim_date: (c) => c.claim_date,
  }, "claim_number");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);
  const selectedClaim = filteredActive.find((c) => c.id === selectedClaimId);

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-amber-500 to-orange-500">
            <Ban />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Gestiones en curso</h1>
          </div>
        </div>
      </div>

      <div className="app-panel">
        <h2 className="app-section-title mb-4">Buscar siniestro</h2>

        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar por N° siniestro, liquidación, referencia..."
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

        {loadingActive ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredActive.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? "No se encontraron siniestros." : "No hay siniestros activos."}
          </p>
        ) : (
          <>
            <div className="app-data-table-wrap max-h-[300px]">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <SortableTh sortKey="claim_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>N° Siniestro</SortableTh>
                    <SortableTh sortKey="liquidation_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Liquidación</SortableTh>
                    <SortableTh sortKey="client_reference" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Ref. Cliente</SortableTh>
                    <SortableTh sortKey="claim_date" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Fecha</SortableTh>
                    <th className="w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((claim) => (
                    <tr
                      key={claim.id}
                      className={`row-clickable ${selectedClaimId === claim.id ? "bg-amber-500/5" : ""}`}
                      onClick={() => { setSelectedClaimId(claim.id); setRejectReason(""); }}
                    >
                      <td className="text-[11px] font-mono">{claim.claim_number || "—"}</td>
                      <td className="text-[11px]">
                        {claim.liquidation_number ? (
                          <Link href={`/dashboard/claims/${claim.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {claim.liquidation_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-[11px]">{claim.client_reference || "—"}</td>
                      <td className="text-[11px]">{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
                      <td>
                        {selectedClaimId === claim.id && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}

        {selectedClaim && (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium">Gestiones abiertas de {selectedClaim.claim_number}</p>
                <p className="text-[11px] text-muted-foreground">
                  Acá podés rechazar o eliminar acciones que estén en curso. Rechazar las deja registradas como rechazadas; eliminar las borra físicamente.
                </p>
              </div>
            </div>

            {loadingActions ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : actions?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay gestiones abiertas para este siniestro.</p>
            ) : (
              <div className="overflow-auto border rounded-lg mb-4">
                <table className="app-data-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th className="w-[180px]">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions?.map((action) => (
                      <tr key={action.id}>
                        <td className="text-[11px] font-mono">{action.code}</td>
                        <td className="text-[11px]">{action.name}</td>
                        <td className="text-[11px]">{action.action_status?.name || "—"}</td>
                        <td className="text-[11px]">{action.origin === "M" ? "Manual" : "Automática"}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {canEdit("operaciones_gestiones") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={rejectMutation.isPending && rejectMutation.variables?.id === action.id}
                                onClick={() => {
                                  const reason = rejectReason.trim() || "Rechazo operacional";
                                  rejectMutation.mutate({ id: action.id, reason });
                                }}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Rechazar
                              </Button>
                            )}
                            {canDelete("operaciones_gestiones") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                                disabled={deleteMutation.isPending && deleteMutation.variables === action.id}
                                onClick={() => {
                                  if (confirm(`¿Eliminar permanentemente la gestión ${action.code}?`)) {
                                    deleteMutation.mutate(action.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <label className="app-field-label text-[11px]">Motivo de rechazo (opcional; se usa para todas las que se rechacen)</label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: duplicada, creada por error, workflow incorrecto..."
                className="h-8"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
