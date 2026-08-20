"use client";

import { useState } from "react";
import { RefreshCw, Loader2, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import { useQueryClient } from "@tanstack/react-query";
import { syncInspection, type SyncProgress, type SyncResult } from "@/lib/offline/sync-session";
import { hasPendingChanges, countPendingChanges, type PendingChanges } from "@/db/offline-db";
import { useOnline } from "@/hooks/use-online";

interface SyncButtonProps {
  sessionId: string;
  pending: PendingChanges;
  onSynced?: (result: SyncResult) => void;
}

/**
 * Botón para sincronizar cambios pendientes de una inspección offline.
 * Solo visible cuando hay cambios pendientes y hay conexión.
 */
export function SyncButton({ sessionId, pending, onSynced }: SyncButtonProps) {
  const flash = useFlash();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  const hasChanges = hasPendingChanges(pending);
  const count = countPendingChanges(pending);

  if (!hasChanges || !online) return null;

  const handleSync = async () => {
    setState("syncing");
    setProgress(null);
    try {
      const result = await syncInspection(sessionId, (p) => setProgress(p));

      if (result.success) {
        setState("done");
        flash({ description: "Inspección sincronizada", type: "success", duration: 1500 });
        // Refrescar datos del servidor
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
        onSynced?.(result);
        setTimeout(() => setState("idle"), 2000);
      } else {
        setState("error");
        flash({
          description: `Sincronización con errores: ${result.errors.length} falla(s)`,
          type: "error",
          duration: 3000,
        });
        setTimeout(() => setState("idle"), 3000);
      }
    } catch (e) {
      setState("error");
      flash({ description: (e as Error).message, type: "error", duration: 3000 });
      setTimeout(() => setState("idle"), 3000);
    }
  };

  if (state === "done") {
    return (
      <span className="mobile-sync-badge synced">
        <CheckCircle className="h-3 w-3" />
        Sincronizada
      </span>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className="mobile-sync-btn"
      aria-label="Sincronizar cambios"
    >
      {state === "syncing" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {progress ? `${progress.step} ${progress.percent}%` : "Sincronizando..."}
        </>
      ) : state === "error" ? (
        <>
          <AlertCircle className="h-3 w-3" />
          Reintentar
        </>
      ) : (
        <>
          <CloudUpload className="h-3 w-3" />
          Sincronizar ({count})
        </>
      )}
    </button>
  );
}
