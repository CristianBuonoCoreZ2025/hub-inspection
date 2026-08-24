"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Mail, Send, RefreshCw, Clock, CheckCircle2, AlertTriangle, Loader2, MapPinned } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshMagicLink } from "@/services/inspections";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getUserTimeZone } from "@/lib/timezone";

interface MagicLinkSenderProps {
  token: string;
  sessionId: string;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  magicLinkExtended?: boolean;
  sessionStatus?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CL", {
    timeZone: getUserTimeZone(),
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function MagicLinkSender({
  token,
  sessionId,
  scheduledAt,
  expiresAt,
  magicLinkExtended = false,
  sessionStatus,
  contactName,
  contactEmail,
  contactPhone,
}: MagicLinkSenderProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = React.useState<"whatsapp" | "email" | null>(null);
  const [whatsappCloudEnabled, setWhatsappCloudEnabled] = React.useState<boolean | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/inspection/${token}` : "";

  // Hora local para el cálculo de estados — se actualiza cada minuto
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Consulta una sola vez si WhatsApp Cloud API está configurada
  React.useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => {
        const wa = Array.isArray(data?.integrations) ? data.integrations.find((i: { key: string }) => i.key === "whatsapp") : null;
        setWhatsappCloudEnabled(!!wa?.connected);
      })
      .catch(() => setWhatsappCloudEnabled(false));
  }, []);

  const scheduled = scheduledAt ? new Date(scheduledAt).getTime() : null;
  const windowStart = scheduled ? scheduled - 60 * 60 * 1000 : null;
  const windowEnd = expiresAt ? new Date(expiresAt).getTime() : null;

  const expiryInfo = React.useMemo(() => {
    if (!scheduled) return { status: "unknown" as const, label: "Sin inspección programada" };
    if (windowStart && nowMs < windowStart) {
      return { status: "not-active" as const, label: `Aún no activo (se activa ${fmt(new Date(windowStart).toISOString())})` };
    }
    if (windowEnd && nowMs > windowEnd) {
      return { status: "expired" as const, label: "Expirado" };
    }
    if (windowEnd) {
      const diffMs = windowEnd - nowMs;
      const diffM = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      const diffH = Math.floor(diffM / 60);
      const restM = diffM % 60;
      const until = `expira en ${diffH > 0 ? `${diffH}h ` : ""}${restM}m`;
      return {
        status: magicLinkExtended ? "extended" as const : "valid" as const,
        label: magicLinkExtended ? `Extendido — ${until}` : `Activo — ${until}`,
      };
    }
    return { status: "unknown" as const, label: "Sin fecha de expiración" };
  }, [scheduled, windowStart, windowEnd, nowMs, magicLinkExtended]);

  // ¿El link está dentro de su ventana de validez (normal o extendida)?
  const isWithinValidity = expiryInfo.status === "valid" || expiryInfo.status === "extended";

  // ¿Se puede renovar?
  // - Antes de expirar (cualquier estado excepto expired)
  // - Si está expirado pero la sesión está activa → se puede reactivar
  const canReactivate = expiryInfo.status === "expired" && sessionStatus === "active";
  const canRenew = expiryInfo.status !== "expired" || canReactivate;

  const refreshMutation = useMutation({
    mutationFn: () => refreshMagicLink(sessionId),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
        const messages: Record<string, string> = {
          new: "Nuevo magic link generado",
          extended: "Magic link extendido 1 hora",
          "already-extended": "Ya fue extendido una vez",
          active: "Magic link activo",
          expired: "El magic link ya expiró",
          reactivated: "Magic link reactivado por 3 horas",
        };
        const msg = messages[data.message] || data.message;
        if (data.message === "expired" || data.message === "already-extended") toast.info(msg);
        else if (data.message === "new" || data.message === "extended" || data.message === "reactivated") toast.success(msg);
        else toast.info(msg);
      }
    },
    onError: (err: Error) => toast.error(err.message || "Error al renovar el link"),
  });

  const enableRecaptureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/inspection/geo/enable-recapture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al habilitar recaptura");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      toast.success("Recaptura de ubicación habilitada");
    },
    onError: (err: Error) => toast.error(err.message || "Error al habilitar recaptura"),
  });

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    }
  };

  const sendWhatsAppMe = () => {
    if (!contactPhone) {
      toast.error("No hay teléfono de contacto");
      return;
    }
    const cleanPhone = contactPhone.replace(/[^0-9]/g, "");
    const message = `Hola ${contactName || ""}, aquí está el link para su inspección remota: ${link}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    toast.success("Abriendo WhatsApp...");
  };

