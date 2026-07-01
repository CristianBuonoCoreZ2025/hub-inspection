"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReport, createReport, updateReport } from "@/services/inspections";
import { toast } from "sonner";
import { FileText, CheckCircle, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportTab({
  sessionId,
  claimNumber,
  sessionStatus,
  cancellationReason,
  cancellationNotes,
  cancelledAt,
}: {
  sessionId: string;
  claimNumber?: string;
  sessionStatus?: string;
  cancellationReason?: string | null;
  cancellationNotes?: string | null;
  cancelledAt?: string | null;
}) {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const isCancellation = sessionStatus === "cancelled";

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => getReport(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", sessionId] });
      toast.success(isCancellation ? "Informe de cancelación generado" : "Informe generado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateReport>[1] }) =>
      updateReport(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report", sessionId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const handleGenerate = () => {
    const reportType = isCancellation ? "cancellation" : "completion";
    const status = isCancellation ? "cancellation" : "generated";
    if (report) {
      updateMutation.mutate({
        id: report.id,
        data: { status, generated_at: new Date().toISOString(), report_type: reportType },
      });
    } else {
      createMutation.mutate({
        session_id: sessionId,
        report_url: null,
        generated_at: new Date().toISOString(),
        status,
        report_type: reportType,
      });
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${isCancellation ? "Informe de Cancelación" : "Informe"} Siniestro ${claimNumber || ""}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            h2 { font-size: 14px; text-transform: uppercase; color: #666; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            p { font-size: 13px; line-height: 1.6; color: #333; }
            .section { margin-bottom: 16px; }
            .meta { color: #666; font-size: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleGenerate} disabled={createMutation.isPending || updateMutation.isPending} className={isCancellation ? "btn-cancel btn-sm" : "btn-create btn-sm"}>
          <FileText className="mr-2 h-4 w-4" />
          {report ? "Regenerar" : isCancellation ? "Generar Informe de Cancelación" : "Generar"}
        </Button>
        {report?.status && (
          <Button variant="outline" onClick={handlePrint} className="btn-neutral btn-sm">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        )}
      </div>

      {/* Preview del informe */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="app-panel" ref={printRef}>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold">
              {isCancellation ? "Informe de Cancelación de Inspección" : "Informe de Inspección"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Siniestro N° {claimNumber || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {report?.generated_at ? `Generado el ${new Date(report.generated_at).toLocaleString("es-CL")}` : "Informe en borrador"}
            </p>
          </div>

          {isCancellation ? (
            /* Informe de Cancelación */
            <div className="space-y-4">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-[14px] font-semibold text-rose-700 dark:text-rose-300">
                      Inspección Cancelada
                    </h2>
                    <p className="text-[13px] text-muted-foreground mt-2">
                      <strong>Motivo:</strong> {cancellationReason || "No especificado"}
                    </p>
                    {cancellationNotes && (
                      <p className="text-[13px] text-muted-foreground mt-1">
                        <strong>Notas:</strong> {cancellationNotes}
                      </p>
                    )}
                    {cancelledAt && (
                      <p className="text-[12px] text-muted-foreground mt-2">
                        <strong>Fecha de cancelación:</strong> {new Date(cancelledAt).toLocaleString("es-CL")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-2">
                  Estado del Informe
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    report?.status === "cancellation"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    <XCircle className="h-3 w-3" />
                    {report?.status === "cancellation" ? "Generado" : "Borrador"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Informe de Finalización */
            <div className="space-y-4">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-2">
                  Resumen del Siniestro
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Este informe consolidado incluye la información recopilada durante la inspección del siniestro.
                  Contiene el Acta de Inspección, registro de daños, evidencias fotográficas, croquis y firmas digitales.
                </p>
              </div>

              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-2">
                  Estado del Informe
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    report?.status === "generated"
                      ? "bg-emerald-100 text-emerald-700"
                      : report?.status === "sent"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    <CheckCircle className="h-3 w-3" />
                    {report?.status === "generated" ? "Generado" : report?.status === "sent" ? "Enviado" : "Borrador"}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-2">
                  Secciones del Informe
                </h2>
                <ul className="text-[13px] text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Acta de Inspección (6 pasos)</li>
                  <li>Checklist de verificación</li>
                  <li>Registro de Daños</li>
                  <li>Evidencias Fotográficas y Multimedia</li>
                  <li>Croquis de Áreas Afectadas</li>
                  <li>Firmas Digitales</li>
                </ul>
              </div>
            </div>
          )}

          <div className="pt-4 border-t text-center text-[11px] text-muted-foreground mt-4">
            Documento generado por Claims Hub · {new Date().toLocaleDateString("es-CL")}
          </div>
        </div>
      )}
    </div>
  );
}
