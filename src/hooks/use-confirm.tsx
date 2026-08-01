"use client";

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const ConfirmDialog = useCallback(() => {
    if (!options) return null;
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(false); }}>
        <DialogContent className="modal-sm" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
                  options.destructive
                    ? "bg-red-500 text-white"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {options.destructive ? <AlertTriangle className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
              </div>
              {options.title || "Confirmar"}
            </DialogTitle>
            <DialogDescription className="modal-subtitle">{options.description}</DialogDescription>
          </div>
          <div className="modal-footer">
            <Button type="button" className="pg-btn-platinum" onClick={() => handleClose(false)}>
              {options.cancelLabel || "Cancelar"}
            </Button>
            <Button
              type="button"
              className={cn("pg-btn-platinum", options.destructive && "text-rose-600 dark:text-rose-400")}
              onClick={() => handleClose(true)}
            >
              {options.confirmLabel || (options.destructive ? "Eliminar" : "Confirmar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }, [open, options, handleClose]);

  return [ConfirmDialog, confirm] as const;
}
