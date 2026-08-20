"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import { downloadInspection, canDownloadMore } from "@/lib/offline/download-session";
import { saveOfflineCredentials } from "@/lib/auth/offline-auth";
import { useOnline } from "@/hooks/use-online";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DownloadButtonProps {
  sessionId: string;
  inspectorId: string;
  onDownloaded?: () => void;
  disabled?: boolean;
}

/**
 * Botón para descargar una inspección para uso offline.
 * Solo visible cuando hay conexión a internet.
 * Pide confirmación del password para guardar credenciales offline.
 */
export function DownloadButton({ sessionId, inspectorId, onDownloaded, disabled }: DownloadButtonProps) {
  const flash = useFlash();
  const online = useOnline();
  const { profile } = useAuth();
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

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

    // Mostrar diálogo para confirmar password (guardar credenciales offline)
    setShowPasswordDialog(true);
  };

  const handleConfirmDownload = async () => {
    if (!password.trim()) {
      flash({ description: "Ingresa tu contraseña", type: "error", duration: 2000 });
      return;
    }

    setVerifying(true);
    setState("downloading");
    try {
      // 1. Guardar credenciales offline (para login sin conexión)
      if (profile) {
        await saveOfflineCredentials(
          {
            id: profile.id,
            user_id: profile.user_id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role,
            company_id: profile.company_id,
            company: profile.company
              ? { name: profile.company.name, logo_url: profile.company.logo_url }
              : null,
            mobile_enabled: profile.mobile_enabled,
          },
          password,
        );
      }

      // 2. Descargar la inspección
      await downloadInspection(sessionId, inspectorId);

      setState("done");
      setShowPasswordDialog(false);
      setPassword("");
      flash({ description: "Inspección descargada. Vence en 10 días.", type: "success", duration: 2000 });
      onDownloaded?.();
      setTimeout(() => setState("idle"), 3000);
    } catch (e) {
      setState("error");
      flash({ description: (e as Error).message, type: "error", duration: 3000 });
      setTimeout(() => setState("idle"), 3000);
    } finally {
      setVerifying(false);
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
    <>
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

      {/* Diálogo de confirmación de password */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Descargar offline
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Confirma tu contraseña para habilitar el login sin conexión. La usarás para acceder a las inspecciones descargadas cuando no haya internet.
            </p>
            <Input
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmDownload();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPassword("");
              }}
              disabled={verifying}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmDownload} disabled={verifying || !password.trim()}>
              {verifying ? "Descargando..." : "Descargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
