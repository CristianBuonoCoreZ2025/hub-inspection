"use client";

import { useState, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, X, History, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HtmlEditor } from "@/components/ui/html-editor";
import { getEmailTemplatesForAction } from "@/services/email-template-actions";
import { fetchClaimContacts, type EmailContact } from "@/services/email-contacts";
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
    gestion_codigo?: string;
    gestion_nombre?: string;
  };
  businessLineId?: string | null;
}

/**
 * Modal de composición de email — modelo Outlook 365.
 *
 * Layout (de arriba a abajo):
 *  1. Header compacto (icono + título + gestión + cerrar)
 *  2. Action bar: [Enviar] [Plantilla ▼ si hay]     [Historial]
 *  3. Campos: Para → CC → Asunto (con autocomplete de libreta)
 *  4. Toolbar de formato (Bold, tablas, colores…) — solo en HTML
 *  5. Body del correo (HtmlEditor o textarea)
 *
 * La libreta de contactos se invoca de 2 formas:
 *  - Escribiendo en Para/CC: autocomplete con sugerencias filtradas
 *  - Botón [Users] al lado de cada campo: abre popover con la libreta completa
 */

/**
 * Botón de libreta de contactos para un campo de destinatario.
 * Abre un popover con todos los contactos del siniestro, agrupados.
 * Click en un contacto → lo agrega al campo correspondiente.
 */
