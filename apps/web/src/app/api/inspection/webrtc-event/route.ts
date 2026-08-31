import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para registrar y obtener eventos de WebRTC.
 *
 * POST: Registra un evento (peer_join, peer_leave, ice_restart, kick, etc.)
 * GET: Obtiene todos los eventos de una sesión
 */

async function getCurrentUser() {
  const serverClient = await createServerClient();
  const { data } = await serverClient.auth.getUser();
  return data.user;
}

async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.company_id || null;
}

async function getSessionCompanyId(sessionId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("inspection_sessions")
    .select("claim_id, claims!inner(company_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;
  const claims = data.claims as unknown[] | Record<string, unknown> | null | undefined;
  if (Array.isArray(claims)) {
    return ((claims[0] as Record<string, unknown> | undefined)?.company_id as string) || null;
  }
  return ((claims as Record<string, unknown> | null)?.company_id as string) || null;
}

async function isMagicLinkValid(sessionId: string, magicLinkToken: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("inspection_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("magic_link_token", magicLinkToken)
    .gt("magic_link_expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

async function canAccessSession(sessionId: string, magicLinkToken?: string): Promise<{ ok: boolean; status: number }> {
  if (magicLinkToken) {
    const valid = await isMagicLinkValid(sessionId, magicLinkToken);
    return valid ? { ok: true, status: 200 } : { ok: false, status: 403 };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401 };
  const [userCompanyId, sessionCompanyId] = await Promise.all([
    getCompanyIdForUser(user.id),
    getSessionCompanyId(sessionId),
  ]);
  if (!userCompanyId || !sessionCompanyId || userCompanyId !== sessionCompanyId) {
    return { ok: false, status: 403 };
  }
  return { ok: true, status: 200 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, role, eventType, details, magicLinkToken } = body;

    if (!sessionId || !role || !eventType) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: sessionId, role, eventType" },
        { status: 400 }
      );
    }

    const access = await canAccessSession(sessionId, magicLinkToken);
    if (!access.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: access.status });
    }

    const supabase = createAdminClient();

    // Obtener claim_id de la sesión
    const { data: session } = await supabase
      .from("inspection_sessions")
      .select("claim_id")
      .eq("id", sessionId)
      .maybeSingle();

    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || "";

    const { data, error } = await supabase
      .from("webrtc_events")
      .insert({
        session_id: sessionId,
        claim_id: session?.claim_id || null,
        role,
        event_type: eventType,
        details: details || {},
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    logger.error("API /api/inspection/webrtc-event POST error", err as Error, {
      component: "webrtc-event",
      action: "webrtc.event.create",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar evento" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    const access = await canAccessSession(sessionId);
    if (!access.ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: access.status });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("webrtc_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ events: data || [] });
  } catch (err) {
    logger.error("API /api/inspection/webrtc-event GET error", err as Error, {
      component: "webrtc-event",
      action: "webrtc.event.list",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener eventos" },
      { status: 500 }
    );
  }
}
