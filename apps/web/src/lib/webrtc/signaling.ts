"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Signaling para WebRTC peer-to-peer usando Supabase Realtime.
 *
 * Canal por sesión de inspección:
 *   - Nombre del canal: `webrtc:{sessionId}`
 *   - Broadcast de mensajes offer/answer/ice/hangup/ready
 *
 * Cada par (inspector y cliente) se une al canal y envía/recibe
 * mensajes de signaling. No requiere servidor SFU — es p2p directo.
 *
 * Mensajes:
 *   { type: "ready",     from, role }
 *   { type: "offer",     from, role, sdp }
 *   { type: "answer",    from, role, sdp }
 *   { type: "ice",       from, role, candidate }
 *   { type: "hangup",    from, role }
 *   { type: "screenshot", from, role, blobUrl } // aviso al otro par
 *   { type: "busy",      from, role, reason }   // rechazo: ya hay una sesión en curso
 *   { type: "kick",      from, role, target, reason } // inspector/supervisor fuerza desconexión de un peer
 *   { type: "preview",   from, role, remoteThumb, localThumb } // inspector envía thumbnails al supervisor
 */

export type SignalingRole = "inspector" | "client" | "supervisor";

export type SignalingMessage =
  | { type: "ready"; from: string; role: SignalingRole }
  | { type: "offer"; from: string; role: SignalingRole; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; role: SignalingRole; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; role: SignalingRole; candidate: RTCIceCandidateInit }
  | { type: "ice-batch"; from: string; role: SignalingRole; candidates: RTCIceCandidateInit[] }
  | { type: "hangup"; from: string; role: SignalingRole }
  | { type: "ping"; from: string; role: SignalingRole }
  | { type: "pong"; from: string; role: SignalingRole }
  | { type: "screenshot"; from: string; role: SignalingRole; evidenceId: string; url: string }
  | { type: "busy"; from: string; role: SignalingRole; reason: string }
  | { type: "kick"; from: string; role: SignalingRole; target: string; reason: string }
  | {
      type: "preview";
      from: string;
      role: SignalingRole;
      remoteThumb: string;
      localThumb: string;
      inspectorVideoOn?: boolean;
      inspectorAudioOn?: boolean;
      peerConnected?: boolean;
    };

export interface SignalingChannel {
  send: (msg: SignalingMessage) => void;
  onMessage: (handler: (msg: SignalingMessage) => void) => () => void;
  onPresence: (handler: (peers: { userId: string; role: SignalingRole }[]) => void) => () => void;
  leave: () => Promise<void>;
}

export function joinSignalingChannel(
  sessionId: string,
  userId: string,
  role: SignalingRole,
): SignalingChannel {
  const supabase = createClient();
  const channelName = `webrtc:${sessionId}`;

  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: userId },
    },
  });

  const messageHandlers = new Set<(msg: SignalingMessage) => void>();
  const presenceHandlers = new Set<(peers: { userId: string; role: SignalingRole }[]) => void>();

  // Suscribirse a mensajes broadcast
  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    if (payload && typeof payload === "object" && "type" in payload) {
      const msg = payload as SignalingMessage;
      // No reenviar a mí mismo
      if (msg.from === userId) return;
      messageHandlers.forEach((h) => h(msg));
    }
  });

  // Tracking de presencia
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<SignalingRole & { userId: string }>();
      const peers = Object.values(state)
        .flat()
        .map((p) => ({ userId: (p as unknown as { userId: string }).userId, role: (p as unknown as { role: SignalingRole }).role }))
        .filter((p) => p.userId !== userId);
      presenceHandlers.forEach((h) => h(peers));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, role });
        // Anunciar llegada
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "ready", from: userId, role } as SignalingMessage,
        });
      }
    });

  // Buffer para throttling de ICE candidates
  let iceBatchBuffer: RTCIceCandidateInit[] = [];
  let iceBatchTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    send: (msg: SignalingMessage) => {
      // Throttling de ICE candidates: agrupar en lotes de 500ms
      // para reducir el número de mensajes en Supabase Realtime.
      if (msg.type === "ice") {
        iceBatchBuffer.push(msg.candidate);
        if (!iceBatchTimer) {
          iceBatchTimer = setTimeout(() => {
            if (iceBatchBuffer.length > 0) {
              channel.send({
                type: "broadcast",
                event: "signal",
                payload: {
                  type: "ice-batch",
                  from: userId,
                  role,
                  candidates: iceBatchBuffer.splice(0),
                } as SignalingMessage,
              });
            }
            iceBatchTimer = null;
          }, 500);
        }
        return;
      }
      // Si hay candidates pendientes y se envía otro mensaje, flush inmediato
      if (iceBatchBuffer.length > 0 && iceBatchTimer) {
        clearTimeout(iceBatchTimer);
        iceBatchTimer = null;
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-batch",
            from: userId,
            role,
            candidates: iceBatchBuffer.splice(0),
          } as SignalingMessage,
        });
      }
      channel.send({ type: "broadcast", event: "signal", payload: msg });
    },
    onMessage: (handler) => {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onPresence: (handler) => {
      presenceHandlers.add(handler);
      return () => presenceHandlers.delete(handler);
    },
    leave: async () => {
      channel.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "hangup", from: userId, role } as SignalingMessage,
      });
      await supabase.removeChannel(channel);
    },
  };
}

/**
 * Configuración de servidores STUN/TURN.
 *
 * STUN público de Google como fallback — suficiente para conexiones p2p directas.
 * Para NAT simétrico / redes restrictivas se requiere TURN.
 *
 * Las credenciales TURN de Cloudflare se generan dinámicamente via
 * fetchIceServers() que llama al API route /api/turn-credentials.
 * Esto genera credenciales de corta duración (24h) más seguras que
 * credenciales estáticas.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

// Cache en memoria de iceServers obtenidos del backend.
// Evita llamar a /api/turn-credentials en cada creación de PeerConnection.
let cachedIceServers: RTCIceServer[] | null = null;
let cacheExpiresAt = 0;
const ICE_CACHE_TTL_MS = 20 * 60 * 60 * 1000; // 20 horas (las credenciales duran 24h)

/**
 * Obtiene servidores ICE dinámicos desde el backend (Cloudflare TURN).
 * Incluye STUN de Cloudflare + TURN sobre UDP/TCP/TLS con credenciales
 * de corta duración. Si el backend no responde, hace fallback a STUN de Google.
 *
 * Debe llamarse antes de crear un RTCPeerConnection.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  // Si tenemos caché válido, usarlo
  if (cachedIceServers && Date.now() < cacheExpiresAt) {
    return cachedIceServers;
  }

  try {
    const res = await fetch("/api/turn-credentials", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { iceServers?: RTCIceServer[] };
    if (data.iceServers && data.iceServers.length > 0) {
      cachedIceServers = data.iceServers;
      cacheExpiresAt = Date.now() + ICE_CACHE_TTL_MS;
      return data.iceServers;
    }
  } catch {
    // Silencioso — fallback a STUN estático
  }

  return ICE_SERVERS;
}
