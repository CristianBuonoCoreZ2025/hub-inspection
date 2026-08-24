"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CloudUpload, CheckCircle } from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import { useConfirm } from "@/hooks/use-confirm";
import { useQueryClient } from "@tanstack/react-query";
import { syncInspection, type SyncProgress, type SyncResult } from "@/lib/offline/sync-session";
import { hasPendingChanges, countPendingChanges, type PendingChanges } from "@/db/offline-db";
import { releaseDownloadedSession } from "@/lib/offline/download-session";
import { useOnline } from "@/hooks/use-online";

interface SyncButtonProps {
  sessionId: string;
  pending: PendingChanges;
  onSynced?: (result: SyncResult) => void;
}

/**
 * Botón cuadrado para sincronizar y liberar una inspección descargada.
 * - Si hay cambios pendientes: los sube a Supabase y luego libera.
 * - Si no hay cambios: solo libera.
 * Solo visible cuando hay conexión.
 */
export function SyncButton({ sessionId, pending, onSynced }: SyncButtonProps) {
  const flash = useFlash();
  const confirm = useConfirm();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  const hasChanges = hasPendingChanges(pending);
  const count = countPendingChanges(pending);

  if (!online) return null;

  const handleSync = async () => {
    const ok = await confirm({
      title: hasChanges ? "Sincronizar y liberar" : "Liberar inspección",
      description: hasChanges
        ? `Se subirán ${count} cambio(s) al servidor y la inspección se liberará. Perderás la conexión offline con esta inspección.`
        : "La inspección se liberará del dispositivo. Perderás la conexión offline con esta inspección.",
      confirmLabel: "Sincronizar",
      destructive: true,
    });
    if (!ok) return;

    setState("syncing");
    setProgress(null);
    try {
      // 1. Si hay cambios pendientes, sincronizar
      if (hasChanges) {
        const result = await syncInspection(sessionId, (p) => setProgress(p));
        if (!result.success) {
          setState("error");
          flash({
            description: `Sincronización con errores: ${result.errors.length} falla(s)`,
            type: "error",
            duration: 3000,
          });
          setTimeout(() => setState("idle"), 3000);
          return;
        }
      }

      // 2. Liberar la inspección (limpiar Supabase + borrar de IndexedDB)
      await releaseDownloadedSession(sessionId);

      setState("done");
      flash({
        description: hasChanges ? "Sincronizada y liberada" : "Inspección liberada",
        type: "success",
        duration: 2000,
      });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
      onSynced?.({ success: true, errors: [], synced: { acta: !hasChanges, damages: 0, evidences: 0, signatures: 0, sketches: 0 } });
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      setState("error");
      flash({ description: (e as Error).message, type: "error", duration: 3000 });
      setTimeout(() => setState("idle"), 3000);
    }
  };

  if (state === "done") {
    return (
      <span className="mobile-offline-icon-btn done" aria-label="Sincronizada">
        <CheckCircle className="h-4 w-4" />
      </span>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className="mobile-offline-icon-btn"
      aria-label={hasChanges ? `Sincronizar (${count} cambios)` : "Liberar inspección"}
    >
      {state === "syncing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "error" ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <CloudUpload className="h-4 w-4" />
      )}
    </button>
  );
}
