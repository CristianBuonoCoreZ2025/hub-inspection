import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * API route para generar credenciales TURN de Cloudflare de corta duración.
 *
 * GET /api/turn-credentials
 *   → Llama a la API de Cloudflare con el TURN Key ID + API Token
 *   → Devuelve { iceServers: [...] } con username + credential temporales (24h)
 *   → El browser usa estos iceServers al instanciar RTCPeerConnection
 *
 * Si Cloudflare no responde o no está configurado, hace fallback a STUN de Google.
 */

// Cache en memoria para evitar llamar a Cloudflare en cada request.
// Las credenciales duran 24h, renovamos a las 20h para tener margen.
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

export async function GET() {
  // Si tenemos caché válido, devolverlo
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ iceServers: cached.iceServers });
  }

  const iceServers = await fetchCloudflareIceServers();

  if (iceServers && iceServers.length > 0) {
    cached = {
      iceServers,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return NextResponse.json({ iceServers });
  }

  // Fallback: STUN solo (sin TURN — puede fallar en NAT simétrico)
  return NextResponse.json({ iceServers: FALLBACK_ICE_SERVERS });
}
