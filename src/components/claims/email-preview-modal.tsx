"use client";

import { Mail, X, Download, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { wrapHtmlEmail } from "@/services/email-render";
import { useMemo } from "react";

interface EmailLogLite {
  id: string;
  to_address: string[];
  cc_address: string[];
  bcc_address: string[];
  subject: string;
  body: string;
  body_format: "plain" | "html";
  status: string;
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
  const fullCode = useMemo(() => {
    if (!log) return "";
    return `EML-${String(log.correlativo).padStart(3, "0")}`;
  }, [log]);

  const htmlPreview = useMemo(() => {
    if (!log || log.body_format !== "html") return "";
    return wrapHtmlEmail({ body: log.body });
  }, [log]);

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
          ${log.parent_action_code ? metaRow("Gestión", log.parent_action_code) : ""}
          ${metaRow("email", fullCode)}
          ${metaRow("Para", log.to_address.join(", "))}
          ${metaRow("CC", log.cc_address.join(", "))}
          ${metaRow("CCO", log.bcc_address.join(", "))}
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
    setTimeout(() => printWin.print(), 300);
  };

  const handleDownload = () => {
    if (!log) return;
    const date = new Date(log.sent_at);
    const eml = [
      `From: ${log.sent_by_user?.email || "noreply@hub-inspection.cl"}`,
      `To: ${log.to_address.join(", ")}`,
      log.cc_address.length > 0 ? `Cc: ${log.cc_address.join(", ")}` : "",
      log.bcc_address.length > 0 ? `Bcc: ${log.bcc_address.join(", ")}` : "",
      `Subject: ${log.subject}`,
      `Date: ${date.toUTCString()}`,
      `X-Correlativo: ${fullCode}`,
      log.parent_action_code ? `X-Gestion: ${log.parent_action_code}` : "",
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">{log.subject || "(sin asunto)"}</span>
              <span className="text-[10px] text-muted-foreground">
                {log.parent_action_code ? `Gestión: ${log.parent_action_code}` : ""}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">email: {fullCode}</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
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

        {/* Metadatos: Para, CC, CCO, Fecha */}
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
            <span className="text-muted-foreground font-medium min-w-10">CCO</span>
            <span className="text-foreground break-all">{log.bcc_address.length > 0 ? log.bcc_address.join(", ") : ""}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground font-medium min-w-10">Fecha</span>
            <span className="text-foreground">{dateStr}</span>
          </div>
        </div>

        {/* 2. ÁREA DE SCROLL (Único scroll de la ventana) */}
        <div className="flex-1 overflow-y-auto w-full min-h-0">

          {/* 3. EL CORREO EN SÍ (Sin cajas extra alrededor) */}
          <div className="w-full min-h-full">
            {log.body_format === "html" && htmlPreview ? (
              <iframe
                title="email-body-preview"
                srcDoc={htmlPreview}
                className="w-full bg-white block flex-1"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="p-8 pb-16 text-foreground text-sm leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans">{log.body}</pre>
                <div style={{ height: "20px", minHeight: "20px", flexShrink: 0 }} />
              </div>
            )}
          </div>

          {/* Espaciador final — aire inferior para que el scroll no choque abajo */}
          <div style={{ height: "20px", minHeight: "20px", flexShrink: 0 }} />

        </div>
      </DialogContent>
    </Dialog>
  );
}