  const sendWhatsAppCloud = async () => {
    if (!contactPhone) {
      toast.error("No hay teléfono de contacto");
      return;
    }
    setSending("whatsapp");
    try {
      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "whatsapp", phone: contactPhone, name: contactName, link }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error enviando WhatsApp");
      toast.success("WhatsApp enviado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando WhatsApp";
      toast.error(msg);
    } finally {
      setSending(null);
    }
  };

  const sendEmail = async () => {
    if (!contactEmail) {
      toast.error("No hay email de contacto");
      return;
    }
    setSending("email");
    try {
      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", email: contactEmail, name: contactName, link }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error enviando email");
      toast.success("Email enviado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando email";
      toast.error(msg);
    } finally {
      setSending(null);
    }
  };

  const expiryConfig = {
    valid: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    extended: { icon: CheckCircle2, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
    expired: { icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
    unknown: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/40" },
    "not-active": { icon: Clock, color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-500/10" },
  };
  const ec = expiryConfig[expiryInfo.status];
  const ExpiryIcon = ec.icon;

  return (
    <div className="space-y-2">
      {/* Link + copiar + refrescar + recaptura + WSP + email — todo en una línea */}
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-[11px]">
        <span className="text-violet-700 dark:text-violet-300 shrink-0">Link:</span>
        <code className="flex-1 truncate text-muted-foreground">{link}</code>
        {/* Copiar — siempre visible */}
        <Tooltip>
          <TooltipTrigger render={<Button size="sm" variant="outline" className="h-7 w-7 p-0 shrink-0" onClick={copyLink} />}>
            <Copy className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Copiar link</p>
          </TooltipContent>
        </Tooltip>
        {/* Renovar / Reactivar — antes de expirar o si está expirado pero sesión activa */}
        {canRenew && (
          <Tooltip>
            <TooltipTrigger render={
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              />
            }>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{canReactivate ? "Reactivar magic link (3 horas)" : "Renovar magic link"}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Rehabilitar captura — solo durante validez, icono mapa con pin */}
        {isWithinValidity && (
          <Tooltip>
            <TooltipTrigger render={
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => enableRecaptureMutation.mutate()}
                disabled={enableRecaptureMutation.isPending}
              />
            }>
              {enableRecaptureMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPinned className="h-3.5 w-3.5 text-primary" />
              )}
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Habilitar recaptura de ubicación</p>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Botones de envío — en la misma línea del link.
            Visibles mientras el link no esté expirado, o si se puede reactivar. */}
        {(expiryInfo.status !== "expired" || canReactivate) && (
          <>
            <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
            {/* WhatsApp abrir app (wa.me) — icono WhatsApp real */}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={sendWhatsAppMe}
                  disabled={!contactPhone}
                />
              }>
                <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{!contactPhone ? "No hay teléfono" : "Abrir WhatsApp con mensaje pre-llenado"}</p>
              </TooltipContent>
            </Tooltip>
            {/* WhatsApp Cloud API — solo si está configurado */}
            {whatsappCloudEnabled && (
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={sendWhatsAppCloud}
                    disabled={!contactPhone || sending === "whatsapp"}
                  />
                }>
                  {sending === "whatsapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{!contactPhone ? "No hay teléfono" : "Enviar por WhatsApp Cloud API"}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Email — icono Mail */}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={sendEmail}
                  disabled={!contactEmail || sending === "email"}
                />
              }>
                {sending === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{!contactEmail ? "No hay email" : "Enviar por email"}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Indicador de estado */}
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${ec.bg} ${ec.color}`}>
        <ExpiryIcon className="h-3 w-3" />
        {expiryInfo.label}
      </div>

      {/* Programado + Ventana en una sola línea */}
      {scheduledAt && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Programado:</span> {fmt(scheduledAt)}
          <span className="mx-2">-</span>
          <span className="font-medium text-foreground">Ventana:</span>{" "}
          {fmt(windowStart ? new Date(windowStart).toISOString() : null)} - {fmt(expiresAt)}
          {magicLinkExtended && <span className="ml-2 text-sky-600 dark:text-sky-400">· Extensión usada</span>}
        </div>
      )}
    </div>
  );
}
