"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReport, createReport, updateReport } from "@/services/inspections";
import { toast } from "sonner";
import { FileText, CheckCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportTab({ sessionId, claimNumber }: { sessionId: string; claimNumber?: string }) {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => getReport(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", sessionId] });
      toast.success("Informe generado");
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
    if (report) {
      updateMutation.mutate({
        id: report.id,
        data: { status: "generated", generated_at: new Date().toISOString() },
      });
    } else {
      createMutation.mutate({
        session_id: sessionId,
        report_url: null,
        generated_at: new Date().toISOString(),
        status: "generated",
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
          <title>Informe Siniestro ${claimNumber || ""}</title>
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
      <div className="flex items-center gap-2">
        <Button onClick={handleGenerate} disabled={createMutation.isPending || updateMutation.isPending} className="btn-create btn-sm">
          <FileText className="mr-2 h-4 w-4" />
          {report ? "Regenerar Informe" : "Generar Informe"}
        </Button>
        {report?.status === "generated" && (
          <Button variant="outline" onClick={handlePrint} className="btn-neutral btn-sm">
            <Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
        )}
      </div>

      {/* Preview del informe */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="app-panel" ref={printRef}>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold">Informe de Inspección</h1>
            <p className="text-sm text-muted-foreground mt-1">Siniestro N° {claimNumber || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {report?.generated_at ? `Generado el ${new Date(report.generated_at).toLocaleString("es-CL")}` : "Informe en borrador"}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-2">
                Resumen del Siniestro
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Este informe consolidado incluye la información recopilada durante la inspección remota del siniestro.
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

            <div className="pt-4 border-t text-center text-[11px] text-muted-foreground">
              Documento generado por Claims Hub · {new Date().toLocaleDateString("es-CL")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
