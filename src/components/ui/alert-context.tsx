"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";

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

interface DialogContextValue {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"alert" | "confirm">("alert");
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value?: unknown) => void) | null>(null);

  const alert = useCallback((opts: AlertOptions): Promise<void> => {
    setAlertOptions(opts);
    setConfirmOptions(null);
    setMode("alert");
    setOpen(true);
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve as (value?: unknown) => void;
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setConfirmOptions(opts);
    setAlertOptions(null);
    setMode("confirm");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve as (value?: unknown) => void;
    });
  }, []);

  const handleClose = useCallback((value = false) => {
    setOpen(false);
    if (mode === "confirm") {
      resolveRef.current?.(value);
    } else {
      resolveRef.current?.();
    }
    resolveRef.current = null;
  }, [mode]);

  const isConfirm = mode === "confirm";
  const title = isConfirm
    ? (confirmOptions?.title ?? "Confirmar")
    : (alertOptions?.title ?? (alertOptions?.type === "error" ? "Error" : "Atención"));
  const isDestructive = isConfirm
    ? (confirmOptions?.destructive ?? false)
    : (alertOptions?.type === "error");
  const description = isConfirm
    ? confirmOptions?.description
    : alertOptions?.description;
  const confirmLabel = isConfirm
    ? (confirmOptions?.confirmLabel ?? (confirmOptions?.destructive ? "Eliminar" : "Confirmar"))
    : (alertOptions?.confirmLabel ?? "Aceptar");
  const cancelLabel = isConfirm ? (confirmOptions?.cancelLabel ?? "Cancelar") : null;
  const Icon = isConfirm
    ? (isDestructive ? AlertTriangle : HelpCircle)
    : (alertOptions?.type === "error" ? AlertTriangle : Info);

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
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
