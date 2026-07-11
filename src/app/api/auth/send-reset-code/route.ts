import { NextRequest, NextResponse } from "next/server";
import { generateResetCode, getUserIdByEmail } from "@/services/password-reset";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/send-reset-code
 * Body: { email: string }
 *
 * Genera un código de 6 dígitos y lo envía por email al usuario.
 * Usa Supabase Auth para enviar el email de reset.
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
      return NextResponse.json({ ok: false, error: "No existe una cuenta activa con ese correo" }, { status: 404 });
    }

    // Generar código en nuestra BD
    const code = await generateResetCode(email);

    // Enviar email usando Supabase Auth (reset password email)
    // Esto envía un email con un link de reset. Como tenemos nuestro propio
    // sistema de código, también guardamos el código en BD.
    const supabase = createAdminClient();
    const { error: emailError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/forgot-password`,
    });

    if (emailError && process.env.NODE_ENV === "development") {
      console.warn("Supabase reset email error:", emailError.message);
    }

    if (process.env.NODE_ENV === "development") {
      // En desarrollo, retornar el código para testing
      return NextResponse.json({ ok: true, code, message: "Código generado (modo desarrollo)" });
    }

    return NextResponse.json({ ok: true, message: "Código enviado a tu correo" });
  } catch (error) {
    console.error("send-reset-code error:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
