"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import { downloadInspection, canDownloadMore } from "@/lib/offline/download-session";
import { useOnline } from "@/hooks/use-online";

interface DownloadButtonProps {
  sessionId: string;
  inspectorId: string;
  onDownloaded?: () => void;
  disabled?: boolean;
}

/**
 * Botón para descargar una inspección para uso offline.
 * Solo visible cuando hay conexión a internet.
 */
export function DownloadButton({ sessionId, inspectorId, onDownloaded, disabled }: DownloadButtonProps) {
  const flash = useFlash();
  const online = useOnline();
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">("idle");

  if (!online) return null;

  const handleDownload = async () => {
    // Verificar límite de descargas
    const { can, count, max } = await canDownloadMore(inspectorId);
    if (!can) {
      flash({
        description: `Ya tienes ${max} inspecciones descargadas. Sincroniza o elimina una para descargar otra.`,
        type: "error",
        duration: 3000,
      });
      return;
    }

    setState("downloading");
    try {
      await downloadInspection(sessionId, inspectorId);
      setState("done");
      flash({ description: `Inspección descargada (${count + 1}/${max}). Vence en 10 días.`, type: "success", duration: 2000 });
      onDownloaded?.();
      // Resetear después de 3s
      setTimeout(() => setState("idle"), 3000);
    } catch (e) {
      setState("error");
      flash({ description: (e as Error).message, type: "error", duration: 3000 });
      setTimeout(() => setState("idle"), 3000);
    }
  };

  if (state === "done") {
    return (
      <span className="mobile-offline-badge downloaded">
        <CheckCircle className="h-3 w-3" />
        Descargada
      </span>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || state === "downloading"}
      className="mobile-offline-download-btn"
      aria-label="Descargar para offline"
    >
      {state === "downloading" ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Descargando...</>
      ) : state === "error" ? (
        <><AlertCircle className="h-3 w-3" /> Error</>
      ) : (
        <><Download className="h-3 w-3" /> Descargar</>
      )}
    </button>
  );
}
