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
 */

export type SignalingRole = "inspector" | "client";

export type SignalingMessage =
  | { type: "ready"; from: string; role: SignalingRole }
  | { type: "offer"; from: string; role: SignalingRole; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; role: SignalingRole; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; role: SignalingRole; candidate: RTCIceCandidateInit }
  | { type: "hangup"; from: string; role: SignalingRole }
  | { type: "screenshot"; from: string; role: SignalingRole; evidenceId: string; url: string };

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

  return {
    send: (msg: SignalingMessage) => {
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
 * STUN público de Google (gratis) — suficiente para la mayoría de conexiones p2p.
 * Para redes muy restrictivas (NAT simétrico) se necesitaría TURN, pero
 * eso requiere servidor con costo.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];
