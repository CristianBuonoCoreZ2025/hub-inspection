"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, X, Plus, History, FileText, Code2, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { getEmailTemplatesForAction } from "@/services/email-template-actions";
import { wrapHtmlEmail } from "@/services/email-render";
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

interface RecipientSuggestion {
  label: string;
  email: string | null;
  role: string;
}

/**
 * Modal de envío de e-mail desde una gestión del siniestro.
 *
 * Dos modos:
 *  1. Plantilla: el usuario selecciona una plantilla vinculada → se renderiza con
 *     los datos del siniestro. El subject y body son editables después de renderizar.
 *  2. Manual: el usuario escribe subject y body desde cero (sin plantilla).
 *
 * En ambos casos:
 *  - Sugiere destinatarios automáticamente (asegurado, liquidador, inspector, etc.)
 *  - Preview en vivo (texto plano o HTML con iframe)
 *  - El usuario completa Para / CC / CCO
 *  - Al enviar, se guarda en email_logs con correlativo automático
 */
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
  const [bcc, setBcc] = useState<string>("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [manualBodyFormat, setManualBodyFormat] = useState<"plain" | "html">("plain");
  const [showHistory, setShowHistory] = useState(false);
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

  const { data: recipientSuggestions } = useQuery({
    queryKey: ["email-recipients", action.claim_id, claim],
    queryFn: async (): Promise<RecipientSuggestion[]> => {
      const suggestions: RecipientSuggestion[] = [];
      const claimData = claim || {};
      const ownerEmail = claimData.owner_email as string | undefined;
      if (ownerEmail) {
        suggestions.push({ label: "Propietario", email: ownerEmail, role: "owner" });
      }
      const profileIds = [
        claimData.adjuster_id as string | undefined,
        claimData.assigned_adjuster_id as string | undefined,
        claimData.inspector_id as string | undefined,
        claimData.assistant_id as string | undefined,
        claimData.dispatcher_id as string | undefined,
      ].filter(Boolean) as string[];
      if (profileIds.length > 0) {
        const supabase = getSupabaseClient();
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);
        const profMap = new Map<string, { id: string; full_name: string; email: string }>(
          (profiles || []).map((p: { id: string; full_name: string; email: string }) => [p.id, p])
        );
        if (claimData.adjuster_id) {
          const p = profMap.get(claimData.adjuster_id as string);
          if (p?.email) suggestions.push({ label: "Liquidador", email: p.email, role: "adjuster" });
        }
        if (claimData.assigned_adjuster_id) {
          const p = profMap.get(claimData.assigned_adjuster_id as string);
          if (p?.email) suggestions.push({ label: "Liq. Asignado", email: p.email, role: "assigned_adjuster" });
        }
        if (claimData.inspector_id) {
          const p = profMap.get(claimData.inspector_id as string);
          if (p?.email) suggestions.push({ label: "Inspector", email: p.email, role: "inspector" });
        }
        if (claimData.assistant_id) {
          const p = profMap.get(claimData.assistant_id as string);
          if (p?.email) suggestions.push({ label: "Asistente", email: p.email, role: "assistant" });
        }
        if (claimData.dispatcher_id) {
          const p = profMap.get(claimData.dispatcher_id as string);
          if (p?.email) suggestions.push({ label: "Despachador", email: p.email, role: "dispatcher" });
        }
      }
      const supabase = getSupabaseClient();
      const { data: participants } = await supabase
        .from("claims_participants")
        .select("id, type, full_name, email")
        .eq("claim_id", action.claim_id);
      for (const p of participants || []) {
        if (!p.email) continue;
        const typeLabel: Record<string, string> = {
          insured: "Asegurado",
          contractor: "Contratista",
          beneficiary: "Beneficiario",
          executive: "Ejecutivo",
          contact: "Contacto",
        };
        suggestions.push({
          label: typeLabel[p.type] || p.type,
          email: p.email,
          role: p.type,
        });
      }
      return suggestions;
    },
    enabled: open,
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

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === effectiveTemplateId) || null,
    [templates, effectiveTemplateId]
  );

  const { data: previewData, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["email-preview", action.id, mode, effectiveTemplateId, subjectOverride, bodyOverride, manualBodyFormat],
    queryFn: async () => {
      try {
        if (mode === "manual") {
          const res = await fetch("/api/email/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              claimActionId: action.id,
              manualSubject: subjectOverride ?? "",
              manualBody: bodyOverride ?? "",
              manualBodyFormat,
            }),
          });
          if (!res.ok) return { subject: subjectOverride ?? "", body: bodyOverride ?? "", body_format: manualBodyFormat };
          return await res.json();
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
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error("[email-preview] HTTP", res.status, errText, "claimActionId:", action.id);
          return { subject: "", body: "", body_format: "plain" as const };
        }
        return await res.json();
      } catch (err) {
        console.error("[email-preview] error:", err);
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

  const previewHtml = useMemo(() => {
    if (effectiveFormat !== "html") return "";
    return wrapHtmlEmail({ body: effectiveBody || "<p><em>(cuerpo vacío)</em></p>" });
  }, [effectiveBody, effectiveFormat]);

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
        payload.emailTemplateId = effectiveTemplateId;
        if (subjectOverride !== null || bodyOverride !== null) {
          payload.manualSubject = effectiveSubject;
          payload.manualBody = effectiveBody;
          payload.manualBodyFormat = effectiveFormat;
          payload.emailTemplateId = null;
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

  // Código de gestión para el header
  const gestionCode = (action.action_data as Record<string, unknown> | null)?.codigo as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-xl p-0! flex flex-col" showCloseButton={false}>

        {/* ═══ 1. HEADER — 3 filas como el preview ═══ */}
        <div className="app-compose-header">
          <DialogTitle className="flex items-start gap-3 m-0">
            <div className="app-compose-header-icon">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="app-compose-title">Enviar Correo</span>
              {gestionCode && (
                <span className="app-compose-subtitle">Gestión: {gestionCode}</span>
              )}
              <span className="app-compose-subtitle-mono">Componer y enviar email</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              title="Cerrar"
              className="app-compose-btn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ═══ 2. BODY — 2 columnas: composición + preview ═══ */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] overflow-hidden">

          {/* ─── Columna izquierda: composición ─── */}
          <div className="app-compose-panel-left p-4">

            {/* Tabs: Plantilla / A mano */}
            <div className="app-compose-tabs">
              <button
                type="button"
                onClick={() => changeMode("template")}
                data-active={mode === "template"}
                className="app-compose-tab"
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
                className="app-compose-tab"
              >
                <Sparkles className="h-3 w-3" />
                A mano
              </button>
            </div>

            {/* Selector de plantilla */}
            {mode === "template" && (
              <div className="space-y-1.5">
                <Label className="app-compose-label">Plantilla</Label>
                <Select
                  value={effectiveTemplateId || "__none"}
                  onValueChange={(v) => changeTemplate(v === "__none" || !v ? "" : v)}
                  items={templateItems}
                >
                  <SelectTrigger className="app-input h-9 w-full">
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
                {activeTemplates.length === 0 && (
                  <p className="text-[11px] text-amber-600">
                    No hay plantillas activas vinculadas a esta gestión. Usa modo &ldquo;A mano&rdquo;.
                  </p>
                )}
              </div>
            )}

            {/* Destinatarios sugeridos */}
            {recipientSuggestions && recipientSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="app-compose-label">Sugeridos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientSuggestions.map((r) => (
                    <button
                      key={`${r.role}-${r.email}`}
                      type="button"
                      onClick={() => r.email && addRecipientToField(r.email, "to")}
                      className="app-compose-chip"
                      title={`Agregar ${r.email} a Para`}
                    >
                      <Plus className="h-2.5 w-2.5" />
                      {r.label}: <span className="font-mono truncate max-w-30">{r.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Para */}
            <div className="space-y-1.5">
              <Label className="app-compose-label">Para</Label>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="destinatario@ejemplo.com, otro@ejemplo.com"
                className="app-input"
              />
            </div>

            {/* CC / CCO */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="app-compose-label">CC</Label>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Separados por coma"
                  className="app-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="app-compose-label">CCO</Label>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Separados por coma"
                  className="app-input"
                />
              </div>
            </div>

            {/* Asunto */}
            <div className="space-y-1.5">
              <Label className="app-compose-label">
                Asunto {mode === "template" && selectedTemplate && "(editable)"}
              </Label>
              <Input
                value={effectiveSubject}
                onChange={(e) => setSubjectOverride(e.target.value)}
                placeholder="Asunto del correo"
                className="app-input"
              />
            </div>

            {/* Cuerpo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="app-compose-label">
                  Cuerpo {mode === "template" && selectedTemplate && "(editable)"}
                </Label>
                {mode === "manual" && (
                  <div className="app-compose-format-toggle">
                    <button
                      type="button"
                      onClick={() => setManualBodyFormat("plain")}
                      data-active={manualBodyFormat === "plain"}
                      className="app-compose-format-btn"
                    >
                      <FileText className="h-2.5 w-2.5" />
                      Texto
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualBodyFormat("html")}
                      data-active={manualBodyFormat === "html"}
                      className="app-compose-format-btn"
                    >
                      <Code2 className="h-2.5 w-2.5" />
                      HTML
                    </button>
                  </div>
                )}
              </div>
              {previewLoading && mode === "template" ? (
                <div className="app-compose-loading h-40 rounded-lg border border-border">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-[11px]">Cargando vista previa...</p>
                </div>
              ) : previewError && mode === "template" ? (
                <div className="w-full h-20 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center justify-center text-[11px] text-destructive">
                  Error al cargar vista previa
                </div>
              ) : effectiveFormat === "html" && previewHtml ? (
                <details className="text-[10px] group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground list-none flex items-center gap-1 mb-1">
                    <Code2 className="h-3 w-3" />
                    Editar HTML fuente
                  </summary>
                  <Textarea
                    value={effectiveBody}
                    onChange={(e) => setBodyOverride(e.target.value)}
                    className="app-input min-h-30 font-mono text-[10px]"
                  />
                </details>
              ) : (
                <Textarea
                  value={effectiveBody}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  placeholder="Cuerpo del correo..."
                  className="app-input min-h-40"
                />
              )}
            </div>

            {/* Historial */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3 w-3" />
                {showHistory ? "Ocultar historial" : "Ver historial de envíos"}
              </button>
              {showHistory && logs && logs.length > 0 && (
                <div className="app-compose-history">
                  {logs.map((log) => (
                    <div key={log.id} className="app-compose-history-item">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">
                          EML-{String(log.correlativo).padStart(3, "0")}: {log.subject}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {log.to_address.join(", ")} · {new Date(log.sent_at).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <span
                        className={`app-compose-history-status app-compose-history-status-${log.status}`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {showHistory && logs && logs.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  No hay envíos registrados.
                </p>
              )}
            </div>
          </div>

          {/* ─── Columna derecha: preview en vivo ─── */}
          <div className="app-compose-panel-right">
            <div className="app-compose-preview-bar">
              <div className="app-compose-preview-title">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                Vista Previa
              </div>
              <span className="app-compose-preview-badge">
                {effectiveFormat === "html" ? "HTML" : "Texto plano"}
              </span>
            </div>
            <div className="app-compose-preview-body">
              {previewLoading && mode === "template" ? (
                <div className="app-compose-loading">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-[11px]">Generando vista previa…</p>
                </div>
              ) : effectiveFormat === "html" && previewHtml ? (
                <div className="app-compose-preview-card">
                  <iframe
                    title="email-preview"
                    srcDoc={previewHtml}
                    className="w-full bg-white"
                    style={{ minHeight: "70vh" }}
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="app-compose-preview-text">
                  <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {effectiveBody || (
                      <span className="text-muted-foreground italic">
                        (cuerpo vacío — escribí algo o elegí una plantilla)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 3. FOOTER — Cancelar + Enviar ═══ */}
        <div className="app-compose-footer">
          <Button
            className="pg-btn-platinum"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => sendMutation.mutate()}
            className="app-compose-btn-primary"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
