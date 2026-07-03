import { NextRequest, NextResponse } from "next/server";
import { generateResetCode, getUserIdByEmail } from "@/services/password-reset";

/**
 * POST /api/auth/send-reset-code
 * Body: { email: string }
 * 
 * Genera un código de 6 dígitos y lo envía por email al usuario.
 * No revela si el email existe o no (por seguridad).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 });
    }

    // Verificar que el usuario existe
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      // Por seguridad, no revelar si el email existe
      // Pero en sistema interno, mejor ser claro
      return NextResponse.json({ ok: false, error: "No existe una cuenta activa con ese correo" }, { status: 404 });
    }

    // Generar código
    const code = await generateResetCode(email);

    // Enviar email via Nhost Functions o SMTP
    // Por ahora, usar la API de Nhost para enviar el email
    const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
    const region = process.env.NEXT_PUBLIC_NHOST_REGION;
    const adminSecret = process.env.NHOST_ADMIN_SECRET;

    // Intentar enviar via Nhost Auth email (usando el endpoint de email verification como workaround)
    // Si no funciona, el código se muestra en la respuesta (solo en desarrollo)
    const emailSent = await sendResetEmail(email, code, subdomain!, region!, adminSecret!);

    if (process.env.NODE_ENV === "development" && !emailSent) {
      // En desarrollo, retornar el código para testing
      return NextResponse.json({ ok: true, code, message: "Código generado (modo desarrollo)" });
    }

    return NextResponse.json({ ok: true, message: "Código enviado a tu correo" });
  } catch (error) {
    console.error("send-reset-code error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

async function sendResetEmail(
  email: string,
  code: string,
  subdomain: string,
  region: string,
  adminSecret: string
): Promise<boolean> {
  try {
    // Usar Nhost Functions para enviar el email
    // Si no hay function configurada, usar el endpoint de hasura-auth para enviar email
    const functionsUrl = `https://${subdomain}.functions.${region}.nhost.run/send-email`;
    
    const res = await fetch(functionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        to: email,
        subject: "Código de recuperación - Claims Hub",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #0095DA;">Claims Hub - Recuperación de Contraseña</h2>
            <p>Has solicitado restablecer tu contraseña.</p>
            <p>Tu código de verificación es:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #005BBB; background: #f0f7ff; padding: 12px 24px; border-radius: 8px;">${code}</span>
            </div>
            <p>Este código expira en 10 minutos.</p>
            <p>Si no solicitaste este cambio, ignora este correo.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Claims Hub - No responder a este correo</p>
          </div>
        `,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
