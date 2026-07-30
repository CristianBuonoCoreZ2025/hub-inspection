"use client";

import { Mail, X, Download, Printer, RotateCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { wrapHtmlEmail } from "@/services/email-render";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Extrae solo el código de gestión del formato compuesto {liquidation}-{code}.
 *  Ej: "L-000000141-HINS-003" → "HINS-003" */
function shortActionCode(code: string | null | undefined): string {
  if (!code) return "";
  const parts = code.split("-");
  if (parts.length >= 3) return parts.slice(2).join("-");
  return code;
}

/** Extrae el número de liquidación del formato compuesto {liquidation}-{code}.
 *  Ej: "L-000000141-HINS-003" → "L-000000141" */
function liquidationFromCode(code: string | null | undefined): string {
  if (!code) return "";
  const parts = code.split("-");
  if (parts.length >= 3) return `${parts[0]}-${parts[1]}`;
  return "";
}

interface EmailLogLite {
  id: string;
  claim_id: string;
  to_address: string[];
  cc_address: string[];
  bcc_address: string[];
  subject: string;
  body: string;
  body_format: "plain" | "html";
  status: string;
  provider_response: Record<string, unknown> | null;
  sent_at: string;
  correlativo: number;
  parent_action_code: string | null;
  sent_by_user?: { id: string; full_name: string; email: string } | null;
}

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: EmailLogLite | null;
}

