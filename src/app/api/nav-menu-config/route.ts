import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logger";

/**
 * GET /api/nav-menu-config
 *   Retorna la configuración del menú (singleton id=1).
 *
 * POST /api/nav-menu-config
 *   Body: { items: NavMenuItem[] }
 *   Guarda la configuración del menú usando service role (bypass RLS).
 *   Solo usuarios autenticados pueden guardar — el acceso admin se controla
 *   en el frontend via usePermissions + SectionGuard.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("nav_menu_config")
      .select("id, config, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ config: data?.config ?? null });
  } catch (err) {
    logger.error("API nav-menu-config GET error", err as Error);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al leer config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();

    const body = await req.json();
    const { items } = body as { items?: unknown };

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Falta 'items' (array) en el body" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("nav_menu_config")
      .upsert(
        { id: 1, config: { items } },
        { onConflict: "id" }
      )
      .eq("id", 1);

    if (error) throw new Error(error.message);

    logger.info("Menú guardado", {
      component: "nav-menu-config",
      action: "save",
      metadata: { userId: user.id, itemCount: items.length },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API nav-menu-config POST error", err as Error);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar" },
      { status: 500 }
    );
  }
}
