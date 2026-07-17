"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, Mail, Send, Phone } from "lucide-react";
import { toast } from "sonner";

interface MagicLinkSenderProps {
  token: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function MagicLinkSender({ token, contactName, contactEmail, contactPhone }: MagicLinkSenderProps) {
  const [sending, setSending] = React.useState<"whatsapp" | "email" | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/inspection/${token}` : "";

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    }
  };

  // 1. wa.me — abre WhatsApp con mensaje pre-llenado (sin costo, sin backend)
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

  // 2. WhatsApp Cloud API — envía directo desde el backend (1000 gratis/mes)
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
        body: JSON.stringify({
          method: "whatsapp",
          phone: contactPhone,
          name: contactName,
          link,
        }),
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

  // 3. Email via Resend — envía desde el backend (3000 gratis/mes)
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
        body: JSON.stringify({
          method: "email",
          email: contactEmail,
          name: contactName,
          link,
        }),
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

  const btnClass = "pg-btn-platinum h-7 text-[12px] gap-1.5 shrink-0";

  return (
    <div className="space-y-2">
      {/* Link + copiar */}
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-[12px]">
        <span className="text-violet-700 dark:text-violet-300 shrink-0">Link:</span>
        <code className="flex-1 truncate text-muted-foreground">{link}</code>
        <Button size="sm" variant="outline" className="btn-icon-sm shrink-0" onClick={copyLink}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Botones de envío */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className={btnClass}
          onClick={sendWhatsAppMe}
          disabled={!contactPhone}
          title={!contactPhone ? "No hay teléfono" : "Abrir WhatsApp con mensaje pre-llenado"}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button
          className={btnClass}
          onClick={sendWhatsAppCloud}
          disabled={!contactPhone || sending === "whatsapp"}
          title={!contactPhone ? "No hay teléfono" : "Enviar por WhatsApp Cloud API"}
        >
          <Send className="h-3.5 w-3.5" />
          {sending === "whatsapp" ? "Enviando..." : "Enviar WA"}
        </Button>
        <Button
          className={btnClass}
          onClick={sendEmail}
          disabled={!contactEmail || sending === "email"}
          title={!contactEmail ? "No hay email" : "Enviar por email"}
        >
          <Mail className="h-3.5 w-3.5" />
          {sending === "email" ? "Enviando..." : "Email"}
        </Button>
      </div>

      {/* Info de contacto disponible */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {contactPhone ? (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" /> {contactPhone}
          </span>
        ) : (
          <span className="text-amber-500">Sin teléfono</span>
        )}
        {contactEmail ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {contactEmail}
          </span>
        ) : (
          <span className="text-amber-500">Sin email</span>
        )}
      </div>
    </div>
  );
}
