"use client";

import { useRef, useCallback, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getReport, createReport, updateReport } from "@/services/inspections";
import { updateInspectionSession } from "@/services/inspections";
import { issueClaimAction } from "@/services/claim-actions";
import { toast } from "sonner";
import { FileText, Printer, CheckCircle2, RefreshCw, Lock, Download, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionDetail } from "@/services/inspections";

const SEVERITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  total: "Total",
};

function fmtDateTime(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtSingleQuantity(quantity: number | null, length: number | null, width: number | null, height: number | null, unit: string | null): string {
  if (quantity == null || quantity === 0) return "—";
  const dimension =
    unit === "M2" && (length || width)
      ? ` (${length || 0}x${width || 0})`
      : unit === "M3" && (length || width || height)
      ? ` (${length || 0}x${width || 0}x${height || 0})`
      : "";
  return `${quantity.toLocaleString("es-CL")} ${unit || ""}${dimension}`.trim();
}

function fmtQuantity(d: { quantity: number | null; unit: string | null; length: number | null; width: number | null; height: number | null; damage_quantity?: number | null; damage_length?: number | null; damage_width?: number | null; damage_height?: number | null }): React.ReactNode {
  return (
    <span className="text-[10px] leading-tight">
      Sup: {fmtSingleQuantity(d.quantity, d.length, d.width, d.height, d.unit)} / Daño: {fmtSingleQuantity(d.damage_quantity ?? null, d.damage_length ?? null, d.damage_width ?? null, d.damage_height ?? null, d.unit)}
    </span>
  );
}

function fmtMoney(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency || "CLP",
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CL")} ${currency || "CLP"}`;
  }
}

// Acorta el código de inspección quitando el prefijo de liquidación.
// "L-000000141-HINS-001" -> "HINS-001"
function shortInspectionNumber(code: string | null | undefined): string {
  if (!code) return "—";
  const parts = code.split("-");
  if (parts.length >= 3) {
    return parts.slice(2).join("-");
  }
  return code;
}

