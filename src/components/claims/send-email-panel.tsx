"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getEmailTemplatesForAction } from "@/services/email-templates";
import { getEmailLogs } from "@/services/email-logs";
import { renderEmailTemplate } from "@/services/email-render";
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

export function SendEmailPanel({ claim, action, businessLineId, disabled }: SendEmailPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [bcc, setBcc] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["email-templates-for-action", action.action_template_id, businessLineId, action.company_id],
    queryFn: () => getEmailTemplatesForAction(action.action_template_id, businessLineId, action.company_id),
    enabled: open,
  });

  const { data: logs } = useQuery({
    queryKey: ["email-logs", action.id],
    queryFn: () => getEmailLogs(action.id),
    enabled: open,
  });

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const preview = useMemo(() => {
    if (!selectedTemplate || !claim) return { subject: "", body: "" };
    const data: Record<string, unknown> = { ...claim, action_id: action.id, action_data: action.action_data };
    const actionData = (action.action_data || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(actionData)) {
      if (typeof v !== "object" || v === null) {
        data[k] = v;
      }
    }
    return renderEmailTemplate(selectedTemplate, data);
  }, [selectedTemplate, claim, action]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toArr = to.split(",").map((s) => s.trim()).filter(Boolean);
      const ccArr = cc.split(",").map((s) => s.trim()).filter(Boolean);
      const bccArr = bcc.split(",").map((s) => s.trim()).filter(Boolean);

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimActionId: action.id,
          emailTemplateId: selectedTemplateId,
          to: toArr,
          cc: ccArr,
          bcc: bccArr,
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
      setBcc("");
      setSelectedTemplateId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activeTemplates = templates?.filter((t) => t.is_active) || [];

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="pg-btn-platinum"
        disabled={disabled || activeTemplates.length === 1 ? false : false}
        onClick={() => setOpen((v) => !v)}
      >
        <Mail className="h-4 w-4 mr-1" />
        E-mail
      </Button>

      {open && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/10">
          <div className="space-y-1.5">
            <Label className="app-field-label">Plantilla</Label>
            <select
              className="app-input h-9 w-full text-[13px]"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">Seleccionar plantilla...</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {activeTemplates.length === 0 && <p className="text-xs text-amber-600">No hay plantillas activas para esta acción.</p>}
          </div>

          {selectedTemplate && (
            <>
              <div className="space-y-1.5">
                <Label className="app-field-label">Para</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinatario@ejemplo.com, otro@ejemplo.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="app-field-label">CC</Label>
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Separados por coma" />
                </div>
                <div className="space-y-1.5">
                  <Label className="app-field-label">CCO</Label>
                  <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="Separados por coma" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="app-field-label">Asunto</Label>
                <Input value={preview.subject} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label className="app-field-label">Cuerpo</Label>
                <Textarea value={preview.body} readOnly className="min-h-[120px]" />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="pg-btn-platinum"
                  disabled={!to.trim() || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
                </Button>
              </div>
            </>
          )}

          {logs && logs.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="app-field-label text-[12px]">Historial de envíos</p>
              <div className="max-h-[120px] overflow-auto space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="text-[11px] flex items-center justify-between gap-2 border-b last:border-0 pb-1">
                    <span className="truncate">{log.to_address.join(", ")}</span>
                    <span className={`shrink-0 px-1.5 rounded ${log.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
