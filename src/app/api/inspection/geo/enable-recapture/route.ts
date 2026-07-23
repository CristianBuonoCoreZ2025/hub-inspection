import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { enableGeoRecapture } from "@/services/inspections";

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

    // Verificar que el usuario pertenece a la misma compañía de la sesión (RLS no cubre auth externo)
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("inspection_sessions")
      .select("id, claim:claims(company_id), inspector_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || (session.claim as unknown as { company_id: string } | null)?.company_id !== profile.company_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const updated = await enableGeoRecapture(sessionId);
    return NextResponse.json({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al habilitar recaptura";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