export default function ReportTab({
  session,
  profile,
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
  profile?: { id?: string; company?: { name?: string | null; logo_url?: string | null; phone?: string | null; email?: string | null; address?: string | null } | null } | null;
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
  const printRef = useRef<HTMLDivElement>(null);
  const { dataAccess } = useAuth();
  const canRegenerate = dataAccess?.is_admin ?? false;
  const sessionId = session.id;
  const sessionStatus = session.status;
  const isCancellation = sessionStatus === "cancelled";
  const isCompleted = sessionStatus === "completed";

  const { data: reportMaxPhotos } = useQuery({
    queryKey: ["report-max-photos"],
    queryFn: async () => {
      const res = await fetch("/api/settings/report-max-photos");
      const data = (await res.json()) as { value?: number };
      return typeof data.value === "number" ? data.value : 18;
    },
  });

  const { data: report, isLoading, isError, error: reportError } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => getReport(sessionId),
  });

  // Forzar isFinal durante la generación del PDF para que el watermark
  // "BORRADOR" no aparezca y el footer diga "definitivo"
  const [forceFinalForPdf, setForceFinalForPdf] = useState(false);
  const isFinal = report?.status === "final" || isCompleted || forceFinalForPdf;

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
    try {
      const content = printRef.current;
      if (!content) return null;
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas-pro")).default;

      // Convertir todas las imágenes a data URLs para evitar problemas de CORS
      // html2canvas no puede capturar imágenes de R2 si no tiene CORS configurado
      // Se hace secuencial y con timeout por imagen para no saturar el navegador
      const images = content.querySelectorAll("img");
      const originalSrcs: string[] = [];
      for (const img of Array.from(images)) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(img.src, { signal: controller.signal });
          clearTimeout(timeout);
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          originalSrcs.push(img.src);
          img.src = dataUrl;
        } catch (err) {
          console.error("[report-pdf] Error convirtiendo imagen:", img.src, (err as Error).message);
        }
      }

      console.log("[report-pdf] Imágenes convertidas:", originalSrcs.length, "de", images.length);

      const canvas = await html2canvas(content, {
        scale: 1,
        useCORS: false,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: true,
        imageTimeout: 0,
      });

      console.log("[report-pdf] Canvas:", canvas.width, "x", canvas.height);

      // Restaurar los src originales
      Array.from(images).forEach((img, i) => {
        if (originalSrcs[i]) img.src = originalSrcs[i];
      });

      const imgWidth = 216; // Letter width in mm
      const pageHeight = 279; // Letter height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "letter");
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

      console.log("[report-pdf] PDF generado, páginas:", Math.ceil(imgHeight / pageHeight));

      return pdf.output("blob");
    } catch (err) {
      console.error("[report-pdf] Error generando PDF:", (err as Error).message, (err as Error).stack);
      throw err;
    }
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
      // 1. Forzar isFinal=true para que el DOM oculte el watermark "BORRADOR"
      //    y el footer diga "definitivo" ANTES de capturar el PDF
      setForceFinalForPdf(true);
      // Esperar a que React re-renderice con el nuevo estado
      await new Promise((r) => setTimeout(r, 100));

      // 2. Generar el PDF (ya sin watermark, footer dice "definitivo")
      const pdfBlob = await generatePdf();
      let reportUrl: string | null = null;

      // 3. Subir el PDF a R2
      if (pdfBlob) {
        reportUrl = await uploadPdf(pdfBlob);
      }

      // 4. Marcar el reporte como final con la URL del PDF
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
      // 5. Marcar la sesión como completed
      await updateInspectionSession(session.id, { status: "completed", ended_at: new Date().toISOString() });
      // 6. Emitir el claim_action INS
      if (session.claim_action_id) {
        await issueClaimAction(session.claim_action_id, profile?.id);
      }
    },
    onMutate: () => {
      setForceFinalForPdf(true);
    },
    onSettled: () => {
      setForceFinalForPdf(false);
    },
    onSuccess: () => {
      toast.success("Acta finalizada y PDF generado");
      // Al cerrar la inspección se optimizan imágenes, resumen PDFs y se ejecuta IA
      // en background (after()). No bloquean la UI del inspector ni del cliente.
      fetch("/api/inspection/evidences/process-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      fetch("/api/ai/process-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
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

  // Regenerar PDF para actas ya finalizadas (pisar el report_url existente)
  const regeneratePdfMutation = useMutation({
    mutationFn: async () => {
      // Forzar isFinal=true para que el DOM no tenga watermark
      setForceFinalForPdf(true);
      await new Promise((r) => setTimeout(r, 100));

      // Generar el PDF
      const pdfBlob = await generatePdf();
      if (!pdfBlob) throw new Error("No se pudo generar el PDF");

      // Subir el PDF a R2 (pisar el anterior)
      const reportUrl = await uploadPdf(pdfBlob);

      // Actualizar el reporte con la nueva URL
      if (report) {
        await updateReport(report.id, { status: "final", generated_at: new Date().toISOString(), report_url: reportUrl });
      }
    },
    onMutate: () => {
      setForceFinalForPdf(true);
    },
    onSettled: () => {
      setForceFinalForPdf(false);
    },
    onSuccess: () => {
      toast.success("PDF regenerado y actualizado");
      queryClient.invalidateQueries({ queryKey: ["report", sessionId] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al regenerar PDF"),
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
            .report-acta-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
            .report-acta-header .report-logo { max-height: 50px; max-width: 180px; }
            .report-acta-header .report-logo-text { font-size: 14px; font-weight: 700; color: #1a1a1a; }
            .report-acta-header .report-header-info { text-align: right; font-size: 10px; color: #555; }
            .report-acta-header .report-header-info .report-acta-h1 { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
            .report-acta-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; background: #f0f0f0; padding: 6px 10px; margin: 18px 0 8px; border-left: 4px solid #1a1a1a; }
            .report-field-row { display: flex; margin-bottom: 2px; }
            .report-field-label { font-weight: 600; color: #444; min-width: 200px; font-size: 10px; text-transform: uppercase; }
            .report-field-value { flex: 1; font-size: 10px; color: #222; }
            .report-statement { color: #222; line-height: 1.6; margin-bottom: 12px; }
            .report-statement p { margin: 0 0 8px; }
            .report-statement div { margin: 0 0 8px; }
            table.report-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            .report-table th.report-th, .report-table th.report-th-right { text-align: left; padding: 5px 6px; background: #f0f0f0; border: 1px solid #ccc; font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .report-table th.report-th-right { text-align: right; }
            .report-table td.report-td, .report-table td.report-td-right { padding: 5px 6px; border: 1px solid #ccc; font-size: 9px; }
            .report-table td.report-td-right { text-align: right; }
            .report-photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; }
            .report-photo-grid .report-photo-img { width: 100%; height: 130px; object-fit: contain; }
            .report-photo-label { font-size: 8px; color: #666; text-align: center; margin-top: 2px; }
            .report-sketch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 6px 0; }
            .report-sketch-grid .report-sketch-img { width: 100%; height: 140px; object-fit: contain; border: 1px solid #ccc; background: #fff; }
            .report-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
            .report-sig-box { text-align: center; }
            .report-sig-box .report-sig-img { max-height: 60px; max-width: 180px; border-bottom: 1px solid #333; padding-bottom: 3px; margin: 0 auto; }
            .report-sig-box .report-sig-name { font-size: 10px; font-weight: 600; margin-top: 3px; }
            .report-sig-box .report-sig-role { font-size: 9px; color: #666; }
            .report-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #999; }
            .report-cancellation-box { border: 2px solid #c0392b; background: #fdf2f2; padding: 10px; margin: 10px 0; border-radius: 4px; }
            .report-cancellation-box .report-cancellation-title { color: #c0392b; font-size: 12px; margin-bottom: 4px; }
            .report-doc-item { border: 1px solid #ccc; padding: 8px; margin-bottom: 8px; background: #fafafa; }
            .report-doc-item .report-doc-title { font-weight: 600; color: #444; font-size: 10px; margin-bottom: 4px; }
            .report-doc-item .report-doc-desc { color: #666; font-size: 9px; margin-bottom: 4px; }
            .report-doc-item .report-doc-summary { color: #444; font-style: italic; font-size: 9px; margin-bottom: 4px; border-left: 2px solid #ccc; padding-left: 8px; }
            .report-doc-item .report-doc-img { width: 100%; max-height: 190px; object-fit: contain; border: 1px solid #e0e0e0; }
            .report-doc-item .report-doc-placeholder { color: #888; font-style: italic; font-size: 9px; }
            .report-watermark { display: none; }
            @media print { body { padding: 15px 20px; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      // Cerrar la ventana después de imprimir (o cancelar) —
      // onafterprint se dispara tanto si se imprime como si se cancela
      printWindow.onafterprint = () => {
        printWindow.close();
      };
      // Fallback: si onafterprint no se dispara (algunos navegadores),
      // cerrar tras un tiempo prudencial
      setTimeout(() => {
        if (!printWindow.closed) printWindow.close();
      }, 1000);
    }, 300);
  };

  const evidences = useMemo(() => session.inspection_evidences || [], [session.inspection_evidences]);
  const damages = useMemo(() => session.inspection_damages || [], [session.inspection_damages]);
  const buildingDamages = useMemo(() => damages.filter((d) => d.damage_type !== "content"), [damages]);
  const contentDamages = useMemo(() => damages.filter((d) => d.damage_type === "content"), [damages]);
  const signatures = useMemo(() => session.inspection_signatures || [], [session.inspection_signatures]);
  const sketches = useMemo(() => session.damage_sketches || [], [session.damage_sketches]);
  // Filtro flexible: el type puede venir como "photo", "image", "video", "document", "pdf", etc.
  const isPhoto = (t: string) => ["photo", "image", "jpg", "jpeg", "png"].includes(t.toLowerCase());
  const isVideo = (t: string) => ["video", "mp4", "mov"].includes(t.toLowerCase());
  const isDoc = (t: string) => ["document", "pdf", "doc", "docx", "file"].includes(t.toLowerCase());
  const photos = useMemo(() => evidences.filter(e => isPhoto(e.type) && e.include_in_report !== false).slice(0, reportMaxPhotos ?? 18), [evidences, reportMaxPhotos]);
  const videos = useMemo(() => evidences.filter(e => isVideo(e.type)), [evidences]);
  const docs = useMemo(() => evidences.filter(e => isDoc(e.type)), [evidences]);
  const otherEvidences = useMemo(() => evidences.filter(e => !isPhoto(e.type) && !isVideo(e.type) && !isDoc(e.type)), [evidences]);
  // Evidencias no visuales para el resumen (excluye fotos, que van aparte)
  const nonPhotoEvidences = useMemo(() => evidences.filter(e => !isPhoto(e.type)), [evidences]);
  // Solo una firma por rol (insured + adjuster = máximo 2)
  const uniqueSignatures = useMemo(() => signatures.filter((s, i, arr) => arr.findIndex(x => x.role === s.role) === i), [signatures]);

  // Descargar ZIP: reporte PDF + todas las evidencias + croquis (sin firmas)
  const [zipPending, setZipPending] = useState(false);
  const handleDownloadZip = useCallback(async () => {
    setZipPending(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const baseName = claimLiquidationNumber || claimNumber || sessionId;
      const safeBase = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");

      // Helper: descargar archivo desde R2 vía proxy (evita CORS del browser)
      const fetchViaProxy = async (url: string): Promise<Blob | null> => {
        try {
          const proxyUrl = `/api/storage/proxy?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) return null;
          return await res.blob();
        } catch { return null; }
      };

      // 1. PDF del acta
      let pdfBlob: Blob | null = null;
      if (report?.report_url) {
        pdfBlob = await fetchViaProxy(report.report_url);
      }
      if (!pdfBlob) pdfBlob = await generatePdf();
      if (pdfBlob) zip.file(`acta-${safeBase}.pdf`, pdfBlob);

      // 2. Evidencias (fotos, videos, documentos, otras) — sin firmas
      const evidenceItems = [
        ...photos.map((e, i) => ({ ev: e, folder: "fotos", index: i + 1 })),
        ...videos.map((e, i) => ({ ev: e, folder: "videos", index: i + 1 })),
        ...docs.map((e, i) => ({ ev: e, folder: "documentos", index: i + 1 })),
        ...otherEvidences.map((e, i) => ({ ev: e, folder: "otras-evidencias", index: i + 1 })),
      ];

      let fetched = 0;
      await Promise.all(evidenceItems.map(async ({ ev, folder, index }) => {
        const blob = await fetchViaProxy(ev.url);
        if (!blob) return;
        // Usar el fileCode del sistema (muestra que pasó por el sistema)
        // ej: L-000000141-HINS-003-EVI-0001.png
        const fileCode = ev.metadata?.fileCode;
        const ext = (ev.metadata?.mimeType || ev.type || "bin").split("/").pop()?.split(";")[0] || "bin";
        const fileName = fileCode
          ? `${fileCode}.${ext}`
          : `${String(index).padStart(2, "0")}.${ext}`;
        zip.file(`evidencias/${folder}/${fileName}`, blob);
        fetched++;
      }));

      // 3. Croquis
      let sketchesFetched = 0;
      await Promise.all(sketches.map(async (sk, i) => {
        const blob = await fetchViaProxy(sk.sketch_url);
        if (!blob) return;
        const ext = sk.sketch_url.split(".").pop()?.split("?")[0] || "png";
        const label = sk.label ? `-${sk.label.replace(/[^a-zA-Z0-9-_]/g, "_")}` : "";
        const fileName = `croquis-${String(i + 1).padStart(2, "0")}${label}.${ext}`;
        zip.file(`croquis/${fileName}`, blob);
        sketchesFetched++;
      }));

      // 4. Generar y descargar el ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeBase}-inspeccion.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const total = fetched + sketchesFetched + (pdfBlob ? 1 : 0);
      if (total <= 1) {
        toast.warning(`ZIP con solo ${total} archivo. Verifique permisos de R2.`);
      } else {
        toast.success(`ZIP descargado: ${total} archivo(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar ZIP");
    } finally {
      setZipPending(false);
    }
  }, [report, generatePdf, photos, videos, docs, otherEvidences, sketches, claimLiquidationNumber, claimNumber, sessionId]);
  const companyName = profile?.company?.name || "—";
  const companyLogo = profile?.company?.logo_url || null;
  const companyPhone = profile?.company?.phone || null;
  const companyAddress = profile?.company?.address || null;
  const companyEmail = profile?.company?.email || null;

  // Estilos compartidos para campos
  const fieldRow = (label: string, value: string | undefined | null, key?: string) => (
    <div key={key} className="report-field-row">
      <span className="report-field-label app-body">{label}:</span>
      <span className="report-field-value app-body">{value || "—"}</span>
    </div>
  );

  return (
    <div className="app-stack">
      {/* Acciones — botones de una sola palabra */}
      <div className="report-actions">
        {!isFinal && (
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="pg-btn-platinum"
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
            className="pg-btn-platinum"
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
            <button type="button" onClick={handlePrint} className="pg-btn-platinum">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </button>
            <button type="button" onClick={handleDownload} className="pg-btn-platinum">
              <Download className="mr-2 h-4 w-4" /> Descargar
            </button>
            {canRegenerate && (
              <button
                type="button"
                onClick={() => regeneratePdfMutation.mutate()}
                disabled={regeneratePdfMutation.isPending}
                className="pg-btn-platinum"
                title="Generar el PDF nuevamente y reemplazar el archivo guardado"
              >
              {regeneratePdfMutation.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Regenerando...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Regenerar PDF</>
              )}
              </button>
            )}
            <button type="button" onClick={handleDownloadZip} disabled={zipPending} className="pg-btn-platinum">
              <Archive className="mr-2 h-4 w-4" /> {zipPending ? "Comprimiendo..." : "ZIP"}
            </button>
            <div className="report-final-badge">
              <CheckCircle2 className="h-5 w-5" />
              <span className="report-final-badge-text app-body">Acta Definitiva</span>
            </div>
          </>
        )}
      </div>

      {/* Preview del acta — vista tipo PDF con scroll */}
      {isLoading ? (
        <div className="report-loading app-panel app-body">Cargando...</div>
      ) : isError ? (
        <div className="report-loading app-panel app-body text-rose-600 dark:text-rose-400">
          Error al cargar el acta: {reportError?.message || "No se pudo obtener el acta."}
        </div>
      ) : (
        <div className="report-pdf-viewer">
          <div className="report-pdf-page" ref={printRef}>

          {/* Aviso de datos faltantes */}
          {!isCancellation && signatures.length === 0 && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-3 mb-4 text-amber-700 dark:text-amber-300 app-body text-sm">
              <strong>Faltan firmas:</strong> el asegurado y/o el ajustador aún no firman. El acta no se puede finalizar sin firmas.
            </div>
          )}
          {!isCancellation && damages.length === 0 && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-3 mb-4 text-amber-700 dark:text-amber-300 app-body text-sm">
              <strong>Faltan daños:</strong> no se han registrado daños en esta inspección. Revisa la pestaña de daños.
            </div>
          )}

          {/* Marca de agua BORRADOR */}
          {!isFinal && (
            <div className="report-watermark">
              <span className="report-watermark-text app-page-title">
                BORRADOR
              </span>
            </div>
          )}

          {/* ═══ HEADER ═══ */}
          <div className="report-acta-header">
            <div>
              {companyLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={companyLogo} alt={companyName} className="report-logo" />
              ) : (
                <div className="report-logo-text app-body">{companyName}</div>
              )}
              {companyPhone && <p className="report-header-meta app-body">Tel: {companyPhone}</p>}
              {companyAddress && <p className="report-header-meta app-body">{companyAddress}</p>}
              {companyEmail && <p className="report-header-meta app-body">{companyEmail}</p>}
            </div>
            <div className="report-header-info">
              <h1 className="report-acta-h1 app-body">ACTA DE INSPECCIÓN</h1>
              <p>Liquidación: {session.claim?.client_reference || "—"}</p>
              <p>Siniestro: {claimNumber || "—"}</p>
              <p>Correlativo: {shortInspectionNumber(session.inspection_number)}</p>
              <p>Número interno: {claimLiquidationNumber || "—"}</p>
            </div>
          </div>

          {/* ═══ CANCELACIÓN ═══ */}
          {isCancellation && (
            <div className="report-cancellation-box">
              <h3 className="report-cancellation-title app-body">Inspección Cancelada</h3>
              {fieldRow("Motivo", cancellationReason)}
              {fieldRow("Notas", cancellationNotes)}
              {fieldRow("Fecha", fmtDateTime(cancelledAt))}
            </div>
          )}

          {/* ═══ ANTECEDENTES GENERALES ═══ */}
          <div className="report-acta-title app-body">
            Antecedentes Generales
          </div>
          {fieldRow("Aseguradora", session.claim?.insurance_company?.name)}
          {fieldRow("Causa Origen", claimCause)}
          {fieldRow("Fecha de Siniestro", fmtDateTime(claimDate))}
          {fieldRow("Fecha de Inspección", fmtDateTime(session.inspection_date ? `${session.inspection_date}T${session.inspection_time || "00:00"}` : session.scheduled_at))}

          {/* ═══ ANTECEDENTES DEL ASEGURADO ═══ */}
          <div className="report-acta-title app-body">
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
              <div className="report-acta-title app-body">
                Detalle de los Hechos
              </div>
              <div
                className="report-statement app-body"
                dangerouslySetInnerHTML={{ __html: session.insured_statement.statement }}
              />
            </>
          )}

          {/* ═══ ANTECEDENTES DEL RIESGO ═══ */}
          {session.property_risk && Object.keys(session.property_risk).length > 0 && (
            <>
              <div className="report-acta-title app-body">
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
              <div className="report-acta-title app-body">
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
              <div className="report-acta-title app-body">
                Medidas de Seguridad
              </div>
              {Object.entries(session.security_measures).map(([key, val]) => {
                const labels: Record<string, string> = {
                  protections: "Protecciones", security_locks: "Cerraduras",
                  security_guards: "Guardias", alarms: "Alarmas",
                  cameras: "Cámaras", other_measures: "Otras",
                };
                const item = val as { has_it?: boolean; detail?: string };
                return fieldRow(labels[key] || key, item.has_it ? `Sí${item.detail ? ` — ${item.detail}` : ""}` : "No", key);
              })}
            </>
          )}

          {/* ═══ ANTECEDENTES POLICIALES ═══ */}
          {(session.police_report_number || session.firefighters_company) && (
            <>
              <div className="report-acta-title app-body">
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
              <div className="report-acta-title app-body">
                Terceros Afectados
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">Tipo</th>
                    <th className="report-th app-body">Nombre</th>
                    <th className="report-th app-body">RUT</th>
                    <th className="report-th app-body">Teléfono</th>
                    <th className="report-th app-body">Seguro</th>
                  </tr>
                </thead>
                <tbody>
                  {session.third_parties.map((tp, i) => (
                    <tr key={i}>
                      <td className="report-td app-body">{tp.party_type}</td>
                      <td className="report-td app-body">{tp.full_name || "—"}</td>
                      <td className="report-td app-body">{tp.rut || "—"}</td>
                      <td className="report-td app-body">{tp.phone || "—"}</td>
                      <td className="report-td app-body">{tp.has_insurance ? tp.insurance_company || "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ REGISTRO DE DAÑOS CONSTRUCTIVOS ═══ */}
          {buildingDamages.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Daños Constructivos ({buildingDamages.length})
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">Espacio</th>
                    <th className="report-th app-body">Categoría</th>
                    <th className="report-th app-body">Materialidad / Aclaración</th>
                    <th className="report-th app-body">Superficie / Daño</th>
                    <th className="report-th-right app-body">Monto</th>
                    <th className="report-th app-body">Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingDamages.map((d) => [
                    <tr key={d.id} className={d.observations ? "report-with-observation" : ""}>
                      <td className="report-td app-body">{d.dependency || "—"}</td>
                      <td className="report-td app-body">{d.subcategory || "—"}</td>
                      <td className="report-td app-body">{d.description || d.materiality_type || "—"}</td>
                      <td className="report-td app-body">{fmtQuantity(d)}</td>
                      <td className="report-td-right app-body">{fmtMoney(d.estimated_amount, d.currency)}</td>
                      <td className="report-td app-body">{SEVERITY_LABELS[d.severity] || d.severity}</td>
                    </tr>,
                    d.observations ? (
                      <tr key={`${d.id}-obs`} className="report-observation-row">
                        <td colSpan={6} className="report-td report-observation">
                          {d.observations}
                        </td>
                      </tr>
                    ) : null,
                  ])}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ REGISTRO DE DAÑOS DE CONTENIDO ═══ */}
          {contentDamages.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Daños de Contenido ({contentDamages.length})
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">Tipo de Bien</th>
                    <th className="report-th app-body">Producto</th>
                    <th className="report-th app-body">Marca/Modelo</th>
                    <th className="report-th app-body">Clasificación del Daño</th>
                    <th className="report-th-right app-body">Cantidad</th>
                    <th className="report-th-right app-body">Monto</th>
                    <th className="report-th app-body">Fecha Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {contentDamages.map((d) => [
                    <tr key={d.id} className={d.observations ? "report-with-observation" : ""}>
                      <td className="report-td app-body">{d.category || "—"}</td>
                      <td className="report-td app-body">{d.product || d.description || "—"}</td>
                      <td className="report-td app-body">{d.brand_model || "—"}</td>
                      <td className="report-td app-body">{SEVERITY_LABELS[d.severity] || d.severity}</td>
                      <td className="report-td-right app-body">{fmtQuantity(d)}</td>
                      <td className="report-td-right app-body">{fmtMoney(d.estimated_amount, d.currency)}</td>
                      <td className="report-td app-body">{fmtDate(d.purchase_date)}</td>
                    </tr>,
                    d.observations ? (
                      <tr key={`${d.id}-obs`} className="report-observation-row">
                        <td colSpan={7} className="report-td report-observation">
                          {d.observations}
                        </td>
                      </tr>
                    ) : null,
                  ])}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ OBSERVACIONES DEL INSPECTOR ═══ */}
          {session.inspector_observations && (
            <>
              <div className="report-acta-title app-body">
                Observaciones del Inspector
              </div>
              <div
                className="report-statement app-body"
                dangerouslySetInnerHTML={{ __html: session.inspector_observations }}
              />
            </>
          )}

          {/* ═══ RESUMEN DE EVIDENCIAS (no visuales — las fotos van aparte) ═══ */}
          {nonPhotoEvidences.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Resumen de Evidencias ({nonPhotoEvidences.length})
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">N°</th>
                    <th className="report-th app-body">Tipo</th>
                    <th className="report-th app-body">Archivo</th>
                    <th className="report-th app-body">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {nonPhotoEvidences.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="report-td app-body">{idx + 1}</td>
                      <td className="report-td app-body">{ev.type}</td>
                      <td className="report-td app-body">{ev.metadata?.originalName || "—"}</td>
                      <td className="report-td app-body">{ev.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ EVIDENCIAS FOTOGRÁFICAS ═══ */}
          {photos.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Evidencias Fotográficas ({photos.length})
              </div>
              <div className="report-photo-grid">
                {photos.map((ev, idx) => (
                  <div key={ev.id} className="report-photo-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ev.url} alt={`Foto ${idx + 1}`} className="report-photo-img" />
                    <p className="report-photo-label app-body">
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
              <div className="report-acta-title app-body">
                Videos ({videos.length})
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">N°</th>
                    <th className="report-th app-body">Archivo</th>
                    <th className="report-th app-body">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v, idx) => (
                    <tr key={v.id}>
                      <td className="report-td app-body">{idx + 1}</td>
                      <td className="report-td app-body">{v.metadata?.originalName || "—"}</td>
                      <td className="report-td app-body">{v.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ DOCUMENTOS ADJUNTOS ═══ */}
          {docs.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Documentos Adjuntos ({docs.length})
              </div>
              {docs.map((d, idx) => {
                const fileName = d.metadata?.originalName || `documento-${idx + 1}`;
                const mimeType = d.metadata?.mimeType || "";
                const pdfSummary = d.metadata?.pdfSummary as string | undefined;
                const pageCount = d.metadata?.pdfPageCount as number | undefined;
                const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                return (
                  <div key={d.id} className="report-doc-item">
                    <p className="report-doc-title app-body">
                      Documento {idx + 1}: {fileName}
                      {pageCount ? ` (${pageCount} ${pageCount === 1 ? "página" : "páginas"})` : ""}
                    </p>
                    {d.description && (
                      <p className="report-doc-desc app-body">{d.description}</p>
                    )}
                    {pdfSummary && (
                      <p className="report-doc-summary app-body">
                        {pdfSummary}
                      </p>
                    )}
                    {isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.url} alt={fileName} className="report-doc-img" />
                    ) : !pdfSummary && (
                      <p className="report-doc-placeholder app-body">
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
              <div className="report-acta-title app-body">
                Otras Evidencias ({otherEvidences.length})
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="report-th app-body">N°</th>
                    <th className="report-th app-body">Tipo</th>
                    <th className="report-th app-body">Archivo</th>
                    <th className="report-th app-body">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {otherEvidences.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="report-td app-body">{idx + 1}</td>
                      <td className="report-td app-body">{d.type}</td>
                      <td className="report-td app-body">{d.metadata?.originalName || "—"}</td>
                      <td className="report-td app-body">{d.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ═══ CROQUIS ═══ */}
          {sketches.length > 0 && (
            <>
              <div className="report-acta-title app-body">
                Croquis ({sketches.length})
              </div>
              <div className="report-sketch-grid">
                {sketches.map((sk, idx) => (
                  <div key={sk.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sk.sketch_url} alt={`Croquis ${idx + 1}`} className="report-sketch-img" />
                    <p className="report-photo-label app-body">
                      Croquis {idx + 1}{sk.label ? ` — ${sk.label}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ FIRMAS ═══ */}
          <>
            <div className="report-acta-title app-body">
              Firmas
            </div>
            <div className="report-sig-grid">
              {[
                { role: "insured" as const, label: "Asegurado" },
                { role: "adjuster" as const, label: "Inspector" },
              ].map(({ role, label }) => {
                const sig = uniqueSignatures.find((s) => s.role === role);
                return (
                  <div key={role} className="report-sig-box">
                    {sig ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sig.signature_url} alt={`Firma ${label}`} className="report-sig-img h-16 object-contain" />
                        <p className="report-sig-name app-body">{label}</p>
                        <p className="report-sig-role app-body">{fmtDateTime(sig.signed_at)}</p>
                      </>
                    ) : (
                      <>
                        <div className="report-sig-img h-16" />
                        <p className="report-sig-name app-body">{label}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>

          {/* ═══ FOOTER ═══ */}
          <div className="report-footer app-body">
            Documento {isFinal ? "definitivo" : "en borrador"} emitido por {companyName} · {new Date().toLocaleDateString("es-CL")}
            {isFinal && report?.generated_at && ` · Finalizado el ${fmtDateTime(report.generated_at)}`}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
