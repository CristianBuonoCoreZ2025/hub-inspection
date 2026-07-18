"use client";

import { useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReport, createReport, updateReport } from "@/services/inspections";
import { updateInspectionSession } from "@/services/inspections";
import { issueClaimAction } from "@/services/claim-actions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { FileText, Printer, CheckCircle2, RefreshCw, Lock, Download } from "lucide-react";
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
  insuredName,
  insuredRut,
  insuredPhone,
  insuredEmail,
  claimCause,
  claimDate,
  commune,
  cancellationReason,
  cancellationNotes,
  cancelledAt,
}: {
  session: SessionDetail;
  claimNumber?: string;
  claimLiquidationNumber?: string;
  claimAddress?: string;
  insuredName?: string;
  insuredRut?: string;
  insuredPhone?: string;
  insuredEmail?: string;
  claimCause?: string;
  claimDate?: string;
  commune?: string;
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
      toast.success("Acta generada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Generar PDF del acta usando html2canvas + jsPDF
  const generatePdf = useCallback(async (): Promise<Blob | null> => {
    const content = printRef.current;
    if (!content) return null;
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  }, []);

  // Subir PDF a R2
  const uploadPdf = useCallback(async (pdfBlob: Blob): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", pdfBlob, "acta-inspeccion.pdf");
    formData.append("sessionId", sessionId);
    const res = await fetch("/api/inspection/report/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al subir PDF");
    }
    const data = await res.json();
    return data.url as string;
  }, [sessionId]);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      // 1. Generar el PDF
      const pdfBlob = await generatePdf();
      let reportUrl: string | null = null;

      // 2. Subir el PDF a R2
      if (pdfBlob) {
        reportUrl = await uploadPdf(pdfBlob);
      }

      // 3. Marcar el reporte como final con la URL del PDF
      if (report) {
        await updateReport(report.id, { status: "final", generated_at: new Date().toISOString(), report_url: reportUrl });
      } else {
        await createReport({
          session_id: sessionId,
          claim_id: session.claim_id || null,
          report_url: reportUrl,
          generated_at: new Date().toISOString(),
          status: "final",
          report_type: isCancellation ? "cancellation" : "completion",
        } as Omit<import("@/types").InspectionReport, "id">);
      }
      // 4. Marcar la sesión como completed
      await updateInspectionSession(session.id, { status: "completed", ended_at: new Date().toISOString() });
      // 5. Emitir el claim_action INS
      if (session.claim_action_id) {
        await issueClaimAction(session.claim_action_id, profile?.id);
      }
    },
    onSuccess: () => {
      toast.success("Acta finalizada y PDF generado");
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

  // Descargar PDF (para actas finales)
  const handleDownload = useCallback(async () => {
    if (report?.report_url) {
      window.open(report.report_url, "_blank");
      return;
    }
    // Si no hay URL guardada, generar el PDF al vuelo
    const blob = await generatePdf();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acta-${claimLiquidationNumber || claimNumber || sessionId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, generatePdf, claimLiquidationNumber, claimNumber, sessionId]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Acta de Inspección - ${claimLiquidationNumber || claimNumber || ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 30px 40px; max-width: 800px; margin: 0 auto; color: #222; font-size: 11px; line-height: 1.6; }
            .acta-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
            .acta-header .logo { max-height: 50px; max-width: 180px; }
            .acta-header .logo-text { font-size: 14px; font-weight: 700; color: #1a1a1a; }
            .acta-header .header-info { text-align: right; font-size: 10px; color: #555; }
            .acta-header .header-info h1 { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
            .acta-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; background: #f0f0f0; padding: 6px 10px; margin: 18px 0 8px; border-left: 4px solid #1a1a1a; }
            .field-row { display: flex; margin-bottom: 2px; }
            .field-label { font-weight: 600; color: #444; min-width: 200px; font-size: 10px; text-transform: uppercase; }
            .field-value { flex: 1; font-size: 10px; color: #222; }
            .field-block { margin-bottom: 3px; }
            .field-block .label { font-weight: 600; color: #444; font-size: 10px; text-transform: uppercase; }
            .field-block .value { font-size: 10px; color: #222; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            th { text-align: left; padding: 5px 6px; background: #f0f0f0; border: 1px solid #ccc; font-size: 9px; font-weight: 700; text-transform: uppercase; }
            td { padding: 5px 6px; border: 1px solid #ccc; font-size: 9px; }
            .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; }
            .photo-grid img { width: 100%; height: 130px; object-fit: contain; }
            .photo-label { font-size: 8px; color: #666; text-align: center; margin-top: 2px; }
            .sketch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 6px 0; }
            .sketch-grid img { width: 100%; height: 140px; object-fit: contain; border: 1px solid #ccc; background: #fff; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
            .sig-box { text-align: center; }
            .sig-box img { max-height: 60px; max-width: 180px; border-bottom: 1px solid #333; padding-bottom: 3px; margin: 0 auto; }
            .sig-box .name { font-size: 10px; font-weight: 600; margin-top: 3px; }
            .sig-box .role { font-size: 9px; color: #666; }
            .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #999; }
            .cancellation-box { border: 2px solid #c0392b; background: #fdf2f2; padding: 10px; margin: 10px 0; border-radius: 4px; }
            .cancellation-box h3 { color: #c0392b; font-size: 12px; margin-bottom: 4px; }
            @media print { body { padding: 15px 20px; } }
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
  // Filtro flexible: el type puede venir como "photo", "image", "video", "document", "pdf", etc.
  const isPhoto = (t: string) => ["photo", "image", "jpg", "jpeg", "png"].includes(t.toLowerCase());
  const isVideo = (t: string) => ["video", "mp4", "mov"].includes(t.toLowerCase());
  const isDoc = (t: string) => ["document", "pdf", "doc", "docx", "file"].includes(t.toLowerCase());
  const photos = evidences.filter(e => isPhoto(e.type));
  const videos = evidences.filter(e => isVideo(e.type));
  const docs = evidences.filter(e => isDoc(e.type));
  const otherEvidences = evidences.filter(e => !isPhoto(e.type) && !isVideo(e.type) && !isDoc(e.type));
  // Solo una firma por rol (insured + adjuster = máximo 2)
  const uniqueSignatures = signatures.filter((s, i, arr) => arr.findIndex(x => x.role === s.role) === i);
  const companyName = profile?.company?.name || "—";
  const companyLogo = profile?.company?.logo_url || null;
  const companyPhone = profile?.company?.phone || null;
  const companyAddress = profile?.company?.address || null;
  const companyEmail = profile?.company?.email || null;

  // Estilos compartidos para campos
  const fieldRow = (label: string, value: string | undefined | null) => (
    <div className="field-row flex mb-0.5">
      <span className="field-label font-semibold text-muted-foreground min-w-[200px] text-[10px] uppercase">{label}:</span>
      <span className="field-value flex-1 text-[10px]">{value || "—"}</span>
    </div>
  );

  return (
    <div className="app-stack">
      {/* Acciones — botones de una sola palabra */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isFinal && (
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="pg-btn-platinum-icon"
          >
            {report ? <RefreshCw className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            {generateMutation.isPending ? "Generando..." : report ? "Regenerar" : "Generar"}
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
                <Lock className="mr-2 h-4 w-4" /> Finalizar
              </>
            )}
          </Button>
        )}
        {isFinal && (
          <>
            <Button variant="outline" onClick={handlePrint} className="pg-btn-platinum-icon">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" onClick={handleDownload} className="pg-btn-platinum-icon">
              <Download className="mr-2 h-4 w-4" /> Descargar
            </Button>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Acta Definitiva</span>
            </div>
          </>
        )}
      </div>

      {/* Preview del acta — vista tipo PDF con scroll */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="pdf-viewer bg-gray-200 dark:bg-gray-800 rounded-lg p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          <div className="pdf-page bg-white shadow-lg mx-auto text-gray-900 relative" ref={printRef} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: "800px", padding: "30px 40px" }}>

          {/* Marca de agua BORRADOR */}
          {!isFinal && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-6xl font-bold text-gray-300 opacity-30 select-none" style={{ transform: "rotate(-30deg)", letterSpacing: "8px" }}>
                BORRADOR
              </span>
            </div>
          )}

          {/* ═══ HEADER ═══ */}
          <div className="acta-header flex items-start justify-between border-b-[3px] border-gray-900 pb-3 mb-4">
            <div>
              {companyLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={companyLogo} alt={companyName} className="logo h-14 w-auto" crossOrigin="anonymous" />
              ) : (
                <div className="logo-text text-sm font-bold">{companyName}</div>
              )}
              {companyPhone && <p className="text-[9px] text-gray-500 mt-1">Tel: {companyPhone}</p>}
              {companyAddress && <p className="text-[9px] text-gray-500">{companyAddress}</p>}
              {companyEmail && <p className="text-[9px] text-gray-500">{companyEmail}</p>}
            </div>
            <div className="header-info text-right">
              <h1 className="text-base font-bold text-gray-900">ACTA DE INSPECCIÓN</h1>
              <p>Correlativo: {claimLiquidationNumber || "—"}</p>
              <p>Siniestro: {claimNumber || "—"}</p>
              <p>Inspección: {session.inspection_number || "—"}</p>
            </div>
          </div>

          {/* ═══ CANCELACIÓN ═══ */}
          {isCancellation && (
            <div className="cancellation-box border-2 border-rose-600 bg-rose-50 p-3 rounded mb-3">
              <h3 className="text-rose-700 font-bold text-xs mb-1">Inspección Cancelada</h3>
              {fieldRow("Motivo", cancellationReason)}
              {fieldRow("Notas", cancellationNotes)}
              {fieldRow("Fecha", fmtDateTime(cancelledAt))}
            </div>
          )}

          {/* ═══ ANTECEDENTES GENERALES ═══ */}
          <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
            Antecedentes Generales
          </div>
          {fieldRow("Aseguradora", session.claim?.insurance_company?.name)}
          {fieldRow("Causa Origen", claimCause)}
          {fieldRow("Fecha de Siniestro", fmtDateTime(claimDate))}
          {fieldRow("Fecha de Inspección", fmtDateTime(session.inspection_date ? `${session.inspection_date}T${session.inspection_time || "00:00"}` : session.scheduled_at))}

          {/* ═══ ANTECEDENTES DEL ASEGURADO ═══ */}
          <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
            Antecedentes del Asegurado
          </div>
          {fieldRow("Razón Social", insuredName)}
          {fieldRow("Dirección del Siniestro", claimAddress)}
          {fieldRow("Comuna", commune)}
          {fieldRow("Declarante", session.interviewed_name)}
          {fieldRow("RUT Declarante", insuredRut)}
          {fieldRow("Relación con Asegurado", session.interviewed_relationship)}
          {fieldRow("Correo Electrónico", session.interviewed_email || insuredEmail)}
          {fieldRow("Teléfono", insuredPhone)}
          {fieldRow("Poseé Otras Pólizas", session.other_insurances ? `Sí — ${session.other_insurance_company || ""}` : "No")}
          {fieldRow("Tipo de Inspección", session.inspection_type === "remote" ? "Remota" : "Presencial")}

          {/* ═══ DETALLE DE LOS HECHOS ═══ */}
          {session.insured_statement?.statement && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Detalle de los Hechos
              </div>
              <p className="text-[10px] text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">
                {session.insured_statement.statement}
              </p>
            </>
          )}

          {/* ═══ ANTECEDENTES DEL RIESGO ═══ */}
          {session.property_risk && Object.keys(session.property_risk).length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Antecedentes del Riesgo
              </div>
              {fieldRow("Materia Afectada", session.property_risk.property_type)}
              {fieldRow("Uso del Inmueble", session.property_risk.risk_type)}
              {fieldRow("Antigüedad", session.property_risk.age_years ? `${session.property_risk.age_years} años` : null)}
              {fieldRow("Número de Pisos", session.property_risk.floor_count)}
              {fieldRow("Metros Cuadrados", session.property_risk.built_surface ? `${session.property_risk.built_surface} m²` : null)}
              {fieldRow("Habitaciones", session.property_risk.room_count)}
              {fieldRow("Baños", session.property_risk.bathroom_count)}
              {fieldRow("¿Habitable?", session.property_risk.is_habitable !== undefined ? (session.property_risk.is_habitable ? "Sí" : "No") : null)}
            </>
          )}

          {/* ═══ CARACTERÍSTICAS DE LA CONSTRUCCIÓN ═══ */}
          {session.property_materiality && Object.keys(session.property_materiality).length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Características de la Construcción
              </div>
              {fieldRow("Sistema Estructural", null)}
              {fieldRow("Muros / Tabiquería", session.property_materiality.walls)}
              {fieldRow("Techumbre", session.property_materiality.roof)}
              {fieldRow("Terminaciones de Muro", session.property_materiality.interior_finishes)}
              {fieldRow("Cubierta de Techumbre", session.property_materiality.exterior_finishes)}
              {fieldRow("Pavimentos", session.property_materiality.interior_flooring)}
              {fieldRow("Cielos", session.property_materiality.interior_ceilings)}
              {fieldRow("Cierre Perimetral", session.property_materiality.perimeter_closure)}
              {fieldRow("Instalación de Agua Potable", null)}
            </>
          )}

          {/* ═══ MEDIDAS DE SEGURIDAD ═══ */}
          {session.security_measures && Object.keys(session.security_measures).length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Medidas de Seguridad
              </div>
              {Object.entries(session.security_measures).map(([key, val]) => {
                const labels: Record<string, string> = {
                  protections: "Protecciones", security_locks: "Cerraduras",
                  security_guards: "Guardias", alarms: "Alarmas",
                  cameras: "Cámaras", other_measures: "Otras",
                };
                const item = val as { has_it?: boolean; detail?: string };
                return fieldRow(labels[key] || key, item.has_it ? `Sí${item.detail ? ` — ${item.detail}` : ""}` : "No");
              })}
            </>
          )}

          {/* ═══ ANTECEDENTES POLICIALES ═══ */}
          {(session.police_report_number || session.firefighters_company) && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Antecedentes Policiales / Bomberos
              </div>
              {fieldRow("Parte Carabineros", session.police_report_number)}
              {fieldRow("Nombre", session.police_report_name)}
              {fieldRow("RUT", session.police_report_rut)}
              {fieldRow("Cuerpo de Bomberos", session.firefighters_company)}
            </>
          )}

          {/* ═══ TERCEROS ═══ */}
          {session.third_parties && session.third_parties.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Terceros Afectados
              </div>
              <table className="w-full border-collapse my-1.5">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Tipo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Nombre</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">RUT</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Teléfono</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Seguro</th>
                  </tr>
                </thead>
                <tbody>
                  {session.third_parties.map((tp, i) => (
                    <tr key={i}>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{tp.party_type}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{tp.full_name || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{tp.rut || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{tp.phone || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{tp.has_insurance ? tp.insurance_company || "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ REGISTRO DE DAÑOS ═══ */}
          {damages.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Registro de Daños ({damages.length})
              </div>
              <table className="w-full border-collapse my-1.5">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Tipo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Descripción</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Severidad</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Espacio</th>
                    <th className="text-right p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Cant.</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Unidad</th>
                    <th className="text-right p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Monto Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {damages.map((d) => (
                    <tr key={d.id}>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{DAMAGE_TYPE_LABELS[d.damage_type] || d.damage_type}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{d.description}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{SEVERITY_LABELS[d.severity] || d.severity}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{d.dependency || "—"}</td>
                      <td className="text-right p-1.5 border border-gray-300 text-[9px]">{d.quantity ?? "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{d.unit || "—"}</td>
                      <td className="text-right p-1.5 border border-gray-300 text-[9px]">{fmtMoney(d.estimated_amount, d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ OBSERVACIONES DEL INSPECTOR ═══ */}
          {session.inspector_observations && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Observaciones del Inspector
              </div>
              <p className="text-[10px] text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">
                {session.inspector_observations}
              </p>
            </>
          )}

          {/* ═══ RESUMEN DE EVIDENCIAS ═══ */}
          {evidences.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Resumen de Evidencias ({evidences.length})
              </div>
              <table className="w-full border-collapse my-1.5">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">N°</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Tipo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Archivo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{idx + 1}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px] capitalize">{ev.type}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{ev.metadata?.originalName || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{ev.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ EVIDENCIAS FOTOGRÁFICAS ═══ */}
          {photos.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Evidencias Fotográficas ({photos.length})
              </div>
              <div className="photo-grid grid grid-cols-3 gap-1.5 my-1.5">
                {photos.map((ev, idx) => (
                  <div key={ev.id} className="border border-gray-300 p-1 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ev.url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-contain" crossOrigin="anonymous" />
                    <p className="photo-label text-[8px] text-gray-600 text-center mt-0.5">
                      Foto {idx + 1}{ev.description ? ` — ${ev.description}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ VIDEOS ═══ */}
          {videos.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Videos ({videos.length})
              </div>
              <table className="w-full border-collapse my-1.5">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">N°</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Archivo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v, idx) => (
                    <tr key={v.id}>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{idx + 1}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{v.metadata?.originalName || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{v.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ DOCUMENTOS ADJUNTOS ═══ */}
          {docs.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Documentos Adjuntos ({docs.length})
              </div>
              {docs.map((d, idx) => {
                const fileName = d.metadata?.originalName || `documento-${idx + 1}`;
                const mimeType = d.metadata?.mimeType || "";
                const pdfSummary = d.metadata?.pdfSummary as string | undefined;
                const pageCount = d.metadata?.pdfPageCount as number | undefined;
                const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                return (
                  <div key={d.id} className="border border-gray-300 p-2 mb-2 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-700 mb-1">
                      Documento {idx + 1}: {fileName}
                      {pageCount ? ` (${pageCount} ${pageCount === 1 ? "página" : "páginas"})` : ""}
                    </p>
                    {d.description && (
                      <p className="text-[9px] text-gray-600 mb-1">{d.description}</p>
                    )}
                    {pdfSummary && (
                      <p className="text-[9px] text-gray-700 italic mb-1 border-l-2 border-gray-300 pl-2">
                        {pdfSummary}
                      </p>
                    )}
                    {isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.url} alt={fileName} className="w-full max-h-48 object-contain border border-gray-200" crossOrigin="anonymous" />
                    ) : !pdfSummary && (
                      <p className="text-[9px] text-gray-500 italic">
                        Documento {mimeType || "adjunto"} — {d.metadata?.fileSize ? `${(d.metadata.fileSize as number / 1024).toFixed(0)} KB` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ═══ OTRAS EVIDENCIAS ═══ */}
          {otherEvidences.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Otras Evidencias ({otherEvidences.length})
              </div>
              <table className="w-full border-collapse my-1.5">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">N°</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Tipo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Archivo</th>
                    <th className="text-left p-1.5 bg-gray-100 border border-gray-300 text-[9px] font-bold uppercase">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {otherEvidences.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{idx + 1}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px] capitalize">{d.type}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{d.metadata?.originalName || "—"}</td>
                      <td className="p-1.5 border border-gray-300 text-[9px]">{d.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ CROQUIS ═══ */}
          {sketches.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Croquis ({sketches.length})
              </div>
              <div className="sketch-grid grid grid-cols-2 gap-1.5 my-1.5">
                {sketches.map((sk, idx) => (
                  <div key={sk.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sk.sketch_url} alt={`Croquis ${idx + 1}`} className="w-full h-36 object-contain border border-gray-300 bg-white" crossOrigin="anonymous" />
                    <p className="photo-label text-[8px] text-gray-600 text-center mt-0.5">
                      Croquis {idx + 1}{sk.label ? ` — ${sk.label}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ FIRMAS ═══ */}
          {uniqueSignatures.length > 0 && (
            <>
              <div className="acta-title text-[13px] font-bold uppercase text-gray-900 bg-gray-100 px-2.5 py-1.5 my-4 border-l-4 border-gray-900">
                Firmas
              </div>
              <div className="sig-grid grid grid-cols-2 gap-5 mt-6">
                {uniqueSignatures.map((sig) => (
                  <div key={sig.id} className="sig-box text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sig.signature_url} alt={`Firma ${sig.role}`} className="max-h-16 max-w-[180px] border-b border-gray-700 pb-1 mx-auto" crossOrigin="anonymous" />
                    <p className="name text-[10px] font-semibold mt-1">
                      {sig.role === "insured" ? "Asegurado" : "Inspector"}
                    </p>
                    <p className="role text-[9px] text-gray-500">{fmtDateTime(sig.signed_at)}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ FOOTER ═══ */}
          <div className="footer mt-8 pt-2.5 border-t border-gray-300 text-center text-[8px] text-gray-400">
            Documento {isFinal ? "definitivo" : "en borrador"} emitido por {companyName} · {new Date().toLocaleDateString("es-CL")}
            {isFinal && report?.generated_at && ` · Finalizado el ${fmtDateTime(report.generated_at)}`}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
