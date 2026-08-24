import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para registrar y obtener logs de eventos de inspección.
 *
 * POST: Registra un evento (foto tomada, video grabado, upload, delete, etc.)
 * GET: Obtiene todos los logs de eventos de una sesión
 *
 * Mismo patrón de autorización que connection-log:
 * - Usuario autenticado de la misma empresa, o
 * - Magic link anónimo válido
 */

// ─── Parser de User-Agent ───
function parseUserAgent(ua: string) {
  const deviceType = /Mobile|Android|iPhone/i.test(ua) ? "mobile"
    : /iPad|Tablet/i.test(ua) ? "tablet"
    : "desktop";

  let browser = "unknown";
  if (/Edg\/([\d.]+)/.test(ua)) browser = "Edge";
  else if (/Chrome\/([\d.]+)/.test(ua) && !/Edg/.test(ua)) browser = "Chrome";
  else if (/Firefox\/([\d.]+)/.test(ua)) browser = "Firefox";
  else if (/Safari\/([\d.]+)/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  let os = "unknown";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { deviceType, browser, os };
}

// ─── Autorización (mismo patrón que connection-log) ───
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

async function canAccessSession(sessionId: string, magicLinkToken?: string): Promise<boolean> {
  if (magicLinkToken) {
    return isMagicLinkValid(sessionId, magicLinkToken);
  }
  const user = await getCurrentUser();
  if (!user) return false;
  const [userCompanyId, sessionCompanyId] = await Promise.all([
    getCompanyIdForUser(user.id),
    getSessionCompanyId(sessionId),
  ]);
  return !!userCompanyId && !!sessionCompanyId && userCompanyId === sessionCompanyId;
}

// ─── POST: Registrar evento ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      role,
      eventType,
      eventDetail,
      evidenceId,
      actorName,
      metadata,
      magicLinkToken,
    } = body;

    if (!sessionId || !eventType) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: sessionId, eventType" },
        { status: 400 }
      );
    }

    const ok = await canAccessSession(sessionId, magicLinkToken);
    if (!ok) {
      return NextResponse.json(
        { error: "No autorizado para acceder a esta sesión" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // Obtener claim_id de la sesión
    const { data: session } = await supabase
      .from("inspection_sessions")
      .select("claim_id")
      .eq("id", sessionId)
      .maybeSingle();

    // Datos del dispositivo desde headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || "";
    const { deviceType, browser, os } = parseUserAgent(userAgent);

    const { error } = await supabase.from("inspection_event_logs").insert({
      session_id: sessionId,
      claim_id: session?.claim_id || null,
      role: role || "adjuster",
      actor_name: actorName || null,
      event_type: eventType,
      event_detail: eventDetail || null,
      evidence_id: evidenceId || null,
      ip_address: ipAddress,
      user_agent: userAgent || null,
      device_type: deviceType,
      browser,
      os,
      metadata: metadata || null,
    });

    if (error) {
      logger.error("event-log: error insertando", new Error(error.message), {
        component: "inspection-event-log",
        action: "insert",
        metadata: { sessionId, eventType, error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("event-log: error general", err as Error, {
      component: "inspection-event-log",
      action: "route.post",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

// ─── GET: Obtener logs de eventos ───
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    const ok = await canAccessSession(sessionId);
    if (!ok) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inspection_event_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    logger.error("event-log: error en GET", err as Error, {
      component: "inspection-event-log",
      action: "route.get",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
