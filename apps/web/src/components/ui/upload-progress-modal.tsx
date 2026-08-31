"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, XCircle, Loader2, X } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error";

interface UploadProgressModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  status: UploadStatus;
  progress: number; // 0-100
  loaded: number; // bytes
  fileSize: number; // bytes
  speed: number; // KB/s
  errorMsg?: string;
  title?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * UploadProgressModal — modal reutilizable que muestra el progreso
 * de subida de un archivo con estados: uploading, processing, done, error.
 *
 * La lógica de XHR/mutación vive en el consumidor; este componente
 * solo maneja la presentación visual.
 */
export function UploadProgressModal({
  open,
  onClose,
  fileName,
  status,
  progress,
  loaded,
  fileSize,
  speed,
  errorMsg,
  title = "Subir archivo",
}: UploadProgressModalProps) {
  const canClose = status === "done" || status === "error" || status === "idle";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && canClose) onClose(); }} dismissible={canClose}>
      <DialogContent className="modal-md" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
              <Upload className="h-4 w-4" />
            </div>
            {title}
          </DialogTitle>
          {canClose && (
            <Button className="pg-btn-platinum" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="modal-body space-y-4">
          {/* Nombre del archivo */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground truncate">{fileName}</span>
          </div>

          {/* Barra de progreso */}
          {(status === "uploading" || status === "processing") && (
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBytes(loaded)} / {formatBytes(fileSize)}</span>
                <span>{speed > 0 ? `${speed.toFixed(1)} KB/s` : ""}</span>
              </div>
            </div>
          )}

          {/* Estado: procesando */}
          {status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Procesando archivo...</span>
            </div>
          )}

          {/* Estado: done */}
          {status === "done" && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Archivo subido correctamente.</span>
            </div>
          )}

          {/* Estado: error */}
          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <XCircle className="h-4 w-4" />
              <span>{errorMsg || "Error al subir el archivo."}</span>
            </div>
          )}
        </div>

        {canClose && (
          <div className="modal-footer">
            <Button className="pg-btn-platinum" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
