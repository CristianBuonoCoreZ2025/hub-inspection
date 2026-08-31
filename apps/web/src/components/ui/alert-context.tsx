"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface PromptOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  defaultValue?: string;
}

interface DialogContextValue {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  flash: (opts: FlashOptions) => void;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"alert" | "confirm" | "flash" | "prompt">("alert");
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [flashOptions, setFlashOptions] = useState<FlashOptions | null>(null);
  const [promptOptions, setPromptOptions] = useState<PromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const resolveRef = useRef<((value?: unknown) => void) | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);

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
    setPromptOptions(null);
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

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    setPromptOptions(opts);
    setAlertOptions(null);
    setConfirmOptions(null);
    setFlashOptions(null);
    setPromptValue(opts.defaultValue ?? "");
    setMode("prompt");
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve as (value?: unknown) => void;
    });
  }, []);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Focus al input cuando se abre el prompt
  useEffect(() => {
    if (open && mode === "prompt") {
      const t = setTimeout(() => {
        promptInputRef.current?.focus();
        promptInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  const handleClose = useCallback((value: unknown = false) => {
    if (mode === "flash") {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
      setOpen(false);
      setFlashOptions(null);
      return;
    }
    setOpen(false);
    if (mode === "confirm") {
      resolveRef.current?.(Boolean(value));
    } else if (mode === "prompt") {
      resolveRef.current?.(value === false ? null : String(value));
    } else {
      resolveRef.current?.();
    }
    resolveRef.current = null;
  }, [mode]);

  const isConfirm = mode === "confirm";
  const isFlash = mode === "flash";
  const isPrompt = mode === "prompt";
  const title = isConfirm
    ? (confirmOptions?.title ?? "Confirmar")
    : isFlash
      ? (flashOptions?.title ?? (flashOptions?.type === "error" ? "Error" : flashOptions?.type === "success" ? "Hecho" : "Atención"))
      : isPrompt
        ? (promptOptions?.title ?? "Ingresar valor")
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
      : isPrompt
        ? promptOptions?.description
        : alertOptions?.description;
  const confirmLabel = isConfirm
    ? (confirmOptions?.confirmLabel ?? (confirmOptions?.destructive ? "Eliminar" : "Confirmar"))
    : isPrompt
      ? (promptOptions?.confirmLabel ?? "Aceptar")
      : (alertOptions?.confirmLabel ?? "Aceptar");
  const cancelLabel = isConfirm
    ? (confirmOptions?.cancelLabel ?? "Cancelar")
    : isPrompt
      ? (promptOptions?.cancelLabel ?? "Cancelar")
      : null;
  const Icon = isConfirm
    ? (isDestructive ? AlertTriangle : HelpCircle)
    : isFlash
      ? (flashOptions?.type === "error" ? AlertTriangle : flashOptions?.type === "success" ? CheckCircle2 : Info)
      : isPrompt
        ? HelpCircle
        : (alertOptions?.type === "error" ? AlertTriangle : Info);

  return (
    <DialogContext.Provider value={{ alert, confirm, flash, prompt }}>
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
      {/* Alert / Confirm / Prompt: Dialog modal normal */}
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
            {isPrompt && (
              <div className="px-6 pb-2">
                <Input
                  ref={promptInputRef}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={promptOptions?.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleClose(promptValue);
                    }
                  }}
                />
              </div>
            )}
            <div className="modal-footer">
              {isConfirm || isPrompt ? (
                <>
                  <Button type="button" className="pg-btn-platinum" onClick={() => handleClose(false)}>
                    {cancelLabel}
                  </Button>
                  <Button
                    type="button"
                    className={cn("pg-btn-platinum", isDestructive && "destructive")}
                    onClick={() => handleClose(isPrompt ? promptValue : true)}
                    disabled={isPrompt && promptValue.trim() === "" && !promptOptions?.placeholder}
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

export function usePrompt() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("usePrompt debe usarse dentro de DialogProvider");
  return ctx.prompt;
}