function ContactBookButton({
  contacts,
  onPick,
}: {
  contacts: EmailContact[];
  onPick: (email: string) => void;
}) {
  if (contacts.length === 0) return null;

  // Agrupar contactos por grupo
  const groups: Record<string, EmailContact[]> = {};
  for (const c of contacts) {
    const g = c.group;
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  }
  const groupLabels: Record<string, string> = {
    participants: "Participantes",
    team: "Equipo",
    advisor: "Asesor",
    global: "Directorio",
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title="Abrir libreta de contactos"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        }
      />
      <PopoverContent align="end" sideOffset={4} className="w-80 max-h-80 overflow-auto p-0">
        <div className="px-3 py-2 border-b border-border bg-muted/30 sticky top-0 z-10">
          <span className="text-[11px] font-semibold text-foreground">Libreta de contactos</span>
        </div>
        <div className="py-1">
          {Object.entries(groups).map(([groupKey, groupContacts]) => (
            <div key={groupKey}>
              <div className="px-3 py-1 bg-muted/20 sticky top-7 z-[5]">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupLabels[groupKey] || groupKey}
                </span>
              </div>
              {groupContacts.map((contact) => {
                const initials = (contact.fullName || contact.email)
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <button
                    key={contact.email + (contact.fullName || "")}
                    type="button"
                    onClick={() => onPick(contact.email)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors"
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-medium text-white shrink-0 email-icon-gradient"
                    >
                      {initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {contact.fullName || contact.email}
                      </span>
                      {contact.fullName && (
                        <span className="text-[10px] text-muted-foreground truncate font-mono">
                          {contact.email}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {contact.roles.slice(0, 2).map((role) => (
                        <span
                          key={role}
                          className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                            contact.isInternal
                              ? "bg-primary/12 text-primary"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmailComposeModal({
  open,
  onOpenChange,
  claim,
  action,
  businessLineId,
}: EmailComposeModalProps) {
  const [mode, setMode] = useState<"template" | "manual">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [manualBodyFormat] = useState<"plain" | "html">("html");
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const htmlEditorRef = useRef<Editor | null>(null);
  const queryClient = useQueryClient();

  // ─── Autocomplete state ───
  const [activeField, setActiveField] = useState<"to" | "cc" | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");

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

  // ─── Libreta de contactos para autocomplete ───
  const { data: contacts } = useQuery<EmailContact[]>({
    queryKey: ["email-contacts", action.claim_id],
    queryFn: () => fetchClaimContacts(action.claim_id),
    enabled: open,
    staleTime: 60_000,
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

  // ─── Si no hay plantillas vinculadas, forzar modo manual ───
  // (derivado, sin useEffect — si no hay plantillas, siempre es manual)
  const effectiveMode = activeTemplates.length === 0 ? "manual" : mode;

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
    queryKey: ["email-preview", action.id, effectiveMode, effectiveTemplateId, manualBodyFormat],
    queryFn: async () => {
      try {
        if (effectiveMode === "manual") {
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
  const effectiveFormat = effectiveMode === "manual" ? manualBodyFormat : rendered.body_format;

  // Versión original de la plantilla (para auditoría — se envía al backend)
  const templateOriginalSubject = effectiveMode === "template" ? rendered.subject : null;
  const templateOriginalBody = effectiveMode === "template" ? rendered.body : null;
  const templateOriginalFormat = effectiveMode === "template" ? rendered.body_format : null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toArr = to.split(",").map((s) => s.trim()).filter(Boolean);
      const ccArr = cc.split(",").map((s) => s.trim()).filter(Boolean);

      const payload: Record<string, unknown> = {
        claimActionId: action.id,
        to: toArr,
        cc: ccArr,
      };

      if (effectiveMode === "template" && effectiveTemplateId) {
        payload.emailTemplateId = effectiveTemplateId;
        payload.templateSubject = templateOriginalSubject;
        payload.templateBody = templateOriginalBody;
        payload.templateBodyFormat = templateOriginalFormat;
        if (subjectOverride !== null || bodyOverride !== null) {
          payload.manualSubject = effectiveSubject;
          payload.manualBody = effectiveBody;
          payload.manualBodyFormat = effectiveFormat;
        }
      } else {
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
      setSubjectOverride(null);
      setBodyOverride(null);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRecipientToField = (email: string, field: "to" | "cc") => {
    const setter = field === "to" ? setTo : setCc;
    const current = field === "to" ? to : cc;
    const existing = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (existing.includes(email)) return;
    setter([...existing, email].join(", "));
    setAutocompleteQuery("");
    setActiveField(null);
  };

  // ─── Autocomplete: filtrar contactos por lo que se está escribiendo ───
  // Extrae el último fragmento después de la última coma
  const getLastFragment = (text: string) => {
    const parts = text.split(",");
    return parts[parts.length - 1].trim();
  };

  const autocompleteSuggestions = useMemo(() => {
    if (!activeField || !contacts) return [];
    const query = autocompleteQuery.toLowerCase().trim();
    if (query.length < 1) return [];
    return contacts
      .filter(
        (c) =>
          c.email.toLowerCase().includes(query) ||
          (c.fullName?.toLowerCase().includes(query) ?? false) ||
          c.roles.some((r) => r.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [activeField, contacts, autocompleteQuery]);

  const handleRecipientInput = (value: string, field: "to" | "cc") => {
    const setter = field === "to" ? setTo : setCc;
    setter(value);
    setActiveField(field);
    setAutocompleteQuery(getLastFragment(value));
  };

  const handleRecipientBlur = () => {
    // Delay para permitir click en sugerencia
    setTimeout(() => {
      setActiveField(null);
      setAutocompleteQuery("");
    }, 200);
  };

  const canSend =
    to.trim().length > 0 &&
    effectiveSubject.trim().length > 0 &&
    effectiveBody.trim().length > 0 &&
    !sendMutation.isPending;

  const gestionCode = action.gestion_codigo || (action.action_data as Record<string, unknown> | null)?.codigo as string | undefined;
  const gestionNombre = action.gestion_nombre;
  const liquidationNumber = (claim as Record<string, unknown> | null)?.liquidation_number as string | undefined;
  const hasTemplates = activeTemplates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-email p-0! flex flex-col" showCloseButton={false}>

        {/* ═══ 1. HEADER — idéntico al preview (mismo alto y dimensiones) ═══ */}
        <div className="p-4 border-b border-border bg-background flex items-start justify-between gap-3 shrink-0">
          <DialogTitle className="flex items-start gap-3 m-0 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 email-icon-gradient">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground leading-tight truncate">
                {gestionCode ? `Gestión ${gestionCode}` : "Correo"}
              </span>
              {gestionNombre && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {gestionNombre}
                </span>
              )}
              {liquidationNumber && (
                <span className="text-[10px] text-muted-foreground truncate font-mono">
                  Liquidación {liquidationNumber}
                </span>
              )}
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Historial — derecha */}
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Historial de envíos"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => onOpenChange(false)} title="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Historial (colapsable) */}
        {showHistory && (
          <div className="px-4 py-2 border-b border-border bg-muted/10 shrink-0">
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

        {/* ═══ 2. CAMPOS — [Enviar] Para → CC (con autocomplete) ═══ */}
        <div className="px-4 py-2 border-b border-border bg-background text-[11px] shrink-0 relative flex gap-2">
          {/* Enviar — columna izquierda, cuadrado, spanea Para + CC (estilo Outlook 365) */}
          <button
            type="button"
            className="email-send-btn shrink-0"
            disabled={!canSend}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </button>

          {/* Columna derecha — Para + CC apilados */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0 relative">
            {/* Fila Para */}
            <div className="flex items-center gap-2 py-0.5 relative">
              <span className="text-muted-foreground font-medium shrink-0 w-10 text-[11px]">Para</span>
              <input
                value={to}
                onChange={(e) => handleRecipientInput(e.target.value, "to")}
                onFocus={() => setActiveField("to")}
                onBlur={handleRecipientBlur}
                placeholder="nombre o email…"
                className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-0"
              />
              {/* Botón libreta de contactos */}
              <ContactBookButton
                contacts={contacts || []}
                onPick={(email) => addRecipientToField(email, "to")}
              />
              {/* Toggle Plantilla */}
              <div className="flex items-center gap-2 shrink-0">
                {hasTemplates && !showTemplateModal && effectiveMode !== "template" && (
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Plantilla
                  </button>
                )}
                {effectiveMode === "template" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("manual");
                      setSelectedTemplateId("");
                      setSubjectOverride(null);
                      setBodyOverride(null);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Quitar plantilla
                  </button>
                )}
              </div>
            </div>

            {/* CC — siempre visible */}
            <div className="flex items-center gap-2 py-0.5 relative">
              <span className="text-muted-foreground font-medium shrink-0 w-10 text-[11px]">CC</span>
              <input
                value={cc}
                onChange={(e) => handleRecipientInput(e.target.value, "cc")}
                onFocus={() => setActiveField("cc")}
                onBlur={handleRecipientBlur}
                placeholder="con copia…"
                className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-0"
              />
              <ContactBookButton
                contacts={contacts || []}
                onPick={(email) => addRecipientToField(email, "cc")}
              />
            </div>
          </div>

          {/* ─── Autocomplete dropdown ─── */}
          {activeField && autocompleteSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-auto">
              {autocompleteSuggestions.map((contact) => {
                const initials = (contact.fullName || contact.email)
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <button
                    key={contact.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipientToField(contact.email, activeField);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent transition-colors border-b last:border-0 border-border/20"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-medium text-white shrink-0 email-icon-gradient">
                      {initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {contact.fullName || contact.email}
                      </span>
                      {contact.fullName && (
                        <span className="text-[10px] text-muted-foreground truncate font-mono">
                          {contact.email}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {contact.roles.slice(0, 2).map((role) => (
                        <span
                          key={role}
                          className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                            contact.isInternal
                              ? "bg-primary/12 text-primary"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ 4 + 5. BODY — Asunto integrado + editor que ocupa todo ═══ */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          {previewLoading && effectiveMode === "template" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-[11px]">Generando correo…</p>
            </div>
          ) : (
            <>
              {/* Asunto — mismo control que el configurador de plantillas */}
              <div className="px-4 py-2.5 bg-background shrink-0 flex flex-col gap-1">
                <Label className="app-field-label">Asunto</Label>
                <Input
                  value={effectiveSubject}
                  onChange={(e) => setSubjectOverride(e.target.value)}
                  placeholder="Asunto del correo"
                  className="h-9"
                />
              </div>

              {/* Editor — mismo componente y className que el configurador de plantillas */}
              {effectiveFormat === "html" ? (
                <HtmlEditor
                  value={effectiveBody || ""}
                  onChange={(html) => setBodyOverride(html)}
                  editorRef={htmlEditorRef}
                  placeholder="Escribe el cuerpo del correo…"
                  className="flex-1 min-h-0"
                  showCodeView={false}
                />
              ) : (
                <textarea
                  value={effectiveBody}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  placeholder="Escribe el cuerpo del correo…"
                  className="flex-1 min-h-40 w-full resize-none bg-background px-4 pt-4 pb-5 text-sm leading-relaxed text-foreground outline-none border border-border rounded-lg overflow-y-auto"
                />
              )}
            </>
          )}
        </div>

        {/* ═══ MODAL DE PLANTILLAS — se abre al pinchar "Plantilla" ═══ */}
        {showTemplateModal && (
          <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal} dismissible={false}>
            <DialogContent className="modal-md p-0!" showCloseButton={false}>
              <div className="modal-header">
                <DialogTitle className="modal-title flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Seleccionar Plantilla
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="modal-body p-3 space-y-1 max-h-80 overflow-y-auto">
                {activeTemplates.map((t) => {
                  const isDefault = (t.actions || []).some(
                    (a) => a.action_template_id === action.action_template_id && a.is_default
                  );
                  const isSelected = effectiveTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMode("template");
                        changeTemplate(t.id);
                        setShowTemplateModal(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors border ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] font-medium truncate">{t.name}</span>
                        {t.description && (
                          <span className="text-[10px] text-muted-foreground truncate">{t.description}</span>
                        )}
                      </div>
                      {isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                          default
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                          seleccionada
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="modal-footer">
                <Button
                  className="pg-btn-platinum"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
