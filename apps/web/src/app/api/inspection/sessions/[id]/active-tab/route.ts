import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/inspection/sessions/{id}/active-tab
 * Sincroniza el tab activo de una sesión desde el dashboard.
 * Body: { active_tab: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = (await request.json()) as { active_tab?: string };
    if (!body.active_tab || typeof body.active_tab !== "string") {
      return NextResponse.json({ error: "active_tab requerido" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("inspection_sessions")
      .update({ active_tab: body.active_tab })
      .eq("id", id)
      .select("id, active_tab")
      .single();

    if (error) throw new Error(error.message);

    logger.info("Tab activo sincronizado", {
      component: "inspection-active-tab",
      action: "update.active_tab",
      metadata: { sessionId: id, activeTab: body.active_tab, userId: user.id },
    });

    return NextResponse.json({ session: updated });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Error sincronizando active_tab", error, {
      component: "inspection-active-tab",
      action: "update.active_tab.error",
    });
    return NextResponse.json(
      { error: "No se pudo sincronizar el tab", detail: error.message || String(err) },
      { status: 500 }
    );
  }
}
