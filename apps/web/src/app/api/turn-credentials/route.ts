import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * API route para generar credenciales TURN de Cloudflare de corta duración.
 *
 * GET /api/turn-credentials
 *   → Llama a la API de Cloudflare con el TURN Key ID + API Token
 *   → Devuelve { iceServers: [...] } con username + credential temporales (24h)
 *   → El browser usa estos iceServers al instanciar RTCPeerConnection
 *
 * Cache de dos niveles:
 *   1. Memoria (por instancia de Vercel) — instantáneo
 *   2. Supabase (tabla turn_cache) — compartido entre todas las instancias
 *
 * Si Cloudflare no responde o no está configurado, hace fallback a STUN de Google.
 */

// Cache en memoria L1 (por instancia)
interface CachedIceServers {
  iceServers: RTCIceServer[];
  expiresAt: number;
}
let cached: CachedIceServers | null = null;
const CACHE_TTL_MS = 20 * 60 * 60 * 1000; // 20 horas

// STUN de fallback si Cloudflare no está configurado o falla
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

async function fetchCloudflareIceServers(): Promise<RTCIceServer[] | null> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    logger.warn("[turn-credentials] CLOUDFLARE_TURN_KEY_ID o CLOUDFLARE_TURN_API_TOKEN no configurados — usando STUN fallback");
    return null;
  }

  const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }), // 24 horas
      // No esperamos más de 5s — si Cloudflare tarda, usamos fallback
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`[turn-credentials] Cloudflare respondió ${res.status}: ${text}`);
      return null;
    }

    const data = (await res.json()) as { iceServers?: RTCIceServer[] };

    if (!data.iceServers || !Array.isArray(data.iceServers)) {
      logger.error("[turn-credentials] Respuesta de Cloudflare sin iceServers");
      return null;
    }

    // Filtrar URLs con puerto 53 — bloqueado por Chrome/Firefox y causa timeouts
    const filtered = data.iceServers.map((server) => {
      if (!server.urls) return server;
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      const cleanUrls = urls.filter((u) => !/:53\b/.test(u));
      return { ...server, urls: cleanUrls.length > 0 ? cleanUrls : server.urls };
    });

    return filtered;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[turn-credentials] Error al contactar Cloudflare: ${msg}`);
    return null;
  }
}

// Cache L2: Supabase (compartido entre instancias)
async function getSupabaseCache(): Promise<CachedIceServers | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("turn_cache")
      .select("ice_servers, expires_at")
      .eq("id", "singleton")
      .limit(1);

    if (error || !data?.length) return null;

    const row = data[0] as { ice_servers: RTCIceServer[]; expires_at: number };
    if (Date.now() < row.expires_at) {
      return { iceServers: row.ice_servers, expiresAt: row.expires_at };
    }
    return null;
  } catch {
    return null;
  }
}

async function setSupabaseCache(iceServers: RTCIceServer[], expiresAt: number): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await supabase
      .from("turn_cache")
      .upsert({ id: "singleton", ice_servers: iceServers, expires_at: expiresAt });
  } catch {
    // Silencioso — el cache L1 sigue funcionando
  }
}

export async function GET() {
  // L1: cache en memoria
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ iceServers: cached.iceServers });
  }

  // L2: cache en Supabase (compartido entre instancias)
  const supabaseCache = await getSupabaseCache();
  if (supabaseCache) {
    cached = supabaseCache;
    return NextResponse.json({ iceServers: supabaseCache.iceServers });
  }

  // L3: llamar a Cloudflare
  const iceServers = await fetchCloudflareIceServers();

  if (iceServers && iceServers.length > 0) {
    const expiresAt = Date.now() + CACHE_TTL_MS;
    cached = { iceServers, expiresAt };
    // Guardar en Supabase para otras instancias
    await setSupabaseCache(iceServers, expiresAt);
    return NextResponse.json({ iceServers });
  }

  // Fallback: STUN solo (sin TURN — puede fallar en NAT simétrico)
  return NextResponse.json({ iceServers: FALLBACK_ICE_SERVERS });
}
