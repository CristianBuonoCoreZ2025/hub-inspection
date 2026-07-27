import { NextRequest, NextResponse } from "next/server";
import { generateResetCode, getUserIdByEmail } from "@/services/password-reset";
import { sendEmail } from "@/services/email-sender";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/send-reset-code
 * Body: { email: string }
 *
 * Genera un código OTP de 6 dígitos, lo guarda en la BD
 * (tabla password_reset_codes) y lo envía por email al usuario
 * usando el proveedor configurado (Resend/SendGrid).
 *
 * El usuario ingresa el código en la UI de /forgot-password para
 * validar su identidad y setear una nueva contraseña.
 *
 * En desarrollo (NODE_ENV=development), retorna el código para
 * testing — no requiere proveedor de email configurado.
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
      return NextResponse.json(
        { ok: false, error: "No existe una cuenta activa con ese correo" },
        { status: 404 }
      );
    }

    // Generar código OTP en nuestra BD
    const code = await generateResetCode(email);

    // En desarrollo, retornar el código para testing sin enviar email
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        ok: true,
        code,
        message: "Código generado (modo desarrollo)",
      });
    }

    // En producción, enviar el código por email via el proveedor configurado
    const siteName = process.env.NEXT_PUBLIC_APP_NAME || "Claims Hub";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #0f172a; margin: 0 0 8px 0;">${siteName}</h2>
        <p style="color: #475569; margin: 0 0 24px 0;">Recuperación de contraseña</p>
        <p style="color: #1e293b; margin: 0 0 16px 0;">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
        </p>
        <p style="color: #1e293b; margin: 0 0 24px 0;">
          Usa el siguiente código de verificación para continuar:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #7c3aed; background: #f5f3ff; padding: 16px 24px; border-radius: 12px; border: 1px solid #ddd6fe;">
            ${code}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
          Este código expira en 10 minutos.
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 0 0 24px 0;">
          Si no solicitaste este cambio, puedes ignorar este correo.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          Este es un mensaje automático, no respondas a este correo.
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: [email],
      subject: `Código de verificación — ${siteName}`,
      body: html,
      html: true,
    });

    if (result.status === "failed") {
      logger.error("send-reset-code: email send failed", new Error(JSON.stringify(result.provider_response)), {
        component: "auth-send-reset-code",
        action: "sendEmail",
        metadata: { email, provider: result.provider },
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo enviar el correo. Intenta nuevamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Código enviado a tu correo",
    });
  } catch (error) {
    logger.error(
      "send-reset-code error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "auth-send-reset-code", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
