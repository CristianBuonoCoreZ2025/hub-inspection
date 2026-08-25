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
 * Se suscribe a los canales de signaling `webrtc:{sessionId}` de cada sesión
 * para escuchar eventos de presencia, SIN unirse como participante (no hace
 * track). Esto permite saber quién está en línea sin afectar el flujo WebRTC.
 *
 * @param sessionIds Array de IDs de sesión a monitorear
 * @returns Map de sessionId → SessionPresence
 */
export function useSessionsPresence(sessionIds: string[]): Record<string, SessionPresence> {
  const [presence, setPresence] = useState<Record<string, SessionPresence>>({});
  const channelsRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]>[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Limpiar canales anteriores
    channelsRef.current.forEach((ch) => void supabase.removeChannel(ch));
    channelsRef.current = [];

    if (sessionIds.length === 0) return;

    const newPresence: Record<string, SessionPresence> = {};

    for (const sessionId of sessionIds) {
      newPresence[sessionId] = { inspector: false, client: false, supervisor: false };

      const channel = supabase.channel(`presence-watch:${sessionId}`, {
        config: { presence: { key: `watcher-${sessionId}` } },
      });

      // Escuchar cambios de presencia sin hacer track nosotros mismos
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

      // Suscribirse sin hacer track — somos observadores invisibles
      channel.subscribe();

      channelsRef.current.push(channel);
    }

    setPresence(newPresence);

    return () => {
      channelsRef.current.forEach((ch) => void supabase.removeChannel(ch));
      channelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIds.join(",")]);

  return presence;
}
