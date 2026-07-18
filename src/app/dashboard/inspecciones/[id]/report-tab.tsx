"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReport, createReport, updateReport } from "@/services/inspections";
import { updateInspectionSession } from "@/services/inspections";
import { issueClaimAction } from "@/services/claim-actions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { FileText, Printer, CheckCircle2, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionDetail } from "@/services/inspections";

const SEVERITY_LABELS: Record<string, string> = {
  low: "Leve",
  medium: "Medio",
  high: "Alto",
  total: "Pérdida Total",
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  building: "Daño Constructivo",
  content: "Daño de Contenido",
};

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "—";
  const formatted = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  return `${formatted} ${currency || "CLP"}`;
}

export default function ReportTab({
  session,
  claimNumber,
  claimLiquidationNumber,
  claimAddress,
  insuranceCompanyName,
  insuredName,
  cancellationReason,
  cancellationNotes,
  cancelledAt,
}: {
  session: SessionDetail;
  claimNumber?: string;
  claimLiquidationNumber?: string;
  claimAddress?: string;
  insuranceCompanyName?: string;
  insuredName?: string;
  cancellationReason?: string | null;
  cancellationNotes?: string | null;
  cancelledAt?: string | null;
}) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const sessionId = session.id;
  const sessionStatus = session.status;
  const isCancellation = sessionStatus === "cancelled";
  const isCompleted = sessionStatus === "completed";

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => getReport(sessionId),
  });

  const isFinal = report?.status === "final" || isCompleted;

  // Generar / Regenerar (crea o actualiza el registro en draft)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const reportType = isCancellation ? "cancellation" : "completion";
      const status = "draft";
      if (report) {
        return updateReport(report.id, { status, generated_at: new Date().toISOString(), report_type: reportType });
      }
      return createReport({
        session_id: sessionId,
        claim_id: session.claim_id || null,
        report_url: null,
        generated_at: new Date().toISOString(),
        status,
        report_type: reportType,
      } as Omit<import("@/types").InspectionReport, "id">);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", sessionId] });
      toast.success("Informe generado. Revise los datos y finalice cuando esté listo.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Finalizar: marca el reporte como final + cierra la inspección + emite INS
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      // 1. Marcar el reporte como final
      if (report) {
        await updateReport(report.id, { status: "final", generated_at: new Date().toISOString() });
      } else {
        await createReport({
          session_id: sessionId,
          claim_id: session.claim_id || null,
          report_url: null,
          generated_at: new Date().toISOString(),
          status: "final",
          report_type: isCancellation ? "cancellation" : "completion",
        } as Omit<import("@/types").InspectionReport, "id">);
      }
      // 2. Marcar la sesión como completed
      await updateInspectionSession(session.id, { status: "completed", ended_at: new Date().toISOString() });
      // 3. Emitir el claim_action INS si tiene claim_action_id
      if (session.claim_action_id) {
        await issueClaimAction(session.claim_action_id, profile?.id);
      }
    },
    onSuccess: () => {
      toast.success("Inspección finalizada. Acta generada y gestión emitida.");
      queryClient.invalidateQueries({ queryKey: ["report", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      if (session.claim_id) {
        queryClient.invalidateQueries({ queryKey: ["claim", session.claim_id] });
        queryClient.invalidateQueries({ queryKey: ["claim-actions", session.claim_id] });
        queryClient.invalidateQueries({ queryKey: ["claims"] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${isCancellation ? "Informe de Cancelación" : "Acta de Inspección"} - ${claimNumber || claimLiquidationNumber || ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #1a1a1a; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 14px; text-transform: uppercase; color: #555; margin-top: 28px; margin-bottom: 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 4px; }
            h3 { font-size: 13px; margin-top: 14px; margin-bottom: 6px; color: #333; }
            p { font-size: 12px; line-height: 1.7; color: #333; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
            th { text-align: left; padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; font-weight: 600; }
            td { padding: 6px 8px; border: 1px solid #ddd; }
            .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #333; }
            .header h1 { font-size: 24px; }
            .header .subtitle { font-size: 13px; color: #666; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 12px 0; }
            .info-grid div { font-size: 12px; }
            .info-grid strong { color: #555; }
            .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
            .badge-final { background: #d4edda; color: #155724; }
            .badge-draft { background: #fff3cd; color: #856404; }
            .badge-cancel { background: #f8d7da; color: #721c24; }
            .evidence-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }
            .evidence-grid img { width: 100%; height: 120px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
            .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
            .signature-box { text-align: center; }
            .signature-box img { max-height: 80px; max-width: 200px; border-bottom: 1px solid #333; padding-bottom: 4px; }
            .signature-box p { font-size: 11px; color: #666; margin-top: 4px; }
            .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const evidences = session.inspection_evidences || [];
  const damages = session.inspection_damages || [];
  const signatures = session.inspection_signatures || [];
  const sketches = session.damage_sketches || [];
  const photos = evidences.filter(e => e.type === "photo");
  const videos = evidences.filter(e => e.type === "video");
  const docs = evidences.filter(e => e.type === "document");

  return (
    <div className="app-stack">
      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isFinal && (
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="pg-btn-platinum-icon"
          >
            {report ? <RefreshCw className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            {generateMutation.isPending ? "Generando..." : report ? "Regenerar" : "Generar Informe"}
          </Button>
        )}
        {report && (
          <Button variant="outline" onClick={handlePrint} className="pg-btn-platinum-icon">
            <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
          </Button>
        )}
        {!isFinal && sessionStatus === "active" && (
          <Button
            onClick={() => {
              const hasEvidences = evidences.length > 0;
              const hasDamages = damages.length > 0;
              const hasActa = session.property_risk && Object.keys(session.property_risk).length > 0;
              if (!hasEvidences && !hasDamages && !hasActa) {
                toast.error("No se puede finalizar: la inspección no tiene datos.");
                return;
              }
              if (!hasEvidences) {
                toast.error("No se puede finalizar: suba al menos una foto o documento como evidencia.");
                return;
              }
              finalizeMutation.mutate();
            }}
            disabled={finalizeMutation.isPending}
            className="pg-btn-platinum-icon"
          >
            {finalizeMutation.isPending ? "Finalizando..." : (
              <>
                <Lock className="mr-2 h-4 w-4" /> Finalizar (Acta Definitiva)
              </>
            )}
          </Button>
        )}
        {isFinal && (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">
              {isCancellation ? "Informe de Cancelación Final" : "Acta de Inspección Final"}
            </span>
          </div>
        )}
      </div>

      {/* Estado del reporte */}
      {report && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            isFinal
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : isCancellation
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          }`}>
            {isFinal ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {isFinal ? "Definitivo" : isCancellation ? "Cancelación" : "Borrador"}
          </span>
          {report.generated_at && (
            <span className="text-muted-foreground">
              Generado el {fmtDateTime(report.generated_at)}
            </span>
          )}
        </div>
      )}

      {/* Preview del informe */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando informe...</div>
      ) : (
        <div className="app-panel" ref={printRef}>
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-border">
            <h1 className="text-xl font-bold">
              {isCancellation ? "Informe de Cancelación de Inspección" : "Acta de Inspección"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {insuranceCompanyName || "—"} · Siniestro N° {claimNumber || "—"}
              {claimLiquidationNumber && ` · Liquidación ${claimLiquidationNumber}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Inspección N° {session.inspection_number || "—"} · {session.inspection_type === "remote" ? "Remota" : "Presencial"}
            </p>
          </div>

          {/* Cancelación */}
          {isCancellation && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 mb-4">
              <h2 className="text-[14px] font-semibold text-rose-700 dark:text-rose-300 mb-2">Inspección Cancelada</h2>
              <p className="text-[13px] text-muted-foreground"><strong>Motivo:</strong> {cancellationReason || "No especificado"}</p>
              {cancellationNotes && <p className="text-[13px] text-muted-foreground mt-1"><strong>Notas:</strong> {cancellationNotes}</p>}
              {cancelledAt && <p className="text-[12px] text-muted-foreground mt-2"><strong>Fecha:</strong> {fmtDateTime(cancelledAt)}</p>}
            </div>
          )}

          {/* 1. Datos del Siniestro */}
          <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">1. Datos del Siniestro</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-4">
            <div><strong className="text-muted-foreground">N° Siniestro:</strong> {claimNumber || "—"}</div>
            <div><strong className="text-muted-foreground">N° Liquidación:</strong> {claimLiquidationNumber || "—"}</div>
            <div><strong className="text-muted-foreground">Compañía:</strong> {insuranceCompanyName || "—"}</div>
            <div><strong className="text-muted-foreground">Asegurado:</strong> {insuredName || "—"}</div>
            <div><strong className="text-muted-foreground">Dirección:</strong> {claimAddress || "—"}</div>
            <div><strong className="text-muted-foreground">Fecha Inspección:</strong> {fmtDate(session.inspection_date)}</div>
            <div><strong className="text-muted-foreground">Tipo:</strong> {session.inspection_type === "remote" ? "Remota" : "Presencial"}</div>
            <div><strong className="text-muted-foreground">Estado:</strong> {isFinal ? "Finalizada" : isCancellation ? "Cancelada" : "En proceso"}</div>
          </div>

          {/* 2. Acta de Inspección */}
          {!isCancellation && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">2. Acta de Inspección</h2>

              {/* Entrevistado */}
              <h3 className="text-[13px] font-medium mb-1">Persona Entrevistada</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-3">
                <div><strong className="text-muted-foreground">Nombre:</strong> {session.interviewed_name || "—"}</div>
                <div><strong className="text-muted-foreground">Relación:</strong> {session.interviewed_relationship || "—"}</div>
                <div><strong className="text-muted-foreground">Email:</strong> {session.interviewed_email || "—"}</div>
              </div>

              {/* Riesgo del Bien */}
              {session.property_risk && Object.keys(session.property_risk).length > 0 && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Riesgo del Bien</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-3">
                    {session.property_risk.risk_type && <div><strong className="text-muted-foreground">Tipo de riesgo:</strong> {session.property_risk.risk_type}</div>}
                    {session.property_risk.risk_class && <div><strong className="text-muted-foreground">Clase:</strong> {session.property_risk.risk_class}</div>}
                    {session.property_risk.property_type && <div><strong className="text-muted-foreground">Tipo propiedad:</strong> {session.property_risk.property_type}</div>}
                    {session.property_risk.age_years && <div><strong className="text-muted-foreground">Antigüedad:</strong> {session.property_risk.age_years} años</div>}
                    {session.property_risk.built_surface && <div><strong className="text-muted-foreground">Superficie:</strong> {session.property_risk.built_surface} m²</div>}
                    {session.property_risk.room_count && <div><strong className="text-muted-foreground">Habitaciones:</strong> {session.property_risk.room_count}</div>}
                    {session.property_risk.bathroom_count && <div><strong className="text-muted-foreground">Baños:</strong> {session.property_risk.bathroom_count}</div>}
                    {session.property_risk.is_habitable !== undefined && <div><strong className="text-muted-foreground">Habitable:</strong> {session.property_risk.is_habitable ? "Sí" : "No"}</div>}
                  </div>
                </>
              )}

              {/* Materialidad */}
              {session.property_materiality && Object.keys(session.property_materiality).length > 0 && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Materialidad</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-3">
                    {session.property_materiality.walls && <div><strong className="text-muted-foreground">Muros:</strong> {session.property_materiality.walls}</div>}
                    {session.property_materiality.roof && <div><strong className="text-muted-foreground">Techumbre:</strong> {session.property_materiality.roof}</div>}
                    {session.property_materiality.interior_flooring && <div><strong className="text-muted-foreground">Pavimentos:</strong> {session.property_materiality.interior_flooring}</div>}
                    {session.property_materiality.interior_ceilings && <div><strong className="text-muted-foreground">Cielos:</strong> {session.property_materiality.interior_ceilings}</div>}
                    {session.property_materiality.interior_finishes && <div><strong className="text-muted-foreground">Term. interiores:</strong> {session.property_materiality.interior_finishes}</div>}
                    {session.property_materiality.exterior_finishes && <div><strong className="text-muted-foreground">Term. exteriores:</strong> {session.property_materiality.exterior_finishes}</div>}
                    {session.property_materiality.perimeter_closure && <div><strong className="text-muted-foreground">Cierre perimetral:</strong> {session.property_materiality.perimeter_closure}</div>}
                  </div>
                </>
              )}

              {/* Medidas de Seguridad */}
              {session.security_measures && Object.keys(session.security_measures).length > 0 && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Medidas de Seguridad</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-3">
                    {Object.entries(session.security_measures).map(([key, val]) => {
                      const labels: Record<string, string> = {
                        protections: "Protecciones", security_locks: "Cerraduras",
                        security_guards: "Guardias", alarms: "Alarmas",
                        cameras: "Cámaras", other_measures: "Otras",
                      };
                      const item = val as { has_it?: boolean; detail?: string };
                      return (
                        <div key={key}>
                          <strong className="text-muted-foreground">{labels[key] || key}:</strong>{" "}
                          {item.has_it ? `Sí${item.detail ? ` — ${item.detail}` : ""}` : "No"}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Declaración del Asegurado */}
              {session.insured_statement && session.insured_statement.statement && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Declaración del Asegurado</h3>
                  <p className="text-[13px] text-muted-foreground mb-3 whitespace-pre-wrap">{session.insured_statement.statement}</p>
                  {session.insured_statement.entry_exit_point && <p className="text-[13px] text-muted-foreground mb-1"><strong>Punto de entrada/salida:</strong> {session.insured_statement.entry_exit_point}</p>}
                </>
              )}

              {/* Carabineros / Bomberos */}
              {(session.police_report_number || session.firefighters_company) && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Antecedentes Policiales / Bomberos</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] mb-3">
                    {session.police_report_number && <div><strong className="text-muted-foreground">Parte Carabineros:</strong> {session.police_report_number}</div>}
                    {session.police_report_name && <div><strong className="text-muted-foreground">Nombre:</strong> {session.police_report_name}</div>}
                    {session.police_report_rut && <div><strong className="text-muted-foreground">RUT:</strong> {session.police_report_rut}</div>}
                    {session.firefighters_company && <div><strong className="text-muted-foreground">Cuerpo de Bomberos:</strong> {session.firefighters_company}</div>}
                  </div>
                </>
              )}

              {/* Terceros */}
              {session.third_parties && session.third_parties.length > 0 && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Terceros Afectados</h3>
                  <table className="w-full text-[12px] border-collapse mb-3">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 border border-border">Tipo</th>
                        <th className="text-left p-2 border border-border">Nombre</th>
                        <th className="text-left p-2 border border-border">RUT</th>
                        <th className="text-left p-2 border border-border">Teléfono</th>
                        <th className="text-left p-2 border border-border">Seguro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.third_parties.map((tp, i) => (
                        <tr key={i}>
                          <td className="p-2 border border-border">{tp.party_type}</td>
                          <td className="p-2 border border-border">{tp.full_name || "—"}</td>
                          <td className="p-2 border border-border">{tp.rut || "—"}</td>
                          <td className="p-2 border border-border">{tp.phone || "—"}</td>
                          <td className="p-2 border border-border">{tp.has_insurance ? tp.insurance_company || "Sí" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Observaciones del Inspector */}
              {session.inspector_observations && (
                <>
                  <h3 className="text-[13px] font-medium mb-1">Observaciones del Inspector</h3>
                  <p className="text-[13px] text-muted-foreground mb-3 whitespace-pre-wrap">{session.inspector_observations}</p>
                </>
              )}
            </>
          )}

          {/* 3. Registro de Daños */}
          {!isCancellation && damages.length > 0 && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">
                3. Registro de Daños ({damages.length})
              </h2>
              <table className="w-full text-[12px] border-collapse mb-3">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 border border-border">Tipo</th>
                    <th className="text-left p-2 border border-border">Descripción</th>
                    <th className="text-left p-2 border border-border">Severidad</th>
                    <th className="text-left p-2 border border-border">Espacio</th>
                    <th className="text-right p-2 border border-border">Cant.</th>
                    <th className="text-left p-2 border border-border">Unidad</th>
                    <th className="text-right p-2 border border-border">Monto Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {damages.map((d) => (
                    <tr key={d.id}>
                      <td className="p-2 border border-border">{DAMAGE_TYPE_LABELS[d.damage_type] || d.damage_type}</td>
                      <td className="p-2 border border-border">{d.description}</td>
                      <td className="p-2 border border-border">{SEVERITY_LABELS[d.severity] || d.severity}</td>
                      <td className="p-2 border border-border">{d.dependency || "—"}</td>
                      <td className="text-right p-2 border border-border">{d.quantity ?? "—"}</td>
                      <td className="p-2 border border-border">{d.unit || "—"}</td>
                      <td className="text-right p-2 border border-border">{fmtMoney(d.estimated_amount, d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 4. Evidencias */}
          {!isCancellation && photos.length > 0 && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">
                4. Evidencias Fotográficas ({photos.length})
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((ev) => (
                  <div key={ev.id} className="rounded-lg overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ev.url} alt={ev.description || ""} className="w-full h-32 object-cover" />
                    {ev.description && <p className="text-[10px] text-muted-foreground p-1 truncate">{ev.description}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 5. Videos y Documentos */}
          {!isCancellation && (videos.length > 0 || docs.length > 0) && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">
                5. Videos y Documentos
              </h2>
              <ul className="text-[13px] text-muted-foreground space-y-1 list-disc list-inside mb-3">
                {videos.map((v) => <li key={v.id}>Video: {v.description || v.url}</li>)}
                {docs.map((d) => <li key={d.id}>Documento: {d.description || d.url}</li>)}
              </ul>
            </>
          )}

          {/* 6. Croquis */}
          {!isCancellation && sketches.length > 0 && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">
                6. Croquis ({sketches.length})
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {sketches.map((sk) => (
                  <div key={sk.id} className="rounded-lg overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sk.sketch_url} alt={sk.label || "Croquis"} className="w-full h-40 object-contain bg-white" />
                    {sk.label && <p className="text-[10px] text-muted-foreground p-1">{sk.label}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 7. Firmas */}
          {!isCancellation && signatures.length > 0 && (
            <>
              <h2 className="text-[11px] font-semibold text-muted-foreground border-b pb-1 mb-3 mt-4">
                7. Firmas Digitales
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-3">
                {signatures.map((sig) => (
                  <div key={sig.id} className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sig.signature_url} alt={`Firma ${sig.role}`} className="max-h-20 max-w-[200px] mx-auto border-b border-border pb-1" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {sig.role === "insured" ? "Asegurado" : sig.role === "adjuster" ? "Ajustador/Inspector" : sig.role}
                      {" — "}{fmtDateTime(sig.signed_at)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="pt-4 border-t text-center text-[11px] text-muted-foreground mt-6">
            Documento {isFinal ? "definitivo" : "en borrador"} generado por Claims Hub · {new Date().toLocaleDateString("es-CL")}
            {isFinal && report?.generated_at && ` · Finalizado el ${fmtDateTime(report.generated_at)}`}
          </div>
        </div>
      )}
    </div>
  );
}