export function EmailPreviewModal({ open, onOpenChange, log }: EmailPreviewModalProps) {
  const queryClient = useQueryClient();
  const [showLogDetail, setShowLogDetail] = useState(false);

  const fullCode = useMemo(() => {
    if (!log) return "";
    return `EML-${String(log.correlativo).padStart(3, "0")}`;
  }, [log]);

  const htmlPreview = useMemo(() => {
    if (!log || log.body_format !== "html") return "";
    return wrapHtmlEmail({ body: log.body });
  }, [log]);

  const isFailed = log?.status === "failed";

  // Extraer mensaje legible del provider_response
  const providerErrorMsg = useMemo(() => {
    if (!log?.provider_response) return "Error desconocido del proveedor";
    const pr = log.provider_response;
    return (
      (pr.message as string | undefined) ||
      (pr.error as string | undefined) ||
      JSON.stringify(pr, null, 2)
    );
  }, [log]);

  // Mutación de reenvío
  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailLogId: log!.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error reenviando e-mail");
      return json;
    },
    onSuccess: () => {
      toast.success("Correo reenviado");
      // Invalidar queries de email logs para que la lista se actualice
      if (log?.claim_id) {
        queryClient.invalidateQueries({ queryKey: ["email-logs-by-claim", log.claim_id] });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrint = () => {
    if (!log) return;
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) return;

    const dateStrPrint = new Date(log.sent_at).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });

    const metaRow = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;font-size:11px;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;width:60px;">${label}</td><td style="padding:4px 0;font-size:11px;color:#111827;vertical-align:top;">${value || "—"}</td></tr>`;

    const metadataHtml = `
      <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:8px;">${log.subject || "(sin asunto)"}</div>
        <table style="border-collapse:collapse;width:100%;">
          ${log.parent_action_code ? metaRow("Liquidación", liquidationFromCode(log.parent_action_code)) : ""}
          ${log.parent_action_code ? metaRow("Gestión", shortActionCode(log.parent_action_code)) : ""}
          ${metaRow("email", fullCode)}
          ${metaRow("Para", log.to_address.join(", "))}
          ${metaRow("CC", log.cc_address.join(", "))}
          ${metaRow("Fecha", dateStrPrint)}
        </table>
      </div>
    `;

    const bodyHtml = log.body_format === "html"
      ? log.body
      : `<pre style="font-family:sans-serif;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.6;color:#111827;">${log.body.replace(/</g, "&lt;")}</pre>`;

    printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${fullCode} — ${log.subject}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; }
  img { max-width: 100%; }
  a { color: #2563eb; }
  .callout { background: #f8fafc; border-left: 3px solid #0080C8; padding: 14px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
  .magic-link-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .magic-link-box a { display: inline-block; padding: 10px 18px; background: #0080C8; color: #ffffff !important; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; }
  h1, h2, h3 { margin: 0 0 12px 0; font-weight: 600; line-height: 1.3; }
  h1 { font-size: 22px; color: #0f172a; }
  h2 { font-size: 18px; color: #1e293b; }
  h3 { font-size: 15px; color: #334155; }
  p { margin: 0 0 12px 0; }
  ul, ol { margin: 0 0 12px 0; padding-left: 20px; }
  li { margin-bottom: 6px; }
  strong { font-weight: 600; }
</style>
</head>
<body>
${metadataHtml}
${bodyHtml}
</body>
</html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      // Cerrar la ventana después de imprimir (o cancelar) —
      // onafterprint se dispara tanto si se imprime como si se cancela
      printWin.onafterprint = () => {
        printWin.close();
      };
      // Fallback: si onafterprint no se dispara (algunos navegadores),
      // cerrar tras un tiempo prudencial
      setTimeout(() => {
        if (!printWin.closed) printWin.close();
      }, 1000);
    }, 300);
  };

  const handleDownload = () => {
    if (!log) return;
    const date = new Date(log.sent_at);
    const eml = [
      `From: ${log.sent_by_user?.email || "noreply@hub-inspection.cl"}`,
      `To: ${log.to_address.join(", ")}`,
      log.cc_address.length > 0 ? `Cc: ${log.cc_address.join(", ")}` : "",
      `Subject: ${log.subject}`,
      `Date: ${date.toUTCString()}`,
      `X-Correlativo: ${fullCode}`,
      log.parent_action_code ? `X-Liquidacion: ${liquidationFromCode(log.parent_action_code)}` : "",
      log.parent_action_code ? `X-Gestion: ${shortActionCode(log.parent_action_code)}` : "",
      "MIME-Version: 1.0",
      log.body_format === "html"
        ? 'Content-Type: text/html; charset=UTF-8'
        : 'Content-Type: text/plain; charset=UTF-8',
      "",
      log.body,
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = log.parent_action_code
      ? `${log.parent_action_code}_${fullCode}.eml`
      : `${fullCode}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!log) return null;

  const dateStr = new Date(log.sent_at).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-email p-0! flex flex-col" showCloseButton={false}>

        {/* 1. HEADER DEL MODAL (Fijo arriba) */}
        <div className="p-4 border-b border-border bg-background flex items-start justify-between gap-3 shrink-0">
          <DialogTitle className="flex items-start gap-3 m-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 email-icon-gradient">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="email-header-title">{log.subject || "(sin asunto)"}</span>
              {log.parent_action_code && (
                <span className="email-header-meta">
                  Liquidación {liquidationFromCode(log.parent_action_code)}
                </span>
              )}
              <span className="email-header-subtitle">
                {log.parent_action_code ? `Gestión: ${shortActionCode(log.parent_action_code)}` : ""}
              </span>
              <span className="email-header-meta">email: {fullCode}</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {isFailed && (
              <button
                type="button"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                title="Reenviar correo"
                className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                {resendMutation.isPending ? "Reenviando..." : "Reenviar"}
              </button>
            )}
            <button type="button" onClick={handleDownload} title="Descargar .eml" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handlePrint} title="Imprimir" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onOpenChange(false)} title="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Banner de error (solo si status = failed) */}
        {isFailed && (
          <div className="px-4 py-3 border-b border-rose-200 bg-rose-50 shrink-0">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-rose-900">
                    Error en el envío
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLogDetail((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 transition-colors"
                  >
                    {showLogDetail ? "Ocultar detalle" : "Ver log"}
                    {showLogDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                <p className="text-[11px] text-rose-800 mt-1 wrap-break-word">
                  {providerErrorMsg}
                </p>
                {showLogDetail && (
                  <pre className="mt-2 p-2 bg-rose-100/70 rounded text-[10px] text-rose-900 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                    {JSON.stringify(log.provider_response, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Metadatos: Para, CC, Fecha */}
        <div className="px-4 py-3 border-b border-border bg-muted/20 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground font-medium min-w-10">Para</span>
            <span className="text-foreground break-all">{log.to_address.join(", ") || "—"}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground font-medium min-w-10">CC</span>
            <span className="text-foreground break-all">{log.cc_address.length > 0 ? log.cc_address.join(", ") : ""}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground font-medium min-w-10">Fecha</span>
            <span className="text-foreground">{dateStr}</span>
          </div>
        </div>

        {/* 2. ÁREA DEL CORREO — scroll interno, sin scroll externo del modal */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          {log.body_format === "html" && htmlPreview ? (
            <div className="flex-1 p-4 pb-5 overflow-hidden">
              <iframe
                title="email-body-preview"
                srcDoc={htmlPreview}
                className="w-full h-full bg-white block"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              <pre className="whitespace-pre-wrap font-sans">{log.body}</pre>
              <div className="email-bottom-spacer" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
