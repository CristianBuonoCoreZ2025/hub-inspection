import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * API route para registrar y obtener logs de conexión del magic link.
 *
 * POST: Registra un evento de conexión (connect, retry, disconnect, etc.)
 * GET: Obtiene todos los logs de una sesión
 */

// ─── Parser de User-Agent ───
function parseUserAgent(ua: string) {
  const deviceType = /Mobile|Android|iPhone/i.test(ua) ? "mobile"
    : /iPad|Tablet/i.test(ua) ? "tablet"
    : /TV|SmartTV/i.test(ua) ? "tv"
    : "desktop";

  let browser = "unknown";
  let browserVersion = "";
  if (/Edg\/([\d.]+)/.test(ua)) {
    browser = "Edge";
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
  } else if (/Chrome\/([\d.]+)/.test(ua) && !/Edg/.test(ua)) {
    browser = "Chrome";
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
  } else if (/Firefox\/([\d.]+)/.test(ua)) {
    browser = "Firefox";
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
  } else if (/Safari\/([\d.]+)/.test(ua) && !/Chrome/.test(ua)) {
    browser = "Safari";
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || "";
  }

  let os = "unknown";
  let osVersion = "";
  if (/Windows NT ([\d.]+)/.test(ua)) {
    os = "Windows";
    osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || "";
  } else if (/Android ([\d.]+)/.test(ua)) {
    os = "Android";
    osVersion = ua.match(/Android ([\d.]+)/)?.[1] || "";
  } else if (/iPhone OS ([\d_]+)/.test(ua)) {
    os = "iOS";
    osVersion = (ua.match(/iPhone OS ([\d_]+)/)?.[1] || "").replace(/_/g, ".");
  } else if (/Mac OS X ([\d_]+)/.test(ua)) {
    os = "macOS";
    osVersion = (ua.match(/Mac OS X ([\d_]+)/)?.[1] || "").replace(/_/g, ".");
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  return { deviceType, browser, browserVersion, os, osVersion };
}

// ─── Autorización ───
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

  // claims puede venir como objeto o array dependiendo de la relación
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
  if (!user) {
    return { ok: false, status: 401 };
  }

  const [userCompanyId, sessionCompanyId] = await Promise.all([
    getCompanyIdForUser(user.id),
    getSessionCompanyId(sessionId),
  ]);

  if (!userCompanyId || !sessionCompanyId || userCompanyId !== sessionCompanyId) {
    return { ok: false, status: 403 };
  }

  return { ok: true, status: 200 };
}

// ─── POST: Registrar evento ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      role,
      status,
      cameraPermission,
      microphonePermission,
      retryCount,
      failureReason,
      disconnectReason,
      logId, // si viene, es una actualización de un log existente
      magicLinkToken,
    } = body;

    if (!sessionId || !role || !status) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: sessionId, role, status" },
        { status: 400 }
      );
    }

    const access = await canAccessSession(sessionId, magicLinkToken);
    if (!access.ok) {
      return NextResponse.json(
        { error: "No autorizado para acceder a esta sesión" },
        { status: access.status }
      );
    }

    const supabase = createAdminClient();

    // Obtener claim_id de la sesión
    const { data: session } = await supabase
      .from("inspection_sessions")
      .select("claim_id")
      .eq("id", sessionId)
      .maybeSingle();

    // Datos de red desde headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || "";
    const { deviceType, browser, browserVersion, os, osVersion } = parseUserAgent(userAgent);

    // Geolocalización por IP (usando ipapi.co, sin API key)
    let geoData: { country?: string; region?: string; city?: string; latitude?: number; longitude?: number } = {};
    if (ipAddress && ipAddress !== "127.0.0.1" && ipAddress !== "::1") {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
          signal: AbortSignal.timeout(3000),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (!geo.error) {
            geoData = {
              country: geo.country_name || null,
              region: geo.region || null,
              city: geo.city || null,
              latitude: geo.latitude || null,
              longitude: geo.longitude || null,
            };
          }
        }
      } catch {
        // Si falla la geolocalización, continuamos sin datos geo
      }
    }

    if (logId) {
      // Actualizar un log existente (ej: marcar desconexión)
      const updateData: Record<string, unknown> = {};
      if (disconnectReason !== undefined) updateData.disconnect_reason = disconnectReason;
      if (cameraPermission !== undefined) updateData.camera_permission = cameraPermission;
      if (microphonePermission !== undefined) updateData.microphone_permission = microphonePermission;

      // Si la desconexión llega sobre un log que ya estaba en "success",
      // NO sobrescribimos el status (preservamos el éxito de la conexión).
      // Solo marcamos disconnected_at y el motivo.
      if (status === "disconnected") {
        updateData.disconnected_at = new Date().toISOString();
        // Verificar el estado actual antes de sobrescribir
        const { data: existing } = await supabase
          .from("magic_link_connection_logs")
          .select("status")
          .eq("id", logId)
          .maybeSingle();
        if (existing?.status !== "success") {
          updateData.status = status;
        }
      } else if (status === "kicked") {
        updateData.status = status;
        updateData.disconnected_at = new Date().toISOString();
      } else {
        updateData.status = status;
      }

      const { data, error } = await supabase
        .from("magic_link_connection_logs")
        .update(updateData)
        .eq("id", logId)
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ id: data.id });
    }

    // Insertar nuevo log
    const { data, error } = await supabase
      .from("magic_link_connection_logs")
      .insert({
        session_id: sessionId,
        claim_id: session?.claim_id || null,
        role,
        status,
        ip_address: ipAddress,
        country: geoData.country || null,
        region: geoData.region || null,
        city: geoData.city || null,
        latitude: geoData.latitude || null,
        longitude: geoData.longitude || null,
        user_agent: userAgent,
        device_type: deviceType,
        browser,
        browser_version: browserVersion,
        os,
        os_version: osVersion,
        camera_permission: cameraPermission || "not_requested",
        microphone_permission: microphonePermission || "not_requested",
        retry_count: retryCount || 0,
        failure_reason: failureReason || null,
        disconnect_reason: disconnectReason || null,
        connected_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    logger.error("API /api/inspection/connection-log POST error", err as Error, {
      component: "connection-log",
      action: "connection.log.create",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al registrar log" },
      { status: 500 }
    );
  }
}

// ─── GET: Obtener logs de una sesión ───
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    const access = await canAccessSession(sessionId);
    if (!access.ok) {
      return NextResponse.json(
        { error: "No autorizado para acceder a esta sesión" },
        { status: access.status }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("magic_link_connection_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("connected_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    logger.error("API /api/inspection/connection-log GET error", err as Error, {
      component: "connection-log",
      action: "connection.log.list",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener logs" },
      { status: 500 }
    );
  }
}
