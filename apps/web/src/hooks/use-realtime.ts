"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Hook para suscribirse a cambios en tiempo real de una tabla Supabase
 * e invalidar automáticamente las queries de TanStack Query.
 *
 * @param table - Nombre de la tabla a observar
 * @param queryKeys - Array de query keys a invalidar cuando hay cambios
 * @param enabled - Si la suscripción está activa (default: true)
 *
 * @example
 * useRealtime("claims", [["claims-all"], ["claims", companyId]]);
 * useRealtime("claim_actions", [["claim-actions", claimId]]);
 */
export function useRealtime(
  table: string,
  queryKeys: unknown[][],
  enabled = true
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseClient();
    const channelName = `realtime-${table}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          // Invalidar todas las queries relacionadas
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });

          // Log para debugging (solo en dev)
          if (process.env.NODE_ENV === "development") {
            console.log(`[realtime] ${table} ${payload.eventType}`, payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, enabled, queryClient]);
}
