import { NextRequest, NextResponse } from "next/server";
import { validateResetCode, getUserIdByEmail, changeUserPassword } from "@/services/password-reset";

/**
 * POST /api/auth/verify-reset-code
 * Body: { email: string, code: string, password: string }
 * 
 * Valida el código de reset y cambia la contraseña del usuario.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();
    const code = body?.code?.trim();
    const password = body?.password;

    if (!email || !code || !password) {
      return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // Validar el código
    const isValid = await validateResetCode(email, code);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Código incorrecto o expirado" }, { status: 400 });
    }

    // Obtener el user_id
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // Cambiar la contraseña via admin API
    await changeUserPassword(userId, password);

    return NextResponse.json({ ok: true, message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("verify-reset-code error:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
