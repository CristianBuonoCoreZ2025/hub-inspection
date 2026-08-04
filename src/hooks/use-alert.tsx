"use client";

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

export interface AlertOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  type?: "error" | "info";
}

export function useAlert() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const alert = useCallback((opts: AlertOptions): Promise<void> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resolveRef.current?.();
    resolveRef.current = null;
  }, []);

  const AlertDialog = useCallback(() => {
    if (!options) return null;
    const isError = options.type === "error";
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent className="modal-sm" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${
                  isError
                    ? "bg-red-500 text-white"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isError ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </div>
              {options.title || (isError ? "Error" : "Atención")}
            </DialogTitle>
            <DialogDescription className="modal-subtitle">{options.description}</DialogDescription>
          </div>
          <div className="modal-footer">
            <Button type="button" className="pg-btn-platinum" onClick={handleClose}>
              {options.confirmLabel || "Aceptar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }, [open, options, handleClose]);

  return [AlertDialog, alert] as const;
}
