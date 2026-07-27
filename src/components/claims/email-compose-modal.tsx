"use client";

import { useState, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, X, History, FileText, Code2, Sparkles, ChevronDown, ChevronUp, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HtmlEditor } from "@/components/ui/html-editor";
import { getEmailTemplatesForAction } from "@/services/email-template-actions";
import { EmailContactBook } from "@/components/claims/email-contact-book";
import { getSupabaseClient } from "@/lib/supabase/db";
import { toast } from "sonner";

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: Record<string, unknown> | null;
  action: {
    id: string;
    company_id: string;
    claim_id: string;
    action_template_id: string;
    action_data?: Record<string, unknown> | null;
  };
  businessLineId?: string | null;
}

/**
 * Modal de composición de email — modelo Outlook/Apple Mail.
 *
 * El correo ES la vista previa (WYSIWYG):
 *  - Header con gestión + código
 *  - Toolbar con plantilla + modo + contactos + historial
 *  - Metadata bar (Para / CC / CCO / Asunto) estilo Outlook
 *  - Canvas del correo:
 *    - HTML → HtmlEditor (TipTap) con toolbar completa (bold, tablas, colores, etc.)
 *    - Texto plano → textarea full-width
 *  - Footer con Cancelar + Enviar
 *
 * Modo Plantilla:
 *  - El subject y body vienen renderizados con datos del siniestro
 *  - Ambos son editables (el usuario puede modificar lo que quiera)
 *  - El formato (html/plain) lo define la plantilla (no cambiable)
 *  - Al enviar, se guarda la versión original Y la final para auditoría
 *
 * Modo Manual:
 *  - El usuario escribe subject y body desde cero
 *  - Toggle de formato: Texto plano / HTML
 *  - En HTML tiene la misma toolbar que el editor de plantillas
 *
 * Lo que se ve es lo que se envía.
 */
