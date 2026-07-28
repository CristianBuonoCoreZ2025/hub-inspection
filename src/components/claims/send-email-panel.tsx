"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, X, Plus, History } from "lucide-react";
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
import { getEmailLogs } from "@/services/email-logs";
import { renderEmailTemplate, wrapHtmlEmail } from "@/services/email-render";
import { getSupabaseClient } from "@/lib/supabase/db";
import { toast } from "sonner";

interface SendEmailPanelProps {
  claim: Record<string, unknown> | null;
  action: {
    id: string;
    company_id: string;
    claim_id: string;
    action_template_id: string;
    action_data?: Record<string, unknown> | null;
  };
  businessLineId?: string | null;
  disabled?: boolean;
}

interface RecipientSuggestion {
  label: string;
  email: string | null;
  role: string;
}

/**
 * Panel de envío de e-mail desde una acción de siniestro.
 *
 * - Sugiere destinatarios automáticamente (asegurado, contratante, beneficiario,
 *   contacto, liquidador, inspector) extraídos del claim y sus participantes.
 * - Auto-selecciona la plantilla por defecto de la acción.
 * - Preview en vivo (texto plano o HTML con iframe).
 * - Historial de envíos embebido.
 */
export function SendEmailPanel({ claim, action, businessLineId, disabled }: SendEmailPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();

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

  const { data: logs } = useQuery({
    queryKey: ["email-logs", action.id],
    queryFn: () => getEmailLogs(action.id),
    enabled: open && showHistory,
  });

  // Cargar la última sesión de inspección del siniestro (para magic link en preview)
  const { data: lastSession } = useQuery({
    queryKey: ["last-inspection-session", action.claim_id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("inspection_sessions")
        .select("id, magic_link_token, magic_link_expires_at, scheduled_at, created_at, inspection_type, status")
        .eq("claim_id", action.claim_id)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    enabled: open,
  });

  // Cargar perfiles asociados al siniestro para sugerir destinatarios
  const { data: recipientSuggestions } = useQuery({
    queryKey: ["email-recipients", action.claim_id, claim],
    queryFn: async (): Promise<RecipientSuggestion[]> => {
      const suggestions: RecipientSuggestion[] = [];
      const claimData = claim || {};
      // Emails directos del claim
      const ownerEmail = claimData.owner_email as string | undefined;
      if (ownerEmail) {
        suggestions.push({ label: "Propietario", email: ownerEmail, role: "owner" });
      }
      // Perfiles asignados (adjuster, inspector, etc.)
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
        if (claimData.inspector_id) {
          const p = profMap.get(claimData.inspector_id as string);
          if (p?.email) suggestions.push({ label: "Inspector", email: p.email, role: "inspector" });
        }
        if (claimData.assistant_id) {
          const p = profMap.get(claimData.assistant_id as string);
          if (p?.email) suggestions.push({ label: "Asistente", email: p.email, role: "assistant" });
        }
      }
      // Participantes del siniestro (insured, contractor, beneficiary, contact)
      const supabase = getSupabaseClient();
      const { data: participants } = await supabase
        .from("claims_participants")
        .select("id, type, full_name, email")
        .eq("claim_id", action.claim_id);
      for (const p of participants || []) {
        if (!p.email) continue;
        const typeLabel: Record<string, string> = {
          insured: "Asegurado",
          contractor: "Contratante",
          beneficiary: "Beneficiario",
          contact: "Contacto",
          executive: "Ejecutivo",
          owner: "Propietario",
        };
        suggestions.push({
          label: typeLabel[p.type] || p.type,
          email: p.email,
          role: p.type,
        });
      }
      // Deduplicar por email
      const seen = new Set<string>();
      return suggestions.filter((s) => {
        if (!s.email || seen.has(s.email)) return false;
        seen.add(s.email);
        return true;
      });
    },
    enabled: open && !!claim,
  });

  // Auto-seleccionar la plantilla por defecto al abrir.
  // Es un hydrate desde query → form, patrón estándar. Silenciamos la regla
  // porque no hay forma más limpia de inicializar el select desde datos async.
  useEffect(() => {
    if (open && templates && templates.length > 0 && !selectedTemplateId) {
      const defaultTpl = templates.find((t) =>
        (t.actions || []).some((a) => a.action_template_id === action.action_template_id && a.is_default)
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTemplateId((defaultTpl || templates[0]).id);
    }
  }, [open, templates, action.action_template_id, selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const preview = useMemo(() => {
    if (!selectedTemplate || !claim) return { subject: "", body: "", body_format: "plain" as const };
    const data: Record<string, unknown> = { ...claim, action_id: action.id, action_data: action.action_data };
    const actionData = (action.action_data || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(actionData)) {
      if (typeof v !== "object" || v === null) {
        data[k] = v;
      }
    }
    // Magic link de la última inspección
    if (lastSession?.magic_link_token) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      data.magic_link = `${origin}/inspection/${lastSession.magic_link_token}`;
      data.magic_link_valid_from = lastSession.created_at;
      data.magic_link_valid_until = lastSession.magic_link_expires_at;
      data.last_inspection_scheduled_at = lastSession.scheduled_at;
    }
    return renderEmailTemplate(selectedTemplate, data);
  }, [selectedTemplate, claim, action, lastSession]);

  const previewHtml = useMemo(() => {
    if (preview.body_format !== "html") return "";
    return wrapHtmlEmail({
      body: preview.body || "<p><em>(cuerpo vacío)</em></p>",
    });
  }, [preview]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      // Separar destinatarios por coma O punto y coma (Outlook usa ;).
      const splitRecipients = (raw: string) =>
        raw.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
      const toArr = splitRecipients(to);
      const ccArr = splitRecipients(cc);

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimActionId: action.id,
          emailTemplateId: selectedTemplateId,
          to: toArr,
          cc: ccArr,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error enviando e-mail");
      return json;
    },
    onSuccess: () => {
      toast.success("E-mail enviado");
      queryClient.invalidateQueries({ queryKey: ["email-logs", action.id] });
      setTo("");
      setCc("");
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRecipientToField = (email: string, field: "to" | "cc") => {
    const setter = field === "to" ? setTo : setCc;
    const current = field === "to" ? to : cc;
    const existing = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (existing.includes(email)) return;
    setter([...existing, email].join(", "));
  };

  const activeTemplates = useMemo(() => templates?.filter((t) => t.is_active) || [], [templates]);

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

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="pg-btn-platinum"
        disabled={disabled || activeTemplates.length === 0}
        onClick={() => setOpen(true)}
      >
        <Mail className="h-4 w-4 mr-1" />
        E-mail
      </Button>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-lg" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              <Mail className="h-4 w-4 inline mr-2" />
              Enviar E-mail
            </DialogTitle>
          </div>
          <div className="modal-body space-y-3">
            {/* Selector de plantilla */}
            <div className="space-y-1.5">
              <Label className="app-field-label">Plantilla</Label>
              <Select
                value={selectedTemplateId || "__none"}
                onValueChange={(v) =>
                  setSelectedTemplateId(v === "__none" || !v ? "" : v)
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
                  No hay plantillas activas vinculadas a esta gestión.
                </p>
              )}
            </div>

            {/* Destinatarios sugeridos */}
            {recipientSuggestions && recipientSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="app-field-label">Destinatarios sugeridos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientSuggestions.map((r) => (
                    <button
                      key={`${r.role}-${r.email}`}
                      type="button"
                      onClick={() => addRecipientToField(r.email!, "to")}
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

            {selectedTemplate && (
              <>
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
                </div>

                {/* Preview */}
                <div className="space-y-1.5">
                  <Label className="app-field-label">Asunto (preview)</Label>
                  <Input value={preview.subject} readOnly className="app-input bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="app-field-label">Cuerpo (preview)</Label>
                  {preview.body_format === "html" && previewHtml ? (
                    <iframe
                      title="email-preview"
                      srcDoc={previewHtml}
                      className="w-full h-60 rounded border border-border bg-white"
                    />
                  ) : (
                    <Textarea
                      value={preview.body}
                      readOnly
                      className="app-input min-h-35 bg-muted/30"
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
                            <span className="truncate">{log.to_address.join(", ")}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(log.sent_at).toLocaleString("es-CL")}
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
              </>
            )}
          </div>
          <div className="modal-footer">
            <Button className="pg-btn-platinum" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
            <Button
              className="pg-btn-platinum"
              disabled={!to.trim() || !selectedTemplateId || sendMutation.isPending}
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
    </div>
  );
}
