"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInspectionSessionById, type SessionDetail } from "@/services/inspections";
import { getDownloadedSession } from "@/lib/offline/download-session";
import { useOnline } from "@/hooks/use-online";
import { getOfflineDB, hasPendingChanges, countPendingChanges, type OfflineSession, type PendingChanges } from "@/db/offline-db";

interface UseOfflineSessionResult {
  /** Sesión actual (del servidor o de IndexedDB) */
  session: SessionDetail | null;
  /** Sesión offline completa (con pending changes) si está descargada */
  offlineSession: OfflineSession | null;
  /** Cambios pendientes */
  pending: PendingChanges | null;
  /** Número de cambios pendientes */
  pendingCount: number;
  /** Si está cargando */
  isLoading: boolean;
  /** Si estamos en modo offline */
  isOffline: boolean;
  /** Si la sesión está descargada */
  isDownloaded: boolean;
  /** Recargar la sesión offline de IndexedDB */
  refreshOffline: () => Promise<void>;
}

/**
 * Hook que carga una sesión de inspección, soportando modo offline.
 *
 * - Si hay conexión: carga del servidor (Supabase) + verifica si está descargada
 * - Si no hay conexión: carga de IndexedDB
 */
export function useOfflineSession(sessionId: string): UseOfflineSessionResult {
  const online = useOnline();
  const [offlineSession, setOfflineSession] = useState<OfflineSession | null>(null);

  // Query del servidor (solo cuando hay conexión)
  const { data: serverSession, isLoading } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId) as Promise<SessionDetail>,
    enabled: !!sessionId && online,
  });

  // Cargar sesión offline de IndexedDB
  const refreshOffline = useCallback(async () => {
    if (!sessionId) return;
    const downloaded = await getDownloadedSession(sessionId);
    setOfflineSession(downloaded);
  }, [sessionId]);

  useEffect(() => {
    refreshOffline();
  }, [refreshOffline]);

  // Determinar qué sesión usar
  const isOffline = !online;
  const isDownloaded = !!offlineSession;
  const session = isOffline ? offlineSession?.session ?? null : serverSession ?? null;
  const pending = offlineSession?.pending ?? null;
  const pendingCount = offlineSession ? countPendingChanges(offlineSession.pending) : 0;

  return {
    session,
    offlineSession,
    pending,
    pendingCount,
    isLoading: online && isLoading,
    isOffline,
    isDownloaded,
    refreshOffline,
  };
}

/**
 * Hook para actualizar los cambios pendientes en IndexedDB
 * y refrescar el estado local.
 */
export function useUpdateOfflinePending(sessionId: string) {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const update = useCallback(async () => {
    setUpdating(true);
    try {
      // Refrescar la query del servidor si estamos online
      if (typeof navigator !== "undefined" && navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      }
    } finally {
      setUpdating(false);
    }
  }, [queryClient, sessionId]);

  return { update, updating };
}