export function EmailComposeModal({
  open,
  onOpenChange,
  action,
  businessLineId,
}: EmailComposeModalProps) {
  const [mode, setMode] = useState<"template" | "manual">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [bcc, setBcc] = useState<string>("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [manualBodyFormat, setManualBodyFormat] = useState<"plain" | "html">("plain");
  const [showHistory, setShowHistory] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const htmlEditorRef = useRef<Editor | null>(null);
  const queryClient = useQueryClient();

  const changeMode = (newMode: "template" | "manual") => {
    setMode(newMode);
    setSubjectOverride(null);
    setBodyOverride(null);
  };
  const changeTemplate = (newId: string) => {
    setSelectedTemplateId(newId);
    setSubjectOverride(null);
    setBodyOverride(null);
  };

  const { data: templates } = useQuery({
    queryKey: ["email-templates-for-action", action.action_template_id, businessLineId, action.company_id],
    queryFn: () =>
      getEmailTemplatesForAction(action.action_template_id, {
        companyId: action.company_id,
        businessLineId: businessLineId ?? undefined,
        includeInactive: false,
      }),
    enabled: open,
  });

  interface EmailLogLite {
    id: string;
    to_address: string[];
    subject: string;
    status: string;
    sent_at: string;
    correlativo: number;
    parent_action_code: string | null;
  }

  const { data: logs } = useQuery<EmailLogLite[]>({
    queryKey: ["email-logs", action.id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("email_logs")
        .select("id, to_address, subject, status, sent_at, correlativo, parent_action_code")
        .eq("claim_action_id", action.id)
        .order("sent_at", { ascending: false });
      return (data || []) as EmailLogLite[];
    },
    enabled: open && showHistory,
  });

  const activeTemplates = useMemo(() => templates?.filter((t) => t.is_active) || [], [templates]);

  const defaultTemplateId = useMemo(() => {
    if (activeTemplates.length === 0) return "";
    const def = activeTemplates.find((t) =>
      (t.actions || []).some(
        (a) => a.action_template_id === action.action_template_id && a.is_default
      )
    );
    return def?.id || activeTemplates[0].id;
  }, [activeTemplates, action.action_template_id]);

  const effectiveTemplateId = selectedTemplateId || defaultTemplateId;

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["email-preview", action.id, mode, effectiveTemplateId, manualBodyFormat],
    queryFn: async () => {
      try {
        if (mode === "manual") {
          return {
            subject: subjectOverride ?? "",
            body: bodyOverride ?? "",
            body_format: manualBodyFormat,
          };
        }
        if (!effectiveTemplateId) {
          return { subject: "", body: "", body_format: "plain" as const };
        }
        const res = await fetch("/api/email/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimActionId: action.id,
            emailTemplateId: effectiveTemplateId,
          }),
        });
        if (!res.ok) return { subject: "", body: "", body_format: "plain" as const };
        return await res.json();
      } catch {
        return { subject: "", body: "", body_format: "plain" as const };
      }
    },
    enabled: open,
    staleTime: 0,
    retry: 1,
  });

  const rendered = {
    subject: previewData?.subject ?? "",
    body: previewData?.body ?? "",
    body_format: (previewData?.body_format ?? "plain") as "plain" | "html",
  };

  const effectiveSubject = subjectOverride ?? rendered.subject;
  const effectiveBody = bodyOverride ?? rendered.body;
  const effectiveFormat = mode === "manual" ? manualBodyFormat : rendered.body_format;

  // Versión original de la plantilla (para auditoría — se envía al backend)
  const templateOriginalSubject = mode === "template" ? rendered.subject : null;
  const templateOriginalBody = mode === "template" ? rendered.body : null;
  const templateOriginalFormat = mode === "template" ? rendered.body_format : null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toArr = to.split(",").map((s) => s.trim()).filter(Boolean);
      const ccArr = cc.split(",").map((s) => s.trim()).filter(Boolean);
      const bccArr = bcc.split(",").map((s) => s.trim()).filter(Boolean);

      const payload: Record<string, unknown> = {
        claimActionId: action.id,
        to: toArr,
        cc: ccArr,
        bcc: bccArr,
      };

      if (mode === "template" && effectiveTemplateId) {
        // Modo plantilla: SIEMPRE pasamos emailTemplateId (incluso si editó)
        // + la versión original renderizada para auditoría
        payload.emailTemplateId = effectiveTemplateId;
        payload.templateSubject = templateOriginalSubject;
        payload.templateBody = templateOriginalBody;
        payload.templateBodyFormat = templateOriginalFormat;
        // Si el usuario editó, pasamos también la versión final
        if (subjectOverride !== null || bodyOverride !== null) {
          payload.manualSubject = effectiveSubject;
          payload.manualBody = effectiveBody;
          payload.manualBodyFormat = effectiveFormat;
        }
      } else {
        // Modo manual puro
        payload.manualSubject = effectiveSubject;
        payload.manualBody = effectiveBody;
        payload.manualBodyFormat = effectiveFormat;
      }

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error enviando e-mail");
      return json;
    },
    onSuccess: () => {
      toast.success("E-mail enviado");
      queryClient.invalidateQueries({ queryKey: ["email-logs-by-claim", action.claim_id] });
      queryClient.invalidateQueries({ queryKey: ["email-logs", action.id] });
      setTo("");
      setCc("");
      setBcc("");
      setSubjectOverride(null);
      setBodyOverride(null);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRecipientToField = (email: string, field: "to" | "cc" | "bcc") => {
    const setter = field === "to" ? setTo : field === "cc" ? setCc : setBcc;
    const current = field === "to" ? to : field === "cc" ? cc : bcc;
    const existing = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (existing.includes(email)) return;
    setter([...existing, email].join(", "));
    if (field !== "to") setShowCcBcc(true);
  };

  const templateItems = useMemo(
    () => [
      { value: "__none", label: "Seleccionar..." },
      ...activeTemplates.map((t) => {
        const isDefault = (t.actions || []).some(
          (a) => a.action_template_id === action.action_template_id && a.is_default
        );
        return { value: t.id, label: `${t.name}${isDefault ? " · default" : ""}` };
      }),
    ],
    [activeTemplates, action.action_template_id]
  );

  const canSend =
    to.trim().length > 0 &&
    effectiveSubject.trim().length > 0 &&
    effectiveBody.trim().length > 0 &&
    !sendMutation.isPending;

  const gestionCode = (action.action_data as Record<string, unknown> | null)?.codigo as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-xl p-0! flex flex-col" showCloseButton={false}>

        {/* ═══ 1. HEADER — idéntico al preview ═══ */}
        <div className="p-4 border-b border-border bg-background flex items-start justify-between gap-3">
          <DialogTitle className="flex items-start gap-3 m-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">Enviar Correo</span>
              {gestionCode && (
                <span className="text-[10px] text-muted-foreground">Gestión: {gestionCode}</span>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">componer y enviar</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => onOpenChange(false)} title="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ═══ 2. TOOLBAR — plantilla + modo + contactos + historial ═══ */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 flex-wrap">
          {/* Tabs: Plantilla / A mano */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 border border-border">
            <button
              type="button"
              onClick={() => changeMode("template")}
              data-active={mode === "template"}
              className={`flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-all ${
                mode === "template" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3 w-3" />
              Plantilla
            </button>
            <button
              type="button"
              onClick={() => {
                changeMode("manual");
                setSelectedTemplateId("");
                setManualBodyFormat("plain");
              }}
              data-active={mode === "manual"}
              className={`flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md transition-all ${
                mode === "manual" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              A mano
            </button>
          </div>

          {/* Select de plantilla (solo modo template) */}
          {mode === "template" && (
            <Select
              value={effectiveTemplateId || "__none"}
              onValueChange={(v) => changeTemplate(v === "__none" || !v ? "" : v)}
              items={templateItems}
            >
              <SelectTrigger className="app-input h-7 w-50">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Seleccionar...</SelectItem>
                {activeTemplates.map((t) => {
                  const isDefault = (t.actions || []).some(
                    (a) => a.action_template_id === action.action_template_id && a.is_default
                  );
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {isDefault ? " · default" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Toggle Texto/HTML (solo modo manual) */}
          {mode === "manual" && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setManualBodyFormat("plain")}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  manualBodyFormat === "plain" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-2.5 w-2.5" />
                Texto
              </button>
              <button
                type="button"
                onClick={() => setManualBodyFormat("html")}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  manualBodyFormat === "html" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-2.5 w-2.5" />
                HTML
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Historial */}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Historial de envíos"
          >
            <History className="h-3 w-3" />
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* Toggle Contact Book */}
          <button
            type="button"
            onClick={() => setShowContacts((v) => !v)}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              showContacts ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Libreta de contactos"
          >
            <Contact className="h-3 w-3" />
            Contactos
          </button>
        </div>

        {/* Historial (colapsable) */}
        {showHistory && (
          <div className="px-4 py-2 border-b border-border bg-muted/10">
            {logs && logs.length > 0 && (
              <div className="rounded-lg border border-border p-2 space-y-1 max-h-40 overflow-auto bg-background/60">
                {logs.map((log) => (
                  <div key={log.id} className="text-[11px] flex items-center justify-between gap-2 border-b last:border-0 pb-1 border-border/30">
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">
                        EML-{String(log.correlativo).padStart(3, "0")}: {log.subject}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {log.to_address.join(", ")} · {new Date(log.sent_at).toLocaleString("es-CL")}
                      </span>
                    </div>
                    <span className={`shrink-0 px-1.5 rounded text-[10px] font-medium ${
                      log.status === "sent" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : log.status === "queued" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {logs && logs.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">No hay envíos registrados.</p>
            )}
          </div>
        )}

        {/* ═══ 3. METADATA BAR — Para/CC/CCO/Asunto (estilo Outlook, mismo patrón que preview) ═══ */}
        <div className="px-4 py-3 border-b border-border bg-muted/20 text-[11px]">
          {/* Para */}
          <div className="flex items-baseline gap-2 py-0.5">
            <span className="text-muted-foreground font-medium shrink-0 min-w-14">Para</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinatario@ejemplo.com"
              className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px]"
            />
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                CC / CCO
              </button>
            )}
          </div>

          {/* CC / CCO (colapsable) */}
          {showCcBcc && (
            <>
              <div className="flex items-baseline gap-2 py-0.5">
                <span className="text-muted-foreground font-medium shrink-0 min-w-14">CC</span>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="con copia"
                  className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px]"
                />
              </div>
              <div className="flex items-baseline gap-2 py-0.5">
                <span className="text-muted-foreground font-medium shrink-0 min-w-14">CCO</span>
                <input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="con copia oculta"
                  className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px]"
                />
              </div>
            </>
          )}

          <div className="border-t border-border/30 my-0.5" />

          {/* Asunto */}
          <div className="flex items-baseline gap-2 py-0.5">
            <span className="text-muted-foreground font-medium shrink-0 min-w-14">Asunto</span>
            <input
              value={effectiveSubject}
              onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder="Asunto del correo"
              className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px] font-medium"
            />
          </div>
        </div>

        {/* ═══ 4. CANVAS DEL CORREO + CONTACT BOOK (flex row) ═══ */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas WYSIWYG (lo que ves es lo que envías) */}
          <div className="flex-1 overflow-y-auto w-full bg-muted/12">
            {previewLoading && mode === "template" ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-[11px]">Generando correo…</p>
              </div>
            ) : effectiveFormat === "html" ? (
              <div className="w-full bg-white mx-auto" style={{ maxWidth: 680, minHeight: 400, boxShadow: "0 4px 20px rgb(0 0 0 / 0.06)" }}>
                <HtmlEditor
                  value={effectiveBody || ""}
                  onChange={(html) => setBodyOverride(html)}
                  editorRef={htmlEditorRef}
                  placeholder="Escribí el cuerpo del correo…"
                />
              </div>
            ) : (
              <div className="w-full bg-white mx-auto" style={{ maxWidth: 680, minHeight: 400, boxShadow: "0 4px 20px rgb(0 0 0 / 0.06)" }}>
                <textarea
                  value={effectiveBody}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  placeholder="Escribí el cuerpo del correo…"
                  className="w-full bg-white border-0 outline-none p-8 text-sm leading-relaxed text-foreground resize-none"
                  style={{ minHeight: 400 }}
                />
              </div>
            )}
            <div style={{ height: 24, flexShrink: 0 }} />
          </div>

          {/* Contact Book — panel lateral deslizable */}
          <EmailContactBook
            claimId={action.claim_id}
            open={showContacts}
            onClose={() => setShowContacts(false)}
            onAddRecipient={addRecipientToField}
          />
        </div>

        {/* ═══ 5. FOOTER — Cancelar + Enviar (pg-btn-platinum) ═══ */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-background">
          <Button className="pg-btn-platinum" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button
            className="pg-btn-platinum"
            disabled={!canSend}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
