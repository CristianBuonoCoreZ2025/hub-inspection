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
  /** Si true, `body` se envía como HTML. Si false, como texto plano. */
  html?: boolean;
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
  // Auto-detección de proveedor: si EMAIL_PROVIDER está seteado, se respeta.
  // Si no, se detecta por presencia de las API keys (Resend > SendGrid > console).
  const explicitProvider = process.env.EMAIL_PROVIDER?.toLowerCase();
  const provider =
    explicitProvider ||
    (process.env.RESEND_API_KEY ? "resend" : process.env.SENDGRID_API_KEY ? "sendgrid" : "console");

  // From: prioriza input > EMAIL_FROM > RESEND_FROM_EMAIL > SENDGRID_FROM_EMAIL > default
  const from =
    input.from ||
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SENDGRID_FROM_EMAIL ||
    "sistema@hub-inspection.cl";

  const isHtml = input.html === true;

  const payload = {
    from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: isHtml ? undefined : input.body,
    html: isHtml ? input.body : undefined,
    reply_to: input.replyTo,
  };

  if (provider === "console") {
    if (process.env.NODE_ENV !== "production") {
      console.log("--- E-mail (modo console) ---");
      console.log(JSON.stringify({ ...payload, html: isHtml ? "[HTML body]" : undefined }, null, 2));
    }
    return {
      status: "sent",
      provider,
      provider_response: { mode: "console", note: "No se envió realmente", html: isHtml },
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

    const content = isHtml
      ? [{ type: "text/html", value: input.body }]
      : [{ type: "text/plain", value: input.body }];

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: input.to.map((email) => ({ email })) }],
        from: { email: from },
        subject: input.subject,
        content,
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
