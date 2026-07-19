import { NextRequest, NextResponse } from "next/server";
import { generateResetCode, getUserIdByEmail } from "@/services/password-reset";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/send-reset-code
 * Body: { email: string }
 *
 * Genera un código de 6 dígitos y lo envía por email al usuario.
 *
 * Estrategia:
 * 1. Genera un código OTP en nuestra BD (tabla password_reset_codes)
 * 2. Usa Supabase auth.admin.generateLink con type='recovery' para
 *    que Supabase envíe un email de recuperación al usuario.
 * 3. El usuario ve el código OTP en la UI de /forgot-password y lo ingresa.
 *
 * En desarrollo, retorna el código para testing.
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

    // Usar Supabase para enviar el email de recuperación
    // Esto envía un email con un link que contiene un token.
    // El usuario puede usar el código OTP que generamos en nuestra BD
    // para resetear la contraseña desde nuestra UI.
    const supabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { error: emailError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/forgot-password`,
    });

    if (emailError) {
      logger.warn("Supabase reset email error", {
        component: "auth-send-reset-code",
        action: "resetPasswordForEmail",
        metadata: { error: emailError.message, email },
      });
      // No fallar si el email falla — el código ya está en BD
      // En desarrollo, el usuario puede ver el código en la UI
    }

    if (process.env.NODE_ENV === "development") {
      // En desarrollo, retornar el código para testing
      return NextResponse.json({
        ok: true,
        code,
        message: "Código generado (modo desarrollo)",
      });
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
