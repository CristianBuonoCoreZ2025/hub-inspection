"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle, AlertCircle, Lock, Database, FileCheck, HardDrive, Cloud } from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import { downloadInspection, canDownloadMore, type DownloadProgress } from "@/lib/offline/download-session";
import { saveOfflineProfile, hasOfflinePinInSupabase, getOfflinePinHashFromSupabase } from "@/lib/auth/offline-auth";
import { useOnline } from "@/hooks/use-online";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
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
 * Botón cuadrado para descargar una inspección para uso offline.
 * Solo visible cuando hay conexión a internet.
 * - Si el usuario no tiene PIN en Supabase: pide elegir uno (se guarda en Supabase).
 * - Si ya tiene PIN: descarga directo (el PIN hash se sincroniza a IndexedDB).
 */
export function DownloadButton({ sessionId, inspectorId, onDownloaded, disabled }: DownloadButtonProps) {
  const flash = useFlash();
  const online = useOnline();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress>({ step: "session", label: "", percent: 0 });
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!online) return null;

  const doDownload = async () => {
    setState("downloading");
    setShowProgressDialog(true);
    try {
      // Traer el PIN hash de Supabase y guardarlo en IndexedDB
      setProgress({ step: "profile", label: "Sincronizando perfil y PIN...", percent: 5 });
      if (profile) {
        const pinHash = await getOfflinePinHashFromSupabase(profile.id);
        if (pinHash) {
          await saveOfflineProfile(
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
            pinHash,
          );
        }
      }

      await downloadInspection(sessionId, inspectorId, (p) => setProgress(p));
      setState("done");
      flash({ description: "Inspección descargada. Vence en 10 días.", type: "success", duration: 2000 });
      // Invalidar cache para que la lista y el detalle reflejen el bloqueo offline
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      onDownloaded?.();
      setTimeout(() => {
        setState("idle");
        setShowProgressDialog(false);
      }, 1500);
    } catch (e) {
      setState("error");
      flash({ description: (e as Error).message, type: "error", duration: 3000 });
      setTimeout(() => {
        setState("idle");
        setShowProgressDialog(false);
      }, 3000);
    }
  };

  const handleDownload = async () => {
    // Verificar límite de descargas
    const { can, max } = await canDownloadMore(inspectorId);
    if (!can) {
      flash({
        description: `Ya tienes ${max} inspecciones descargadas. Sincroniza o elimina una para descargar otra.`,
        type: "error",
        duration: 3000,
      });
      return;
    }

    // Verificar si ya tiene PIN en Supabase
    if (profile) {
      const hasPin = await hasOfflinePinInSupabase(profile.id);
      if (hasPin) {
        // Ya tiene PIN: descargar directo
        await doDownload();
        return;
      }
    }

    // No tiene PIN: mostrar diálogo para elegirlo
    setShowPinDialog(true);
  };

  const handleConfirmPin = async () => {
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      flash({ description: "El PIN debe ser de 4 a 6 dígitos numéricos", type: "error", duration: 2000 });
      return;
    }

    setVerifying(true);
    try {
      // 1. Guardar PIN en Supabase
      const res = await fetch("/api/users/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline_pin: pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al guardar PIN");
      }

      // 2. Cerrar el diálogo de PIN antes de descargar
      setShowPinDialog(false);
      setPin("");

      // 3. Descargar la inspección (trae el PIN hash de Supabase a IndexedDB)
      await doDownload();

      setState("done");
      flash({ description: "PIN configurado. Inspección descargada.", type: "success", duration: 3000 });
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

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={disabled || state === "downloading"}
        className="mobile-offline-icon-btn"
        aria-label="Descargar para offline"
      >
        {state === "downloading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : state === "error" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>

      {/* Diálogo para elegir PIN (solo si no tiene PIN en Supabase) */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="mobile-pin-dialog bg-popover!" showCloseButton>
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Configurar PIN offline
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Elige un PIN de 4 a 6 dígitos para acceder a las inspecciones sin conexión.
              Este mismo PIN servirá para todas tus descargas.
            </p>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Ej: 1234"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPin();
              }}
              autoFocus
              className="text-center text-lg tracking-[0.25em]"
            />
            <p className="text-xs text-muted-foreground">
              El PIN se guarda en tu cuenta. Puedes cambiarlo desde Mi Perfil.
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPinDialog(false);
                setPin("");
              }}
              disabled={verifying}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmPin} disabled={verifying || pin.length < 4}>
              {verifying ? "Descargando..." : "Descargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de progreso de descarga */}
      <Dialog open={showProgressDialog} onOpenChange={(v) => { if (!v && state !== "downloading") setShowProgressDialog(false); }}>
        <DialogContent className="mobile-pin-dialog bg-popover!" showCloseButton={state !== "downloading"}>
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              {state === "done" ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : state === "error" ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Database className="h-5 w-5 text-amber-500" />
              )}
              {state === "done" ? "Descarga completa" : state === "error" ? "Error" : "Descargando inspección"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Icono según etapa */}
            <div className="flex justify-center py-2">
              {progress.step === "profile" && <Cloud className="h-10 w-10 text-amber-400 animate-pulse" />}
              {progress.step === "session" && <FileCheck className="h-10 w-10 text-amber-400 animate-pulse" />}
              {progress.step === "catalogs" && <Database className="h-10 w-10 text-amber-400 animate-pulse" />}
              {progress.step === "activating" && <Cloud className="h-10 w-10 text-amber-400 animate-pulse" />}
              {progress.step === "saving" && <HardDrive className="h-10 w-10 text-amber-400 animate-pulse" />}
              {progress.step === "done" && <CheckCircle className="h-10 w-10 text-emerald-500" />}
            </div>

            {/* Etiquetas de cada paso */}
            <div className="space-y-1.5">
              {[
                { key: "profile", label: "Perfil y PIN", icon: Cloud },
                { key: "session", label: "Datos de inspección", icon: FileCheck },
                { key: "catalogs", label: "Catálogos globales", icon: Database },
                { key: "activating", label: "Activar en servidor", icon: Cloud },
                { key: "saving", label: "Guardar en dispositivo", icon: HardDrive },
              ].map(({ key, label, icon: Icon }) => {
                const stepOrder = ["profile", "session", "catalogs", "activating", "saving", "done"];
                const currentIdx = stepOrder.indexOf(progress.step);
                const thisIdx = stepOrder.indexOf(key);
                const isDone = currentIdx > thisIdx || progress.step === "done";
                const isActive = progress.step === key;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {isDone ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin shrink-0" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={isDone ? "text-emerald-600" : isActive ? "text-foreground font-medium" : "text-muted-foreground/50"}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1">
              <div className="download-progress-bar-track">
                <div
                  className="download-progress-bar-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{progress.label}</span>
                <span>{progress.percent}%</span>
              </div>
            </div>

            {progress.step === "catalogs" && (
              <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5">
                Primera descarga: los catálogos se guardan una sola vez y se reutilizan en todas las inspecciones.
              </p>
            )}
          </div>
          {(state === "done" || state === "error") && (
            <DialogFooter className="pt-2">
              <Button
                variant={state === "error" ? "destructive" : "default"}
                onClick={() => {
                  setShowProgressDialog(false);
                  setState("idle");
                }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
