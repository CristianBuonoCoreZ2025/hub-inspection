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
  // En modo manual, el usuario escribe subject y body directamente.
  // En modo plantilla, se renderiza la plantilla y el resultado es editable.
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [manualBodyFormat, setManualBodyFormat] = useState<"plain" | "html">("plain");
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();

  // Wrappers que resetean overrides al cambiar modo/plantilla (evita effect)
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

  // Cargar perfiles asociados al siniestro para sugerir destinatarios
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

  // Auto-seleccionar plantilla por defecto: derivamos el id efectivo durante el render
  // (patrón React recomendado en lugar de useEffect + setState).
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

  // Render del preview: se calcula en el backend (buildDocumentDataForClaim es server-only).
  // Llamamos a /api/email/preview que devuelve subject y body renderizados con datos reales.
  const { data: previewData, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["email-preview", action.id, mode, effectiveTemplateId, subjectOverride, bodyOverride, manualBodyFormat],
    queryFn: async () => {
      try {
        if (mode === "manual") {
          // En modo manual, el preview es lo que el usuario escribe (con placeholders reemplazados)
          console.log("[email-preview] mode=manual, claimActionId:", action.id);
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
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            console.error("[email-preview] HTTP", res.status, errText, "claimActionId:", action.id);
            return { subject: subjectOverride ?? "", body: bodyOverride ?? "", body_format: manualBodyFormat };
          }
          return await res.json();
        }
        if (!effectiveTemplateId) {
          return { subject: "", body: "", body_format: "plain" as const };
        }
        console.log("[email-preview] mode=template, claimActionId:", action.id, "templateId:", effectiveTemplateId);
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
        console.error("[email-preview] error:", err, "claimActionId:", action.id);
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

  // Subject y body efectivos (con overrides del usuario)
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
        // Si el usuario editó el subject/body renderizado, lo enviamos como manual
        // para que el backend no vuelva a renderizar la plantilla.
        if (subjectOverride !== null || bodyOverride !== null) {
          payload.manualSubject = effectiveSubject;
          payload.manualBody = effectiveBody;
          payload.manualBodyFormat = effectiveFormat;
          payload.emailTemplateId = null; // forzar modo manual en backend
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-lg" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Enviar E-mail
          </DialogTitle>
        </div>
        <div className="modal-body space-y-3">
          {/* Selector de modo: Plantilla o Manual */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeMode("template")}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                mode === "template"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Usar plantilla
            </button>
            <button
              type="button"
              onClick={() => {
                changeMode("manual");
                setSelectedTemplateId("");
                setManualBodyFormat("plain");
              }}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                mode === "manual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Escrito a mano
            </button>
          </div>

          {/* Selector de plantilla (solo en modo template) */}
          {mode === "template" && (
            <div className="space-y-1.5">
              <Label className="app-field-label">Plantilla</Label>
              <Select
                value={effectiveTemplateId || "__none"}
                onValueChange={(v) =>
                  changeTemplate(v === "__none" || !v ? "" : v)
                }
                items={templateItems}
              >
                <SelectTrigger className="app-input h-9 w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Seleccionar...</SelectItem>
                  {activeTemplates.map((t) => {
                    const isDefault = (t.actions || []).some(
                      (a) =>
                        a.action_template_id === action.action_template_id && a.is_default
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
                  No hay plantillas activas vinculadas a esta gestión. Usa modo &ldquo;Escrito a mano&rdquo;.
                </p>
              )}
            </div>
          )}

          {/* Destinatarios sugeridos */}
          {recipientSuggestions && recipientSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="app-field-label">Destinatarios sugeridos</Label>
              <div className="flex flex-wrap gap-1.5">
                {recipientSuggestions.map((r) => (
                  <button
                    key={`${r.role}-${r.email}`}
                    type="button"
                    onClick={() => r.email && addRecipientToField(r.email, "to")}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] hover:border-primary hover:bg-primary/10 transition-colors"
                    title={`Agregar ${r.email} a Para`}
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {r.label}: <span className="font-mono truncate max-w-30">{r.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Para / CC / CCO */}
          <div className="space-y-1.5">
            <Label className="app-field-label">Para</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinatario@ejemplo.com, otro@ejemplo.com"
              className="app-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="app-field-label">CC</Label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="Separados por coma"
                className="app-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="app-field-label">CCO</Label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="Separados por coma"
                className="app-input"
              />
            </div>
          </div>

          {/* Asunto (editable) */}
          <div className="space-y-1.5">
            <Label className="app-field-label">
              Asunto {mode === "template" && selectedTemplate && "(editable)"}
            </Label>
            <Input
              value={effectiveSubject}
              onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder="Asunto del correo"
              className="app-input"
            />
          </div>

          {/* Cuerpo (editable) */}
          <div className="space-y-1.5">
            <Label className="app-field-label">
              Cuerpo {mode === "template" && selectedTemplate && "(editable)"}
            </Label>
            {previewLoading && mode === "template" ? (
              <div className="w-full h-40 rounded border border-border bg-muted/30 flex items-center justify-center text-[11px] text-muted-foreground">
                Cargando vista previa...
              </div>
            ) : previewError && mode === "template" ? (
              <div className="w-full h-20 rounded border border-destructive/30 bg-destructive/5 flex items-center justify-center text-[11px] text-destructive">
                Error al cargar vista previa
              </div>
            ) : effectiveFormat === "html" && previewHtml ? (
              <div className="space-y-1.5">
                <iframe
                  title="email-preview"
                  srcDoc={previewHtml}
                  className="w-full h-80 rounded border border-border bg-white"
                />
                <details className="text-[10px]">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ver/editar HTML fuente
                  </summary>
                  <Textarea
                    value={effectiveBody}
                    onChange={(e) => setBodyOverride(e.target.value)}
                    className="app-input min-h-30 font-mono text-[10px] mt-1"
                  />
                </details>
              </div>
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
              <div className="rounded-lg border border-border p-2 space-y-1 max-h-40 overflow-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="text-[11px] flex items-center justify-between gap-2 border-b last:border-0 pb-1"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">
                        EML-{String(log.correlativo).padStart(3, "0")}: {log.subject}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {log.to_address.join(", ")} · {new Date(log.sent_at).toLocaleString("es-CL")}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 px-1.5 rounded text-[10px] font-medium ${
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
        <div className="modal-footer">
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
