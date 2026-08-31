"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionBillingBatches,
  getInspectionBillingBatch,
  getInspectionBillingBatchItems,
  generateInspectionBillingBatch,
  updateInspectionBillingItem,
  sendInspectionBatchForReview,
  approveInspectionBatch,
  countPendingInspectionBilling,
} from "@/services/inspection-billing";
import { getInspectorGroups } from "@/services/inspector-groups";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ClipboardCheck,
  Loader2,
  ArrowLeft,
  FileSpreadsheet,
  Check,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InspectionBillingBatch, InspectionBillingBatchItem } from "@/types";

const statusLabels: Record<InspectionBillingBatch["status"], string> = {
  pendiente_revision: "Pendiente",
  enviada_revision: "Enviada",
  aprobada: "Aprobada",
};

const statusBadgeClass: Record<InspectionBillingBatch["status"], string> = {
  pendiente_revision: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  enviada_revision: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  aprobada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default function FacturacionInspeccionesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // ── Agrupaciones ──
  const { data: groups } = useQuery({
    queryKey: ["inspector-groups"],
    queryFn: getInspectorGroups,
  });

  // ── Nóminas ──
  const { data: batches, isLoading } = useQuery({
    queryKey: ["inspection-billing-batches"],
    queryFn: getInspectionBillingBatches,
  });

  // ── Pendientes por agrupación ──
  const { data: pendingCount } = useQuery({
    queryKey: ["inspection-billing-pending-count", selectedGroupId],
    queryFn: () => countPendingInspectionBilling(selectedGroupId),
    enabled: !!selectedGroupId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateInspectionBillingBatch(selectedGroupId),
    onSuccess: (batch) => {
      toast.success("Nómina generada");
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batches"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-pending-count", selectedGroupId] });
      setSelectedBatchId(batch.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Detalle de nómina ──
  const { data: batchDetail } = useQuery({
    queryKey: ["inspection-billing-batch", selectedBatchId],
    queryFn: () => getInspectionBillingBatch(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["inspection-billing-batch-items", selectedBatchId],
    queryFn: () => getInspectionBillingBatchItems(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, include }: { id: string; include: boolean }) =>
      updateInspectionBillingItem(id, include),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batch-items", selectedBatchId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendInspectionBatchForReview(id),
    onSuccess: () => {
      toast.success("Nómina enviada para revisión");
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batch", selectedBatchId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveInspectionBatch(id, profile?.email || "sistema"),
    onSuccess: () => {
      toast.success("Nómina aprobada — inspecciones marcadas como cobradas");
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batch", selectedBatchId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-batches"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-billing-pending-count", selectedGroupId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Exportar Excel ──
  const exportExcel = (itemsToExport: InspectionBillingBatchItem[], batchName: string) => {
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
    const batchItems = isSent ? allItems.filter((i) => i.include_for_billing) : allItems;
    const includedCount = allItems.filter((i) => i.include_for_billing).length;

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
          </div>
        </div>

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
                          onClick={(v) => toggleMutation.mutate({ id: item.id, include: v })}
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
          <div className="app-grid-title-row">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            <h1 className="app-page-title">Facturación Inspecciones</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          <Select value={selectedGroupId} onValueChange={(v) => setSelectedGroupId(v || "")}>
            <SelectTrigger className="app-input app-filter-narrow">
              <SelectValue placeholder="Seleccionar agrupación..." />
            </SelectTrigger>
            <SelectContent>
              {(groups || []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!selectedGroupId || generateMutation.isPending}
            className="pg-btn-platinum"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
            ) : (
              "Generar"
            )}
          </Button>
        </div>
      </div>

      {selectedGroupId && pendingCount !== undefined && pendingCount > 0 && (
        <div className="app-panel">
          <div className="flex items-center gap-2">
            <span className="app-data-label">Pendientes</span>
            <span className="app-title text-amber-600 dark:text-amber-400">{pendingCount}</span>
            <span className="app-body text-muted-foreground">inspecciones completadas sin facturar</span>
          </div>
        </div>
      )}

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="min-w-40">Nómina</th>
                <th className="min-w-28">Agrupación</th>
                <th className="min-w-20 text-center">Estado</th>
                <th className="min-w-16 text-center">Items</th>
                <th className="min-w-24 hidden sm:table-cell">Generada</th>
                <th className="min-w-24 hidden md:table-cell">Enviada</th>
                <th className="min-w-24 hidden lg:table-cell">Aprobada</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (batches || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay nóminas. Selecciona una agrupación y genera una.
                  </td>
                </tr>
              ) : (
                (batches || []).map((batch) => (
                  <tr
                    key={batch.id}
                    className="row-clickable"
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    <td className="whitespace-nowrap grid-cell-link">{batch.name}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{batch.group_name || "—"}</td>
                    <td className="text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[batch.status]}`}>
                        {statusLabels[batch.status]}
                      </span>
                    </td>
                    <td className="text-center">{batch.item_count}</td>
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
    </div>
  );
}
