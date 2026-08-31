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
 * el inspector y el asegurado, y hace track con role "watcher" para
 * participar del sistema de presencia de Supabase.
 *
 * El role "watcher" no dispara ninguna lógica en LiveVideoCall
 * (que solo reacciona a "client", "inspector" y "supervisor").
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
      const watcherId = `watcher-${sessionId}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase.channel(`webrtc:${sessionId}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: watcherId },
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

      // Suscribirse y hacer track con role "watcher".
      // Es necesario hacer track para que Supabase nos incluya en el
      // sistema de presencia y recibamos los eventos sync con el estado
      // completo de todos los peers del canal.
      // El role "watcher" no dispara ninguna lógica en LiveVideoCall.
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: watcherId, role: "watcher" });
        }
      });

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
