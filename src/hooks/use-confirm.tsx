"use client";

import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options.title || "Confirmar"}</DialogTitle>
            <DialogDescription>{options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {options.cancelLabel || "Cancelar"}
            </Button>
            <Button
              type="button"
              variant={options.destructive ? "destructive" : "default"}
              onClick={() => handleClose(true)}
            >
              {options.confirmLabel || "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [open, options, handleClose]);

  return [ConfirmDialog, confirm] as const;
}
