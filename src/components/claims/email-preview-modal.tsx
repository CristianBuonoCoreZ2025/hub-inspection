"use client";

import { Mail, X, Calendar, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Modal de solo lectura que muestra el contenido de un e-mail ya enviado.
 * Se abre al hacer click en una fila de email de la grilla de gestiones.
 */
export function EmailPreviewModal({ open, onOpenChange, log }: EmailPreviewModalProps) {
  const fullCode = useMemo(() => {
    if (!log) return "";
    return `EML-${String(log.correlativo).padStart(3, "0")}`;
  }, [log]);

  const htmlPreview = useMemo(() => {
    if (!log || log.body_format !== "html") return "";
    return wrapHtmlEmail({ body: log.body });
  }, [log]);

  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-lg" showCloseButton>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {fullCode}
          </DialogTitle>
        </div>
        <div className="modal-body space-y-3">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Para:</span>
              <span className="font-mono truncate">{log.to_address.join(", ") || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Enviado:</span>
              <span>{new Date(log.sent_at).toLocaleString("es-CL")}</span>
            </div>
            {log.cc_address.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">CC:</span>
                <span className="font-mono truncate">{log.cc_address.join(", ")}</span>
              </div>
            )}
            {log.bcc_address.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">CCO:</span>
                <span className="font-mono truncate">{log.bcc_address.join(", ")}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Por:</span>
              <span>{log.sent_by_user?.full_name || "—"}</span>
            </div>
          </div>

          {/* Asunto */}
          <div className="space-y-1">
            <p className="app-field-label">Asunto</p>
            <p className="app-body font-medium border-b border-border pb-1.5">{log.subject}</p>
          </div>

          {/* Cuerpo */}
          <div className="space-y-1">
            <p className="app-field-label">Cuerpo</p>
            {log.body_format === "html" && htmlPreview ? (
              <iframe
                title="email-body-preview"
                srcDoc={htmlPreview}
                className="w-full h-100 rounded border border-border bg-white"
              />
            ) : (
              <div className="rounded border border-border bg-muted/20 p-3 max-h-100 overflow-auto">
                <pre className="app-body whitespace-pre-wrap font-sans">{log.body}</pre>
              </div>
            )}
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Estado:</span>
            <span
              className={`px-1.5 rounded font-medium ${
                log.status === "sent"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : log.status === "queued"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {log.status}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <Button className="pg-btn-platinum" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
