"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionPresence {
  inspector: boolean;
  client: boolean;
  supervisor: boolean;
}

/**
 * Rastrea la presencia (online/offline) de inspector y asegurado
 * en múltiples sesiones de inspección remotas en tiempo real.
 *
 * Se suscribe al MISMO canal de signaling `webrtc:{sessionId}` que usan
 * el inspector y el asegurado, pero SIN hacer track (no aparece como
 * participante). Esto permite ver la presencia real sin afectar el flujo.
 *
 * Nota: Supabase presence solo funciona dentro del mismo canal. Si te
 * suscribes a un canal con nombre distinto, no verás la presencia de
 * los participantes del canal original.
 *
 * @param sessionIds Array de IDs de sesión a monitorear
 * @returns Map de sessionId → SessionPresence
 */
export function useSessionsPresence(sessionIds: string[]): Record<string, SessionPresence> {
  const [presence, setPresence] = useState<Record<string, SessionPresence>>({});
  const channelsRef = useRef<Array<{ channel: ReturnType<ReturnType<typeof createClient>["channel"]>; sessionId: string }>>([]);

  useEffect(() => {
    const supabase = createClient();

    // Limpiar canales anteriores
    channelsRef.current.forEach(({ channel }) => void supabase.removeChannel(channel));
    channelsRef.current = [];

    if (sessionIds.length === 0) return;

    const newPresence: Record<string, SessionPresence> = {};

    for (const sessionId of sessionIds) {
      newPresence[sessionId] = { inspector: false, client: false, supervisor: false };

      // Usar el MISMO nombre de canal que joinSignalingChannel
      const channel = supabase.channel(`webrtc:${sessionId}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: `watcher-${sessionId}-${Math.random().toString(36).slice(2)}` },
        },
      });

      // Escuchar cambios de presencia
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ role: string; userId: string }>();
        const peers = Object.values(state).flat();

        const hasInspector = peers.some((p) => (p as unknown as { role: string }).role === "inspector");
        const hasClient = peers.some((p) => (p as unknown as { role: string }).role === "client");
        const hasSupervisor = peers.some((p) => (p as unknown as { role: string }).role === "supervisor");

        setPresence((prev) => ({
          ...prev,
          [sessionId]: { inspector: hasInspector, client: hasClient, supervisor: hasSupervisor },
        }));
      });

      // Suscribirse SIN hacer track — somos observadores invisibles.
      // No enviamos "ready" ni ningún mensaje de signaling.
      channel.subscribe();

      channelsRef.current.push({ channel, sessionId });
    }

    setPresence(newPresence);

    return () => {
      channelsRef.current.forEach(({ channel }) => void supabase.removeChannel(channel));
      channelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIds.join(",")]);

  return presence;
}
