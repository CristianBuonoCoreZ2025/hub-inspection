"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getClaims, getDisabledClaims, disableClaim, enableClaim } from "@/services/claims";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Ban, Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InhabilitarPage() {
 const { user } = useAuth();
 const { canEdit, canDelete } = usePermissions();
 const queryClient = useQueryClient();
 const [searchTerm, setSearchTerm] = useState("");
 const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
 const [reason, setReason] = useState("");

 // Siniestros activos (para buscar y inhabilitar)
 const { data: activeClaims, isLoading: loadingActive } = useQuery({
 queryKey: ["claims", "active-for-disable"],
 queryFn: () => getClaims(),
 });

 // Siniestros inhabilitados (para reactivar)
 const { data: disabledClaims, isLoading: loadingDisabled } = useQuery({
 queryKey: ["claims", "disabled"],
 queryFn: () => getDisabledClaims(),
 });

 const disableMutation = useMutation({
 mutationFn: ({ id, reason }: { id: string; reason: string }) =>
 disableClaim(id, reason, user?.id),
 onSuccess: () => {
 toast.success("Siniestro inhabilitado");
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 setSelectedClaimId(null);
 setReason("");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const enableMutation = useMutation({
 mutationFn: (id: string) => enableClaim(id, user?.id),
 onSuccess: () => {
 toast.success("Siniestro reactivado");
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 // Filtrar por búsqueda (número siniestro, liquidación, nombre)
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
 <div className="app-grid-icon bg-linear-to-br from-rose-500 to-red-500">
 <Ban />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Inhabilitar Siniestros</h1>
 </div>
 </div>
 </div>

 {/* Sección 1: Buscar y inhabilitar */}
 <div className="app-panel">
 <h2 className="app-section-title mb-4">
 Buscar Siniestro Activo
 </h2>

 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input placeholder="Buscar por N° siniestro, liquidación, referencia..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="liquid-search" />
 </div>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
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
 className={`row-clickable ${selectedClaimId === claim.id ? "bg-rose-500/5" : ""}`}
 onClick={() => setSelectedClaimId(claim.id)}
 >
 <td className="text-[11px] font-mono">{claim.claim_number || "—"}</td>
 <td className="text-[11px]">{claim.liquidation_number || "—"}</td>
 <td className="text-[11px]">{claim.client_reference || "—"}</td>
 <td className="text-[11px]">{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
 <td>
 {selectedClaimId === claim.id && (
 <Ban className="h-4 w-4 text-rose-500" />
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

 {/* Formulario de inhabilitación */}
 {selectedClaim && (
 <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
 <div className="flex items-start gap-2 mb-3">
 <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
 <div>
 <p className="text-[13px] font-medium">Inhabilitar siniestro {selectedClaim.claim_number}</p>
 <p className="text-[11px] text-muted-foreground">
 El siniestro quedará fuera de la lista normal. Esta acción es reversible.
 </p>
 </div>
 </div>
 <div className="space-y-3">
 <div>
 <label className="app-field-label text-[11px]">Motivo de inhabilitación *</label>
 <textarea
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 placeholder="Explique el motivo (ej: siniestro duplicado, error de carga, caso especial...)"
 className="app-input w-full min-h-[60px] text-[13px]"
 rows={2}
 />
 </div>
 <div className="flex justify-end gap-2">
 <Button
 variant="outline"
 size="sm"
 className="pg-btn-platinum"
 onClick={() => { setSelectedClaimId(null); setReason(""); }}
 >
 Cancelar
 </Button>
 {canDelete("operaciones") && (
 <Button
 size="sm"
 className="pg-btn-platinum"
 disabled={!reason.trim() || disableMutation.isPending}
 onClick={() => disableMutation.mutate({ id: selectedClaim.id, reason: reason.trim() })}
 >
 {disableMutation.isPending ? "Inhabilitando..." : "Inhabilitar"}
 </Button>
 )}
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Sección 2: Siniestros inhabilitados (reactivar) */}
 <div className="app-panel">
 <h2 className="app-section-title mb-4">
 Siniestros Inhabilitados
 </h2>

 {loadingDisabled ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 </div>
 ) : (disabledClaims || []).length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-8">
 No hay siniestros inhabilitados.
 </p>
 ) : (
 <div className="overflow-auto border rounded-lg">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>N° Siniestro</th>
 <th>Liquidación</th>
 <th>Motivo</th>
 <th>Fecha</th>
 <th className="w-[80px]">Acción</th>
 </tr>
 </thead>
 <tbody>
 {(disabledClaims || []).map((claim) => (
 <tr key={claim.id}>
 <td className="text-[11px] font-mono">{claim.claim_number || "—"}</td>
 <td className="text-[11px]">{claim.liquidation_number || "—"}</td>
 <td className="text-[11px] max-w-[300px] truncate text-muted-foreground">
 {claim.disabled_reason || "—"}
 </td>
 <td className="text-[11px]">
 {claim.disabled_at ? new Date(claim.disabled_at).toLocaleDateString("es-CL") : "—"}
 </td>
 <td>
 {canEdit("operaciones") && (
 <Button
 variant="ghost"
 size="sm"
 className="pg-btn-platinum h-7 px-2 text-xs"
 disabled={enableMutation.isPending}
 onClick={() => {
 if (confirm("¿Reactivar este siniestro?")) enableMutation.mutate(claim.id);
 }}
 >
 Reactivar
 </Button>
 )}
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
