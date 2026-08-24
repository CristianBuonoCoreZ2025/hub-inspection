import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════
// API Route: Envío de magic link por WhatsApp Cloud API o Email
// ═══════════════════════════════════════════════════════════════
//
// Variables de entorno necesarias:
//   WHATSAPP_PHONE_NUMBER_ID  — Meta Phone Number ID
//   WHATSAPP_ACCESS_TOKEN     — Meta Access Token (permanent)
//   RESEND_API_KEY            — Resend API key (3000 emails gratis/mes)
//   RESEND_FROM_EMAIL         — Email remitente (ej: noreply@tudominio.com)
//
// Para configurar WhatsApp Cloud API:
//   1. Crear app en https://developers.facebook.com/
//   2. Agregar producto WhatsApp
//   3. Obtener Phone Number ID y Access Token
//   4. Agregar variables a .env.local
//
// Para configurar Resend:
//   1. Crear cuenta en https://resend.com
//   2. Obtener API key
//   3. Verificar dominio
//   4. Agregar variables a .env.local
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { method, phone, email, name, link } = body as {
    method: "whatsapp" | "email";
    phone?: string;
    email?: string;
    name?: string;
    link: string;
  };

  if (!link) {
    return NextResponse.json({ error: "Link no proporcionado" }, { status: 400 });
  }

  const contactName = name || "el contacto";
  const message = `Hola ${contactName}, aquí está el link para su inspección remota: ${link}`;

  // ── WhatsApp Cloud API ──
  if (method === "whatsapp") {
    if (!phone) {
      return NextResponse.json({ error: "Teléfono no proporcionado" }, { status: 400 });
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: "WhatsApp Cloud API no configurado. Use el botón 'WhatsApp' (wa.me) como alternativa." },
        { status: 503 }
      );
    }

    // Limpiar teléfono (solo dígitos, sin +)
    const cleanPhone = phone.replace(/[^0-9]/g, "");

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json(
          { error: `WhatsApp API: ${err.error?.message || "Error desconocido"}` },
          { status: res.status }
        );
      }

      return NextResponse.json({ success: true, method: "whatsapp" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Email via Resend ──
  if (method === "email") {
    if (!email) {
      return NextResponse.json({ error: "Email no proporcionado" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";

    if (!apiKey) {
      // Fallback: usar Supabase Auth (si está configurado)
      return NextResponse.json(
        { error: "Resend no configurado. Agregar RESEND_API_KEY a .env.local" },
        { status: 503 }
      );
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "Link de Inspección Remota",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Inspección Remota</h2>
              <p>Hola ${contactName},</p>
              <p>Haga clic en el siguiente enlace para acceder a su inspección remota:</p>
              <p style="margin: 20px 0;">
                <a href="${link}"
                   style="display: inline-block; padding: 10px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Acceder a Inspección
                </a>
              </p>
              <p style="color: #666; font-size: 12px;">
                Si no puede hacer clic, copie este enlace:<br>
                ${link}
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 11px;">Este enlace expira en 24 horas.</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json(
          { error: `Resend: ${err.message || "Error enviando email"}` },
          { status: res.status }
        );
      }

      return NextResponse.json({ success: true, method: "email" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Método no válido" }, { status: 400 });
}
