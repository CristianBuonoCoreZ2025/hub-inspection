"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClosedClaims, getReopenedClaims, reopenClaim } from "@/services/claims";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { LockOpen, Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReabrirPage() {
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Siniestros cerrados (para reabrir)
  const { data: closedClaims, isLoading } = useQuery({
    queryKey: ["claims", "closed-for-reopen"],
    queryFn: () => getClosedClaims(),
  });

  // Siniestros reabiertos (sección 2)
  const { data: reopenedClaims } = useQuery({
    queryKey: ["claims", "reopened"],
    queryFn: () => getReopenedClaims(),
  });

  const reopenMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reopenClaim(id, reason, user?.id),
    onSuccess: () => {
      toast.success("Siniestro reabierto");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["claims", "reopened"] });
      queryClient.invalidateQueries({ queryKey: ["claims", "closed-for-reopen"] });
      setSelectedClaimId(null);
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filtrar por búsqueda
  const filtered = (closedClaims || []).filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.claim_number?.toLowerCase().includes(term) ||
      c.liquidation_number?.toLowerCase().includes(term) ||
      c.internal_number?.toLowerCase().includes(term) ||
      c.client_reference?.toLowerCase().includes(term)
    );
  });

  const selectedClaim = filtered.find((c) => c.id === selectedClaimId);

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title flex items-center gap-2">
          <LockOpen className="h-5 w-5" />
          Reabrir Siniestros
        </h1>
        <p className="app-page-lead">
          Operación especial: reabre un siniestro cerrado. El caso vuelve al estado Reapertura (equivalente a Liquidación) y permite trabajar nuevamente.
        </p>
      </div>

      {/* Sección 1: Buscar siniestro cerrado */}
      <div className="app-panel">
        <h2 className="app-section-title mb-4">
          Buscar Siniestro Cerrado
        </h2>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por N° siniestro, liquidación, referencia..."
              className="app-input h-9 w-full pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? "No se encontraron siniestros." : "No hay siniestros cerrados."}
          </p>
        ) : (
          <div className="overflow-auto max-h-[300px] border rounded-lg">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>N° Siniestro</th>
                  <th>Liquidación</th>
                  <th>Ref. Cliente</th>
                  <th>Fecha Cierre</th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((claim) => (
                  <tr
                    key={claim.id}
                    className={`cursor-pointer ${selectedClaimId === claim.id ? "bg-purple-500/5" : ""}`}
                    onClick={() => setSelectedClaimId(claim.id)}
                  >
                    <td className="text-[11px] font-mono">{claim.claim_number || "—"}</td>
                    <td className="text-[11px]">{claim.liquidation_number || "—"}</td>
                    <td className="text-[11px]">{claim.client_reference || "—"}</td>
                    <td className="text-[11px]">
                      {claim.updated_at ? new Date(claim.updated_at).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td>
                      {selectedClaimId === claim.id && (
                        <LockOpen className="h-4 w-4 text-purple-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulario de reapertura */}
        {selectedClaim && (
          <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium">Reabrir siniestro {selectedClaim.claim_number}</p>
                <p className="text-[11px] text-muted-foreground">
                  El siniestro volverá al estado Reapertura (equivalente a Liquidación). Podrá modificar datos, generar inspecciones y gestiones. Para cerrarlo nuevamente, deberá cargar una gestión de cierre.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="app-field-label text-[11px]">Causal de reapertura *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique el motivo (ej: impugnación aceptada, error en cierre, solicitud de compañía...)"
                  className="app-input w-full min-h-[60px] text-[13px]"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-cancel btn-sm"
                  onClick={() => { setSelectedClaimId(null); setReason(""); }}
                >
                  Cancelar
                </Button>
                {canEdit("operaciones") && (
                  <Button
                    size="sm"
                    className="btn-save btn-sm"
                    disabled={!reason.trim() || reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate({ id: selectedClaim.id, reason: reason.trim() })}
                  >
                    <LockOpen className="mr-1.5 h-3.5 w-3.5" />
                    {reopenMutation.isPending ? "Reabriendo..." : "Reabrir"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sección 2: Siniestros reabiertos recientemente */}
      <div className="app-panel">
        <h2 className="app-section-title mb-4">
          Siniestros Reabiertos Recientemente
        </h2>
        {(reopenedClaims || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay siniestros reabiertos.
          </p>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>N° Siniestro</th>
                  <th>Liquidación</th>
                  <th>Causal</th>
                  <th>Fecha Reapertura</th>
                </tr>
              </thead>
              <tbody>
                {(reopenedClaims || []).map((claim) => (
                    <tr key={claim.id}>
                      <td className="text-[11px] font-mono">{claim.claim_number || "—"}</td>
                      <td className="text-[11px]">{claim.liquidation_number || "—"}</td>
                      <td className="text-[11px] max-w-[300px] truncate text-muted-foreground">
                        {claim.reopened_reason || "—"}
                      </td>
                      <td className="text-[11px]">
                        {claim.reopened_at ? new Date(claim.reopened_at).toLocaleDateString("es-CL") : "—"}
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
