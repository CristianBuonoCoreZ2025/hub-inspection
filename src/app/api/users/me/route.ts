import { NextRequest, NextResponse } from "next/server";
import { updateOwnProfile } from "@/services/users-ops-server";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/users/me
 * Body: { phone?, rut?, avatar_url?, offline_pin? }
 *
 * Actualiza el perfil PROPIO del usuario autenticado.
 * Solo phone, rut, avatar_url, offline_pin. No email, role, company_id, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, rut, avatar_url, offline_pin } = body;

    // Si viene offline_pin, hashearlo y guardarlo directamente
    if (offline_pin !== undefined) {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

      // Si offline_pin es vacío, resetear (null)
      if (offline_pin === "") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ offline_pin_hash: null })
          .eq("user_id", user.id);

        if (updateError) throw new Error(updateError.message);
        return NextResponse.json({ success: true });
      }

      if (typeof offline_pin !== "string" || offline_pin.length < 4 || offline_pin.length > 6 || !/^\d+$/.test(offline_pin)) {
        return NextResponse.json({ error: "El PIN debe ser de 4 a 6 dígitos numéricos" }, { status: 400 });
      }

      const saltRounds = 10;
      const pin_hash = await bcrypt.hash(offline_pin, saltRounds);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ offline_pin_hash: pin_hash })
        .eq("user_id", user.id);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({ success: true });
    }

    const result = await updateOwnProfile({ phone, rut, avatar_url });
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "update own profile error",
      error instanceof Error ? error : new Error(String(error)),
      { component: "api-users-me", action: "POST" }
    );
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
