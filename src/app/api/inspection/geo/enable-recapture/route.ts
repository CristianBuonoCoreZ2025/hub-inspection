import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";

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
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    const claimData = Array.isArray(session.claim) ? session.claim[0] : session.claim;
    const claimCompanyId = (claimData as { company_id?: string } | undefined)?.company_id;
    const isInternal = (profile as { role?: string } | null)?.role === "internal";
    const isAuthorized = isInternal || claimCompanyId === profile?.company_id;
    if (!profile || !isAuthorized) {
      return NextResponse.json(
        { error: "No autorizado", debug: { profileCompanyId: profile?.company_id, claimCompanyId, role: profile?.role } },
        { status: 403 }
      );
    }

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
