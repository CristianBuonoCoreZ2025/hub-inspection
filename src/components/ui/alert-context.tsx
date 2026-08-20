"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, Info, CheckCircle2 } from "lucide-react";

export interface AlertOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  type?: "error" | "info";
}

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface FlashOptions {
  title?: string;
  description: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

interface DialogContextValue {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  flash: (opts: FlashOptions) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"alert" | "confirm" | "flash">("alert");
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [flashOptions, setFlashOptions] = useState<FlashOptions | null>(null);
  const resolveRef = useRef<((value?: unknown) => void) | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alert = useCallback((opts: AlertOptions): Promise<void> => {
    setAlertOptions(opts);
    setConfirmOptions(null);
    setFlashOptions(null);
    setMode("alert");
    setOpen(true);
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve as (value?: unknown) => void;
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setConfirmOptions(opts);
    setAlertOptions(null);
    setFlashOptions(null);
    setMode("confirm");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve as (value?: unknown) => void;
    });
  }, []);

  const flash = useCallback((opts: FlashOptions): void => {
    setFlashOptions(opts);
    setAlertOptions(null);
    setConfirmOptions(null);
    setMode("flash");
    setOpen(true);
    // Auto-cierre después de duration (default 2500ms)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setOpen(false);
      setFlashOptions(null);
      flashTimerRef.current = null;
    }, opts.duration ?? 1250);
  }, []);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleClose = useCallback((value = false) => {
    if (mode === "flash") {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
      setOpen(false);
      setFlashOptions(null);
      return;
    }
    setOpen(false);
    if (mode === "confirm") {
      resolveRef.current?.(value);
    } else {
      resolveRef.current?.();
    }
    resolveRef.current = null;
  }, [mode]);

  const isConfirm = mode === "confirm";
  const isFlash = mode === "flash";
  const title = isConfirm
    ? (confirmOptions?.title ?? "Confirmar")
    : isFlash
      ? (flashOptions?.title ?? (flashOptions?.type === "error" ? "Error" : flashOptions?.type === "success" ? "Hecho" : "Atención"))
      : (alertOptions?.title ?? (alertOptions?.type === "error" ? "Error" : "Atención"));
  const isDestructive = isConfirm
    ? (confirmOptions?.destructive ?? false)
    : isFlash
      ? (flashOptions?.type === "error")
      : (alertOptions?.type === "error");
  const description = isConfirm
    ? confirmOptions?.description
    : isFlash
      ? flashOptions?.description
      : alertOptions?.description;
  const confirmLabel = isConfirm
    ? (confirmOptions?.confirmLabel ?? (confirmOptions?.destructive ? "Eliminar" : "Confirmar"))
    : (alertOptions?.confirmLabel ?? "Aceptar");
  const cancelLabel = isConfirm ? (confirmOptions?.cancelLabel ?? "Cancelar") : null;
  const Icon = isConfirm
    ? (isDestructive ? AlertTriangle : HelpCircle)
    : isFlash
      ? (flashOptions?.type === "error" ? AlertTriangle : flashOptions?.type === "success" ? CheckCircle2 : Info)
      : (alertOptions?.type === "error" ? AlertTriangle : Info);

  return (
    <DialogContext.Provider value={{ alert, confirm, flash }}>
      {children}
      {/* Flash: div flotante sin overlay, no bloquea interacción */}
      {isFlash && open && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="modal-sm rounded-xl bg-popover/90 backdrop-blur-xl text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-[0_8px_24px_rgba(0,0,0,0.18)] animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="modal-header">
              <div className="modal-title">
                <div className={cn("alert-icon", isDestructive ? "alert-icon--error" : "alert-icon--info")}>
                  <Icon className="h-4 w-4" />
                </div>
                {title}
              </div>
              <div className="modal-subtitle">
                {description}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Alert / Confirm: Dialog modal normal */}
      {!isFlash && (
        <Dialog open={open} onOpenChange={(nextOpen: boolean) => { if (!nextOpen) handleClose(false); }} dismissible={false}>
          <DialogContent className="modal-sm" showCloseButton={false}>
            <div className="modal-header">
              <DialogTitle className="modal-title">
                <div className={cn("alert-icon", isDestructive ? "alert-icon--error" : "alert-icon--info")}>
                  <Icon className="h-4 w-4" />
                </div>
                {title}
              </DialogTitle>
              <DialogDescription className="modal-subtitle">
                {description}
              </DialogDescription>
            </div>
            <div className="modal-footer">
              {isConfirm ? (
                <>
                  <Button type="button" className="pg-btn-platinum" onClick={() => handleClose(false)}>
                    {cancelLabel}
                  </Button>
                  <Button
                    type="button"
                    className={cn("pg-btn-platinum", isDestructive && "destructive")}
                    onClick={() => handleClose(true)}
                  >
                    {confirmLabel}
                  </Button>
                </>
              ) : (
                <Button type="button" className="pg-btn-platinum" onClick={() => handleClose()}>
                  {confirmLabel}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DialogContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useAlert debe usarse dentro de DialogProvider");
  return ctx.alert;
}

export function useConfirm() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de DialogProvider");
  return ctx.confirm;
}

export function useFlash() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useFlash debe usarse dentro de DialogProvider");
  return ctx.flash;
}
