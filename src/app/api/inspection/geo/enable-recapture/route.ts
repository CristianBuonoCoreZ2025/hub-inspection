import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/geo/enable-recapture
 * Habilita la recaptura de geolocalización para una sesión remota.
 * Body: { sessionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = (await req.json()) as { sessionId?: string };
    const { sessionId } = body;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: session } = await admin
      .from("inspection_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    logger.info("Habilitar recaptura geo", {
      component: "enable-recapture",
      action: "authorize",
      metadata: { userId: user.id, sessionId },
    });

    const { data: updated, error } = await admin
      .from("inspection_sessions")
      .update({ geo_recapture_enabled: true })
      .eq("id", sessionId)
      .select("id, geo_recapture_enabled")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al habilitar recaptura";
    logger.error("Error al habilitar recaptura", err instanceof Error ? err : new Error(message), {
      component: "enable-recapture",
      action: "error",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
