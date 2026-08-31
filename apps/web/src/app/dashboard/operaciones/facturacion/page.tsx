"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBillingBatches,
  getBillingBatch,
  getBillingBatchItems,
  generateBillingBatch,
  updateBillingItem,
  sendBatchForReview,
  approveBatch,
  countPendingBilling,
} from "@/services/billing";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Receipt,
  Loader2,
  ArrowLeft,
  FileSpreadsheet,
  Check,
  Send,
  Plus,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BillingBatch, BillingBatchItem } from "@/types";

const statusLabels: Record<BillingBatch["status"], string> = {
  pendiente_revision: "Pendiente",
  enviada_revision: "Enviada",
  aprobada: "Aprobada",
};

const statusBadgeClass: Record<BillingBatch["status"], string> = {
  pendiente_revision: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  enviada_revision: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  aprobada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default function FacturacionPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showDistribution, setShowDistribution] = useState(false);

  // ── Vista: Listado de nóminas ──
  const { data: batches, isLoading } = useQuery({
    queryKey: ["billing-batches"],
    queryFn: getBillingBatches,
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["billing-pending-count"],
    queryFn: () => countPendingBilling(),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBillingBatch(),
    onSuccess: (batch) => {
      toast.success("Nómina generada");
      queryClient.invalidateQueries({ queryKey: ["billing-batches"] });
      queryClient.invalidateQueries({ queryKey: ["billing-pending-count"] });
      setSelectedBatchId(batch.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Vista: Detalle de nómina ──
  const { data: batchDetail } = useQuery({
    queryKey: ["billing-batch", selectedBatchId],
    queryFn: () => getBillingBatch(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["billing-batch-items", selectedBatchId],
    queryFn: () => getBillingBatchItems(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, include }: { id: string; include: boolean }) =>
      updateBillingItem(id, include),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-batch-items", selectedBatchId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendBatchForReview(id),
    onSuccess: () => {
      toast.success("Nómina enviada para revisión");
      queryClient.invalidateQueries({ queryKey: ["billing-batch", selectedBatchId] });
      queryClient.invalidateQueries({ queryKey: ["billing-batches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveBatch(id, profile?.email || "sistema"),
    onSuccess: () => {
      toast.success("Nómina aprobada — inspecciones marcadas como cobradas");
      queryClient.invalidateQueries({ queryKey: ["billing-batch", selectedBatchId] });
      queryClient.invalidateQueries({ queryKey: ["billing-batches"] });
      queryClient.invalidateQueries({ queryKey: ["billing-pending-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Exportar Excel ──
  const exportExcel = (itemsToExport: BillingBatchItem[], batchName: string) => {
    const headers = [
      "N° Liquidación",
      "Código",
      "Ref. Cliente",
      "Inspector",
      "Asegurado",
      "Fecha Inspección",
      "Tipo",
    ];
    const data = [
      headers,
      ...itemsToExport
        .filter((i) => i.include_for_billing)
        .map((i) => [
          i.liquidation_number || "",
          i.inspection_number || "",
          i.client_reference || "",
          i.inspector_name || "",
          i.insured_name || "",
          i.inspection_date ? new Date(i.inspection_date).toLocaleDateString("es-CL") : "",
          i.inspection_type === "remote" ? "Remota" : "Presencial",
        ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación");
    XLSX.writeFile(workbook, `${batchName.replace(/\s+/g, "_")}.xlsx`);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Detalle de nómina
  // ═══════════════════════════════════════════════════════════════
  if (selectedBatchId && batchDetail) {
    const batch = batchDetail;
    const allItems = items || [];
    const isPending = batch.status === "pendiente_revision";
    const isSent = batch.status === "enviada_revision";
    const isApproved = batch.status === "aprobada";
    const canToggle = isPending || isSent;
    // En enviada_revision: solo mostrar las marcadas para cobrar
    // En pendiente y aprobada: mostrar todas
    const batchItems = isSent ? allItems.filter((i) => i.include_for_billing) : allItems;
    const includedCount = allItems.filter((i) => i.include_for_billing).length;

    // Distribución de casos por inspector (solo los marcados para cobrar)
    const distribution = allItems
      .filter((i) => i.include_for_billing)
      .reduce((acc, i) => {
        const name = i.inspector_name || "Sin inspector";
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    const distributionRows = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

    return (
      <div className="app-page">
        <div className="app-grid-header">
          <div className="app-grid-header-left">
            <button
              onClick={() => setSelectedBatchId(null)}
              className="app-grid-icon icn-purple hover:opacity-70 transition-opacity"
              aria-label="Volver"
            >
              <ArrowLeft />
            </button>
            <div className="app-grid-title-row">
              <h1 className="app-page-title shrink-0">{batch.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[batch.status]}`}>
                {statusLabels[batch.status]}
              </span>
            </div>
          </div>
          <div className="app-grid-header-right">
            {isPending && (
              <Button
                onClick={() => exportExcel(batchItems, batch.name)}
                disabled={includedCount === 0}
                className="pg-btn-platinum"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Exportar
              </Button>
            )}
            {isPending && (
              <Button
                onClick={() => sendMutation.mutate(batch.id)}
                disabled={sendMutation.isPending || includedCount === 0}
                className="pg-btn-platinum"
              >
                {sendMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Emitir</>
                )}
              </Button>
            )}
            {isSent && (
              <Button
                onClick={() => approveMutation.mutate(batch.id)}
                disabled={approveMutation.isPending || includedCount === 0}
                className="pg-btn-platinum"
              >
                {approveMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aprobando...</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Aprobar</>
                )}
              </Button>
            )}
            {isApproved && (
              <Button
                onClick={() => exportExcel(batchItems, batch.name)}
                className="pg-btn-platinum"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Exportar
              </Button>
            )}
            <Button
              onClick={() => setShowDistribution(true)}
              disabled={includedCount === 0}
              className="pg-btn-platinum"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Distribución
            </Button>
            <Dialog open={showDistribution} onOpenChange={setShowDistribution}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Distribución por inspector</DialogTitle>
                </DialogHeader>
                <div className="app-data-table-wrap">
                  <table className="app-data-table">
                    <thead>
                      <tr>
                        <th className="min-w-40">Inspector</th>
                        <th className="min-w-20 text-center">Casos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributionRows.map(([name, count]) => (
                        <tr key={name}>
                          <td className="whitespace-nowrap">{name}</td>
                          <td className="text-center font-semibold">{count}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border">
                        <td className="whitespace-nowrap font-bold">Total</td>
                        <td className="text-center font-bold">{includedCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Resumen compacto */}
        <div className="app-panel">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="app-data-label">Total</span>
              <span className="app-title text-foreground">{allItems.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="app-data-label">Para cobrar</span>
              <span className="app-title text-green-600 dark:text-green-400">{includedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="app-data-label">{isSent ? "No autorizadas" : "Excluidas"}</span>
              <span className="app-title text-muted-foreground">{allItems.length - includedCount}</span>
            </div>
            {batch.sent_at && (
              <div className="flex items-center gap-2">
                <span className="app-data-label">Enviada</span>
                <span className="app-body text-foreground">{new Date(batch.sent_at).toLocaleDateString("es-CL")}</span>
              </div>
            )}
            {batch.approved_at && (
              <div className="flex items-center gap-2">
                <span className="app-data-label">Aprobada</span>
                <span className="app-body text-foreground">{new Date(batch.approved_at).toLocaleDateString("es-CL")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Grilla de items */}
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="min-w-28 sm:w-32">Liquidación</th>
                <th className="min-w-24 sm:w-28">Código</th>
                <th className="min-w-24 sm:w-28 hidden sm:table-cell">Ref. Cliente</th>
                <th className="min-w-24 sm:w-32 hidden lg:table-cell">Inspector</th>
                <th className="min-w-28 sm:w-40">Asegurado</th>
                <th className="min-w-24 sm:w-28 hidden md:table-cell">Fecha</th>
                <th className="min-w-20 sm:w-24 hidden lg:table-cell">Tipo</th>
                {canToggle && <th className="min-w-16 text-center">Cobrar</th>}
                {isApproved && <th className="min-w-20 text-center">Estado</th>}
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                <TableSkeleton rows={8} columns={canToggle ? 8 : 7} />
              ) : batchItems.length === 0 ? (
                <tr>
                  <td colSpan={canToggle ? 8 : 7} className="py-8 text-center text-muted-foreground">
                    {isSent ? "No hay inspecciones para cobrar en esta nómina." : "No hay inspecciones en esta nómina."}
                  </td>
                </tr>
              ) : (
                batchItems.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap">{item.liquidation_number || "—"}</td>
                    <td className="whitespace-nowrap">{item.inspection_number || "—"}</td>
                    <td className="whitespace-nowrap hidden sm:table-cell">{item.client_reference || "—"}</td>
                    <td className="whitespace-nowrap hidden lg:table-cell">{item.inspector_name || "—"}</td>
                    <td className="whitespace-nowrap">{item.insured_name || "—"}</td>
                    <td className="whitespace-nowrap hidden md:table-cell">
                      {item.inspection_date ? new Date(item.inspection_date).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td className="whitespace-nowrap hidden lg:table-cell">
                      {item.inspection_type === "remote" ? "Remota" : "Presencial"}
                    </td>
                    {canToggle && (
                      <td className="text-center">
                        <ToggleChip
                          active={item.include_for_billing}
                          onClick={(v) =>
                            toggleMutation.mutate({
                              id: item.id,
                              include: v,
                            })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          Cobrar
                        </ToggleChip>
                      </td>
                    )}
                    {isApproved && (
                      <td className="text-center">
                        {item.billed ? (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">Cobrada</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Excluida</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Listado de nóminas
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-purple">
            <Receipt />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Facturación</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          {pendingCount !== undefined && pendingCount > 0 && (
            <span className="app-body text-muted-foreground mr-2">
              {pendingCount} pendientes
            </span>
          )}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || (pendingCount ?? 0) === 0}
            className="pg-btn-platinum"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> Generar</>
            )}
          </Button>
        </div>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="min-w-40 sm:w-48">Nombre</th>
              <th className="min-w-20 sm:w-24">Estado</th>
              <th className="min-w-20 sm:w-24 text-right">Inspec.</th>
              <th className="min-w-24 sm:w-28 hidden sm:table-cell">Generada</th>
              <th className="min-w-24 sm:w-28 hidden md:table-cell">Enviada</th>
              <th className="min-w-24 sm:w-28 hidden lg:table-cell">Aprobada</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : (batches || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  No hay nóminas generadas. Haz clic en &quot;Generar&quot; para crear la primera.
                </td>
              </tr>
            ) : (
              (batches || []).map((batch) => (
                <tr
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  className="row-clickable"
                >
                  <td className="whitespace-nowrap font-medium">{batch.name}</td>
                  <td className="whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[batch.status]}`}>
                      {statusLabels[batch.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right">{batch.item_count}</td>
                  <td className="whitespace-nowrap hidden sm:table-cell">
                    {new Date(batch.generated_at).toLocaleDateString("es-CL")}
                  </td>
                  <td className="whitespace-nowrap hidden md:table-cell">
                    {batch.sent_at ? new Date(batch.sent_at).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="whitespace-nowrap hidden lg:table-cell">
                    {batch.approved_at ? new Date(batch.approved_at).toLocaleDateString("es-CL") : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
