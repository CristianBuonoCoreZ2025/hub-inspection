import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * POST: Recibe una lista de session_ids y devuelve cuáles tienen
 * connection logs o webrtc events. Usado por la grilla para saber
 * qué inspecciones tienen datos de monitoreo.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionIds } = await request.json();

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ sessionIds: [] });
    }

    // Validar autenticación
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Buscar session_ids que tienen connection logs
    const { data: logSessions } = await supabase
      .from("magic_link_connection_logs")
      .select("session_id")
      .in("session_id", sessionIds)
      .limit(500);

    // Buscar session_ids que tienen webrtc events
    const { data: eventSessions } = await supabase
      .from("webrtc_events")
      .select("session_id")
      .in("session_id", sessionIds)
      .limit(500);

    const result = new Set<string>();
    logSessions?.forEach((r) => result.add(r.session_id));
    eventSessions?.forEach((r) => result.add(r.session_id));

    return NextResponse.json({ sessionIds: Array.from(result) });
  } catch (err) {
    logger.error("API /api/inspection/monitoring-sessions error", err as Error, {
      component: "monitoring-sessions",
      action: "monitoring.sessions.list",
    });
    return NextResponse.json({ sessionIds: [] });
  }
}
