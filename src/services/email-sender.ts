"use server";

// ──────────────────────────────────────────────────────────────
// Envío real de e-mails
// Soporta Resend, SendGrid o modo console para testing.
// Configurable por variables de entorno.
// ──────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  status: "sent" | "failed" | "queued";
  provider: string;
  provider_response: Record<string, unknown>;
  messageId?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || "console";
  const from = input.from || process.env.EMAIL_FROM || "sistema@hub-inspection.cl";

  const payload = {
    from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.body,
    reply_to: input.replyTo,
  };

  if (provider === "console") {
    console.log("--- E-mail (modo console) ---");
    console.log(JSON.stringify(payload, null, 2));
    return {
      status: "sent",
      provider,
      provider_response: { mode: "console", note: "No se envió realmente" },
      messageId: `console-${Date.now()}`,
    };
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY no configurada");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { status: "failed", provider, provider_response: json };
    }
    return {
      status: "sent",
      provider,
      provider_response: json,
      messageId: String(json.id || ""),
    };
  }

  if (provider === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error("SENDGRID_API_KEY no configurada");

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: input.to.map((email) => ({ email })) }],
        from: { email: from },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body }],
      }),
    });

    const text = await res.text().catch(() => "");
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      return { status: "failed", provider, provider_response: json };
    }
    return { status: "sent", provider, provider_response: json };
  }

  throw new Error(`EMAIL_PROVIDER "${provider}" no soportado. Usa console, resend o sendgrid.`);
}
