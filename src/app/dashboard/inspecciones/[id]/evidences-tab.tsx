"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEvidence, updateEvidenceInclude } from "@/services/inspections";
import { logInspectionEvent } from "@/services/inspection-events";
import {
  Upload, Trash2, ImageIcon, Video, FileText, ExternalLink,
  MapPin, Clock, Camera, Lock, X, ZoomIn,
  CheckCircle2, XCircle, Loader2,
  RefreshCw, ChevronDown,
} from "lucide-react";
import { ImageCard } from "@/components/ai/image-card";
import { AiCopyButton } from "@/components/ai/ai-copy-button";
import { cleanMarkdown } from "@/lib/utils";
import { convertHeicToJpeg } from "@/lib/heic-convert";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useConfirm } from "@/hooks/use-confirm";
import { useAlert } from "@/components/ui/alert-context";

type UploadStatus = "queued" | "uploading" | "processing" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  loaded: number;
  speed: number; // KB/s
  elapsed: number; // ms
  status: UploadStatus;
  errorMsg?: string;
  xhr?: XMLHttpRequest;
};

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Tipos ───────────────────────────────────────────────────────

interface EvidenceUploader {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface EvidenceMetadata {
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
  userAgent?: string | null;
}

interface Evidence {
  id: string;
  type: string;
  url: string;
  description: string | null;
  captured_at: string | null;
  created_at: string;
  metadata: EvidenceMetadata | null;
  include_in_report: boolean;
  captured_by: string | null;
  lat: number | null;
  lng: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  ai_summary: string | null;
  ai_model: string | null;
  ai_status: string | null;
  ai_analyzed_at: string | null;
  ai_prompt_snapshot: { system_prompt?: string; user_prompt?: string; refinement_prompt?: string } | null;
  source: string | null;
  uploader: EvidenceUploader | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function fetchEvidences(sessionId: string): Promise<Evidence[]> {
  const res = await fetch(`/api/inspection/evidences/session/${sessionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar evidencias");
  const data = (await res.json()) as { evidences: Evidence[] };
  return data.evidences;
}

/** Formatea una fecha ISO a formato corto relativo. */
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffH < 24) return `Hace ${diffH}h`;
  if (diffD < 7) return `Hace ${diffD}d`;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Componente principal ────────────────────────────────────────

export default function EvidencesTab({ sessionId, sessionStatus }: { sessionId: string; sessionStatus?: string }) {
  const queryClient = useQueryClient();
  const showAlert = useAlert();
  const [uploadModal, setUploadModal] = useState<{ visible: boolean; isDragging: boolean }>({ visible: false, isDragging: false });
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  // El popover de IA ahora vive dentro de cada card (no estado global)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const modalCameraInputRef = useRef<HTMLInputElement>(null);

  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

  const { data: evidences, isLoading } = useQuery({
    queryKey: ["evidences", sessionId],
    queryFn: () => fetchEvidences(sessionId),
    // Polling cada 5s mientras hay evidencias siendo procesadas por IA.
    // Timeout: deja de pollar después de 5 minutos para no quedar pegado
    // infinitamente si el after() de Next.js falla.
    // Nota: para re-análisis, created_at es la fecha original de subida,
    // no la del re-análisis. Por eso no usamos created_at como base del
    // timeout — solo verificamos que haya items pending/processing.
    refetchInterval: (query) => {
      const evs = query.state.data;
      if (!evs || !evs.some((e) => e.ai_status === "pending" || e.ai_status === "processing")) return false;
      return 10000;
    },
  });

  const { data: reportMaxPhotos } = useQuery({
    queryKey: ["report-max-photos"],
    queryFn: async () => {
      const res = await fetch("/api/settings/report-max-photos");
      const data = (await res.json()) as { value?: number };
      return typeof data.value === "number" ? data.value : 18;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvidence,
    onSuccess: (_data, evidenceId) => {
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      showAlert({ title: "Evidencia eliminada", description: "La evidencia se eliminó correctamente.", type: "info" });
      logInspectionEvent({ sessionId, role: "adjuster", eventType: "evidence_deleted", evidenceId });
    },
    onError: (err: Error) => showAlert({ title: "Error", description: err.message, type: "error" }),
  });

  const uploadFile = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const xhr = new XMLHttpRequest();

    const item: UploadItem = {
      id,
      file,
      fileName: file.name,
      fileSize: file.size,
      loaded: 0,
      speed: 0,
      elapsed: 0,
      status: "uploading",
      xhr,
    };
    setUploadQueue((q) => [...q, item]);

    // Log: upload iniciado
    logInspectionEvent({
      sessionId,
      role: "adjuster",
      eventType: "upload_started",
      eventDetail: `Subiendo: ${file.name}`,
      metadata: { fileName: file.name, fileSize: file.size, source: "modal" },
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);
    formData.append("originalName", file.name);
    const startTime = Date.now();

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const elapsed = Date.now() - startTime;
      const speed = elapsed > 0 ? (e.loaded / 1024) / (elapsed / 1000) : 0;
      setUploadQueue((q) =>
        q.map((it) =>
          it.id === id
            ? {
                ...it,
                loaded: e.loaded,
                fileSize: e.total,
                speed,
                elapsed,
                status: "uploading",
              }
            : it,
        ),
      );
    });

    xhr.upload.addEventListener("load", () => {
      const elapsed = Date.now() - startTime;
      const finalSpeed = elapsed > 0 ? (file.size / 1024) / (elapsed / 1000) : 0;
      setUploadQueue((q) =>
        q.map((it) =>
          it.id === id
            ? { ...it, loaded: it.fileSize, speed: finalSpeed, elapsed, status: "uploading" }
            : it,
        ),
      );
      setTimeout(() => {
        setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "processing" } : it)));
      }, 400);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          JSON.parse(xhr.responseText);
          setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "done" } : it)));
          queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
          showAlert({ title: "Archivo subido", description: `${file.name} se subió correctamente.`, type: "info" });
          logInspectionEvent({
            sessionId,
            role: "adjuster",
            eventType: "upload_completed",
            eventDetail: `Subido: ${file.name}`,
            metadata: { fileName: file.name, fileSize: file.size, source: "modal" },
          });
        } catch {
          setUploadQueue((q) =>
            q.map((it) =>
              it.id === id
                ? { ...it, status: "error", errorMsg: "Respuesta inválida del servidor" }
                : it,
            ),
          );
          logInspectionEvent({
            sessionId,
            role: "adjuster",
            eventType: "upload_failed",
            eventDetail: `Error: ${file.name}`,
            metadata: { fileName: file.name, error: "Respuesta inválida del servidor" },
          });
        }
      } else {
        let msg = "Error al subir archivo";
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.error || `Error ${xhr.status}`;
        } catch {
          msg = `Error ${xhr.status}: ${xhr.statusText}`;
        }
        setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: msg } : it)));
        logInspectionEvent({
          sessionId,
          role: "adjuster",
          eventType: "upload_failed",
          eventDetail: `Error: ${file.name}`,
          metadata: { fileName: file.name, error: msg },
        });
      }
      // El cierre automático del modal se maneja en useEffect cuando
      // todas las subidas llegan a done/error.
    });

    xhr.addEventListener("error", () => {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: "Error de red" } : it)));
      logInspectionEvent({
        sessionId,
        role: "adjuster",
        eventType: "upload_failed",
        eventDetail: `Error de red: ${file.name}`,
        metadata: { fileName: file.name, error: "network" },
      });
    });

    xhr.addEventListener("abort", () => {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: "Cancelado" } : it)));
    });

    xhr.open("POST", "/api/inspection/evidences/upload");
    xhr.send(formData);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert es estable (context), no necesita estar en deps
  }, [queryClient, sessionId]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const f = await convertHeicToJpeg(file);
        uploadFile(f);
      } catch (err) {
        showAlert({ title: "Formato no soportado", description: `No se pudo convertir ${file.name}: formato HEIC no soportado`, type: "error" });
        console.error(err);
      }
    },
    [uploadFile, showAlert],
  );

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setUploadModal((p) => ({ ...p, isDragging: false }));
    for (const file of Array.from(e.dataTransfer.files)) {
      await handleFile(file);
    }
  };

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files || [])) {
      await handleFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (modalCameraInputRef.current) modalCameraInputRef.current.value = "";
  };

  // Cámara directa: sube foto o video sin abrir el modal de subida.
  // Fotos: sube via route handler normal (FormData + XHR).
  // Videos: usa presigned URL para subir directamente a R2 (evita límite de body size).
  // Si se quiere borrar, se borra desde la lista de evidencias.
  const handleDirectCapture = (e: React.ChangeEvent<HTMLInputElement>, kind: "photo" | "video") => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    let fileIdx = 0;

    // Log: evento de captura iniciado
    logInspectionEvent({
      sessionId,
      role: "adjuster",
      eventType: kind === "video" ? "video_recorded" : "photo_taken",
      eventDetail: kind === "video" ? "Video grabado desde cámara directa" : "Foto tomada desde cámara directa",
      metadata: { count: files.length, fileNames: files.map(f => f.name) },
    });

    const uploadNext = () => {
      if (fileIdx >= files.length) {
        queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
        if (e.target) e.target.value = "";
        return;
      }
      const rawFile = files[fileIdx++];

      convertHeicToJpeg(rawFile).then(async (file) => {
        if (kind === "video") {
          // ── Video: presigned URL + PUT directo a R2 via XHR ──
          const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : ".webm";
          const presignRes = await fetch("/api/inspection/evidences/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              mimeType: file.type || "video/webm",
              ext,
              originalName: file.name,
              source: "live_video",
            }),
          });
          if (!presignRes.ok) throw new Error(`HTTP ${presignRes.status} (presign)`);
          const { presignedUrl, url, fileCode, userId, claimId } = await presignRes.json();

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl);
            xhr.setRequestHeader("Content-Type", file.type || "video/webm");

            xhr.upload.addEventListener("progress", (ev) => {
              if (!ev.lengthComputable) return;
              // Progreso de subida mostrado en la cola de uploads
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`HTTP ${xhr.status} (R2)`));
            });
            xhr.addEventListener("error", () => reject(new Error("Error de red")));
            xhr.addEventListener("abort", () => reject(new Error("Cancelado")));
            xhr.send(file);
          });

          // Registrar en BD
          const regRes = await fetch("/api/inspection/evidences/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId, url, fileCode, mimeType: file.type || "video/webm",
              originalName: file.name, source: "live_video", fileSize: file.size,
              userId, claimId,
            }),
          });
          if (!regRes.ok) throw new Error(`HTTP ${regRes.status} (register)`);

          showAlert({ title: "Video capturado", description: "El video se subió correctamente.", type: "info" });
          logInspectionEvent({
            sessionId, role: "adjuster", eventType: "upload_completed",
            eventDetail: `Subido: ${file.name}`,
            metadata: { fileName: file.name, fileSize: file.size, source: "direct-camera" },
          });
          uploadNext();
        } else {
          // ── Foto: route handler normal via FormData + XHR ──
          const formData = new FormData();
          formData.append("file", file);
          formData.append("sessionId", sessionId);
          formData.append("originalName", file.name);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/inspection/evidences/upload");

          xhr.upload.addEventListener("progress", (ev) => {
            if (!ev.lengthComputable) return;
            // Progreso mostrado en la cola de uploads
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              showAlert({ title: "Foto capturada", description: "La foto se subió correctamente.", type: "info" });
              logInspectionEvent({
                sessionId, role: "adjuster", eventType: "upload_completed",
                eventDetail: `Subido: ${file.name}`,
                metadata: { fileName: file.name, fileSize: file.size, source: "direct-camera" },
              });
            } else {
              let msg = `Error ${xhr.status}`;
              try { const b = JSON.parse(xhr.responseText); msg = b.error || msg; } catch { /* ignore */ }
              showAlert({ title: "No se pudo subir la foto", description: msg, type: "error" });
              logInspectionEvent({
                sessionId, role: "adjuster", eventType: "upload_failed",
                eventDetail: `Error: ${file.name}`,
                metadata: { fileName: file.name, error: msg },
              });
            }
            uploadNext();
          });

          xhr.addEventListener("error", () => {
            showAlert({ title: "No se pudo subir la foto", description: "Error de red", type: "error" });
            logInspectionEvent({
              sessionId, role: "adjuster", eventType: "upload_failed",
              eventDetail: `Error de red: ${file.name}`,
              metadata: { fileName: file.name, error: "network" },
            });
            uploadNext();
          });

          xhr.send(formData);
        }
      }).catch((err) => {
        showAlert({ title: "No se pudo subir", description: err instanceof Error ? err.message : "Error", type: "error" });
        logInspectionEvent({
          sessionId, role: "adjuster", eventType: "upload_failed",
          eventDetail: `Error: ${rawFile.name}`,
          metadata: { fileName: rawFile.name, error: err instanceof Error ? err.message : String(err) },
        });
        uploadNext();
      });
    };

    uploadNext();
  };

  const closeUploadModal = () => {
    // Abortar las que aún estén subiendo
    uploadQueue.forEach((it) => {
      if (it.status === "uploading" && it.xhr) {
        it.xhr.abort();
      }
    });
    setUploadQueue([]);
    setUploadModal({ visible: false, isDragging: false });
  };

  // Cerrar modal automáticamente 1.5s después de que todas las subidas terminen.
  // El procesamiento de IA y optimización se ejecutan al cerrar la inspección.
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    const allDone = uploadQueue.every((it) => it.status === "done" || it.status === "error");
    if (!allDone) return;

    const id = setTimeout(() => setUploadQueue([]), 1500);
    return () => clearTimeout(id);
  }, [uploadQueue, sessionId]);

  const photos = evidences?.filter((e) => e.type === "photo") || [];
  const videos = evidences?.filter((e) => e.type === "video") || [];
  const documents = evidences?.filter((e) => e.type === "document" || e.type === "pdf") || [];

  return (
    <div className="app-stack">
      {/* ─── Banner de solo lectura (inspección finalizada) ─── */}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Inspección finalizada — las evidencias son de solo lectura
        </div>
      )}

      {/* ─── Toolbar con botón subir (estándar, mismo que siniestros) ─── */}
      {!readOnly && (
        <div className="app-panel app-panel-toolbar-only">
          <div className="app-grid-toolbar">
            <div className="app-grid-toolbar-left">
              <h3 className="app-section-title">
                <Camera className="h-4 w-4" />
                Evidencias
                {evidences && evidences.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">({evidences.length})</span>
                )}
              </h3>
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-icon-sm"
                    onClick={() => setUploadModal({ visible: true, isDragging: false })}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Subir evidencias</p>
                </TooltipContent>
              </Tooltip>
              {/* Cámara directa: toma foto y sube sin abrir modal */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleDirectCapture(e, "photo")}
                className="hidden"
                id="evidence-camera-direct"
              />
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <label
                    htmlFor="evidence-camera-direct"
                    className="btn-icon-sm flex items-center justify-center cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Tomar foto</p>
                </TooltipContent>
              </Tooltip>
              {/* Cámara directa: graba video y sube sin abrir modal */}
              <input
                ref={videoCameraInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(e) => handleDirectCapture(e, "video")}
                className="hidden"
                id="evidence-video-direct"
              />
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <label
                    htmlFor="evidence-video-direct"
                    className="btn-icon-sm flex items-center justify-center cursor-pointer"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Grabar video</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Subir evidencias (drag&drop + cola, mismo estándar que siniestros) ═══ */}
      <Dialog
        open={uploadModal.visible}
        onOpenChange={(open) => {
          if (!open && uploadQueue.some((i) => i.status === "uploading")) return;
          if (!open) closeUploadModal();
        }}
        dismissible={false}
      >
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {uploadQueue.length > 0 && uploadQueue.every((it) => it.status === "done" || it.status === "error")
                ? `Subidas completadas (${uploadQueue.filter((i) => i.status === "done").length}/${uploadQueue.length})`
                : uploadQueue.length > 0
                ? `Subiendo evidencias (${uploadQueue.filter((i) => i.status === "done").length}/${uploadQueue.length})`
                : "Subir evidencias"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* ─── Fase idle: drag&drop ─── */}
            {uploadQueue.length === 0 && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setUploadModal((p) => ({ ...p, isDragging: true }));
                  }}
                  onDragLeave={() => setUploadModal((p) => ({ ...p, isDragging: false }))}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    uploadModal.isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <Upload className={`h-8 w-8 ${uploadModal.isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-[11px] font-medium text-foreground">
                    Arrastra los archivos aquí
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    o haz clic para seleccionar (múltiples)
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,video/*,.pdf"
                    onChange={handleInput}
                  />
                  {/* Botón tomar foto — solo mobile */}
                  <input
                    ref={modalCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleInput}
                    className="hidden"
                    id="evidence-camera"
                  />
                  <div className="flex gap-2 mt-1">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="pg-btn-platinum"
                    >
                      Seleccionar
                    </Button>
                    <label
                      htmlFor="evidence-camera"
                      className="sm:hidden flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary touch-manipulation cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      Tomar foto
                    </label>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground text-center">
                  JPG, PNG, MP4, PDF · múltiples archivos
                </div>
              </>
            )}

            {/* ─── Cola de subida / Resultados ─── */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {uploadQueue.map((it, idx) => {
                  const progress = it.fileSize > 0 ? Math.round((it.loaded / it.fileSize) * 100) : 0;
                  return (
                    <div key={it.id} className="upload-result-row">
                      <div className="flex items-center gap-2.5">
                        <div className="upload-result-icon">
                          {it.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : it.status === "error" ? (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          ) : it.status === "uploading" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : it.status === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                            <span className="truncate text-[11px] font-medium text-foreground">
                              {it.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{formatFileSize(it.fileSize)}</span>
                            {it.errorMsg && (
                              <>
                                <span>·</span>
                                <span className="text-rose-500">{it.errorMsg}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {it.status === "uploading" && (
                            <span className="text-sm font-bold tabular-nums text-primary">{progress}%</span>
                          )}
                          {it.status === "processing" && (
                            <span className="text-[10px] text-amber-600">guardando...</span>
                          )}
                          {it.status === "queued" && (
                            <span className="text-[10px] text-muted-foreground">en cola</span>
                          )}
                        </div>
                      </div>
                      {it.status === "uploading" && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {uploadQueue.length === 0 && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal({ visible: false, isDragging: false })}
              >
                Cancelar
              </Button>
            )}
            {uploadQueue.length > 0 && uploadQueue.every((it) => it.status === "done" || it.status === "error") && (
              <Button
                className="pg-btn-platinum"
                onClick={closeUploadModal}
              >
                Cerrar
              </Button>
            )}
            {uploadQueue.length > 0 && uploadQueue.some((it) => it.status === "uploading" || it.status === "processing" || it.status === "queued") && (
              <div className="text-[10px] text-muted-foreground">
                Subiendo... no cierres esta ventana
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Contenido ─── */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando evidencias...</div>
      ) : evidences?.length === 0 ? (
        <div className="app-panel text-center py-10 text-muted-foreground text-sm">
          <Camera className="mx-auto h-8 w-8 mb-2 opacity-30" />
          No hay evidencias aún
        </div>
      ) : (
        <div className="space-y-2">
          {photos.length > 0 && (
            <EvidenceSection
              title="Fotos"
              count={photos.length}
              icon={<ImageIcon className="h-4 w-4" />}
              items={photos}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              onImageClick={setZoomImage}
              sessionId={sessionId}
              isPhotoSection
              maxReport={reportMaxPhotos ?? 18}
            />
          )}
          {videos.length > 0 && (
            <EvidenceSection
              title="Videos"
              count={videos.length}
              icon={<Video className="h-4 w-4" />}
              items={videos}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              sessionId={sessionId}
            />
          )}
          {documents.length > 0 && (
            <DocumentTable
              title="Documentos"
              count={documents.length}
              icon={<FileText className="h-4 w-4" />}
              items={documents}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              sessionId={sessionId}
            />
          )}
        </div>
      )}

      {/* ─── Modal de zoom de imagen ─── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setZoomImage(null)}
        >
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                onClick={() => setZoomImage(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Cerrar</p>
            </TooltipContent>
          </Tooltip>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
          <img
            src={zoomImage}
            alt="Evidencia ampliada"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sección por tipo ────────────────────────────────────────────

function EvidenceSection({
  title, count, icon, items, onDelete, readOnly, onImageClick, sessionId, isPhotoSection, maxReport = 18,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  items: Evidence[];
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
  sessionId: string;
  isPhotoSection?: boolean;
  maxReport?: number;
}) {
  const selectedCount = isPhotoSection ? items.filter((e) => e.include_in_report).length : 0;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return (
    <div className="app-panel">
      <div className="app-grid-toolbar">
        <div className="app-grid-toolbar-left">
          <h3 className="app-section-title">
            {icon}
            {title}
            <span className="text-[11px] text-muted-foreground">({count})</span>
            {isPhotoSection && (
              <span className="ml-2 text-[11px] text-muted-foreground">
                {selectedCount} en informe
              </span>
            )}
          </h3>
        </div>
        {count > 0 && (
          <Pagination variant="controls" page={currentPage} totalPages={totalPages} total={count} pageSize={pageSize} onPageChange={setPage} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {paginatedItems.map((ev) => (
          <EvidenceCard
            key={ev.id}
            evidence={ev}
            onDelete={onDelete}
            readOnly={readOnly}
            onImageClick={onImageClick}
            sessionId={sessionId}
            selectedCount={isPhotoSection ? selectedCount : undefined}
            maxReport={isPhotoSection ? maxReport : undefined}
          />
        ))}
      </div>
      {count > 0 && (
        <div className="pagination-footer">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={count}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

// ─── Tabla de documentos (igual que claim-documents) ────────────

function DocumentTable({
  title, count, icon, items, onDelete, readOnly, sessionId,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  items: Evidence[];
  onDelete: (id: string) => void;
  readOnly?: boolean;
  sessionId: string;
}) {
  const queryClient = useQueryClient();
  const showAlert = useAlert();
  const confirmDelete = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  const handleReanalyze = async (evidence: Evidence) => {
    try {
      await fetch("/api/ai/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "inspection_evidences", id: evidence.id, sessionId }),
      });
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      showAlert({ title: "Re-análisis iniciado", description: "El re-análisis comenzó correctamente.", type: "info" });
    } catch {
      showAlert({ title: "Error", description: "No se pudo iniciar el re-análisis.", type: "error" });
    }
  };

  return (
    <div className="app-panel">
      
      <div className="app-grid-toolbar">
        <div className="app-grid-toolbar-left">
          <h3 className="app-section-title">
            {icon}
            {title}
            <span className="text-[11px] text-muted-foreground">({count})</span>
          </h3>
        </div>
        {count > 0 && (
          <Pagination variant="controls" page={currentPage} totalPages={totalPages} total={count} pageSize={pageSize} onPageChange={setPage} />
        )}
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-[min(45vw,420px)]">Nombre</th>
              <th className="w-15">Ext.</th>
              <th className="w-20">Tamaño</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((doc) => {
              const meta = doc.metadata;
              const code = doc.description || "Sin código";
              const ext = (meta?.originalName || "").split(".").pop()?.toUpperCase() || doc.type.toUpperCase();
              const fileSize = meta?.fileSize ? formatFileSize(meta.fileSize) : "—";
              const aiStatus = doc.ai_status;
              const aiSummary = doc.ai_summary;
              const aiModel = doc.ai_model;
              const aiAnalyzedAt = doc.ai_analyzed_at;
              const aiPromptSnapshot = doc.ai_prompt_snapshot;

              return (
                <tr key={doc.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-[11px] font-medium text-foreground">{code}</span>
                    </div>
                    {(aiStatus === "pending" || aiStatus === "processing") && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{aiStatus === "pending" ? "En cola" : "Procesando..."}</span>
                      </div>
                    )}
                  </td>
                  <td className="text-muted-foreground uppercase text-[11px]">{ext}</td>
                  <td className="text-muted-foreground text-[11px]">{fileSize}</td>
                  <td>
                    <div className="app-row-actions">
                      {/* Re-IA — re-analizar con IA (solo cuando la inspección está cerrada) */}
                      {readOnly && (aiStatus === "done" || aiStatus === "error" || aiStatus === "skipped" || (!aiSummary && aiStatus !== "pending" && aiStatus !== "processing")) && (
                        <Tooltip>
                          <TooltipTrigger className="inline-flex">
                            <button
                              type="button"
                              className="btn-icon-sm"
                              onClick={() => handleReanalyze(doc)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{aiSummary ? "Re-analizar con IA" : "Analizar con IA"}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Ver log del análisis — popover */}
                      {aiSummary && aiStatus === "done" && (
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="btn-icon-sm"
                            title="Ver log del análisis"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </PopoverTrigger>
                          <PopoverContent side="top" align="start" className="ai-log-popover">
                            <div className="ai-log-header">
                              <span className="ai-log-code">{code}</span>
                              {aiAnalyzedAt && (
                                <span className="ai-log-date">
                                  {new Date(aiAnalyzedAt).toLocaleString("es-CL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {aiSummary && <AiCopyButton text={cleanMarkdown(aiSummary)} />}
                            </div>
                            {aiModel && (
                              <div className="ai-log-models">
                                {aiModel.split("|").map((m, i) => {
                                  const trimmed = m.trim();
                                  const isVision = trimmed.startsWith("vision:");
                                  const label = isVision ? "Visión" : "Razonamiento";
                                  const modelName = trimmed.replace(/^(vision|razonamiento):/, "").trim();
                                  return (
                                    <div key={i} className="ai-log-model-row">
                                      <span className="ai-log-model-tag">{label}</span>
                                      <span className="ai-log-model-name">{modelName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="ai-log-section ai-log-section-summary">
                              <div className="ai-log-summary">{cleanMarkdown(aiSummary)}</div>
                            </div>
                            {aiPromptSnapshot && (
                              <Popover>
                                <PopoverTrigger
                                  type="button"
                                  className="ai-log-prompt-trigger"
                                  title="Ver prompt enviado"
                                >
                                  <ChevronDown className="h-2.5 w-2.5" />
                                  <span>Prompt enviado</span>
                                </PopoverTrigger>
                                <PopoverContent side="top" align="start" className="ai-prompt-tooltip">
                                  <div className="ai-log-prompt">
                                    {aiPromptSnapshot.system_prompt && (
                                      <div className="ai-log-prompt-block">
                                        <span className="ai-log-prompt-tag">system</span>
                                        <pre className="ai-log-prompt-text">{aiPromptSnapshot.system_prompt}</pre>
                                      </div>
                                    )}
                                    {aiPromptSnapshot.user_prompt && (
                                      <div className="ai-log-prompt-block">
                                        <span className="ai-log-prompt-tag">user</span>
                                        <pre className="ai-log-prompt-text">{aiPromptSnapshot.user_prompt}</pre>
                                      </div>
                                    )}
                                    {aiPromptSnapshot.refinement_prompt && (
                                      <div className="ai-log-prompt-block">
                                        <span className="ai-log-prompt-tag">refinement</span>
                                        <pre className="ai-log-prompt-text">{aiPromptSnapshot.refinement_prompt}</pre>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                      {/* Abrir documento */}
                      <Tooltip>
                        <TooltipTrigger className="inline-flex">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon-sm"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Abrir documento</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Eliminar */}
                      {!readOnly && (
                        <button
                          type="button"
                          className="btn-icon-sm btn-danger-hover"
                          onClick={async () => {
                            const ok = await confirmDelete({
                              title: "Eliminar evidencia",
                              description: "¿Eliminar esta evidencia? Esta acción no se puede deshacer.",
                              destructive: true,
                              confirmLabel: "Eliminar",
                            });
                            if (ok) onDelete(doc.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {count > 0 && (
        <div className="pagination-footer">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={count}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

// ─── Card individual (miniatura) ─────────────────────────────────

function EvidenceCard({ evidence, onDelete, readOnly, onImageClick, sessionId, selectedCount, maxReport }: {
  evidence: Evidence;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
  sessionId: string;
  selectedCount?: number;
  maxReport?: number;
}) {
  const queryClient = useQueryClient();
  const showAlert = useAlert();
  const confirmDelete = useConfirm();
  const isDoc = evidence.type === "pdf" || evidence.type === "document";
  const isVideo = evidence.type === "video";
  const isPhoto = evidence.type === "photo";

  const includeMutation = useMutation({
    mutationFn: ({ id, include }: { id: string; include: boolean }) => updateEvidenceInclude(id, include),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] }),
    onError: () => showAlert({ title: "Error", description: "No se pudo actualizar la selección.", type: "error" }),
  });

  const meta = evidence.metadata;
  const uploaderName = evidence.uploader?.full_name || evidence.uploader?.email || null;
  const dateStr = formatDate(evidence.captured_at || evidence.created_at);
  const hasGps = evidence.exif_lat != null && evidence.exif_lng != null;

  const handleReanalyze = async () => {
    try {
      await fetch("/api/ai/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "inspection_evidences", id: evidence.id, sessionId }),
      });
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      showAlert({ title: "Re-análisis iniciado", description: "El re-análisis comenzó correctamente.", type: "info" });
    } catch {
      showAlert({ title: "Error", description: "No se pudo iniciar el re-análisis.", type: "error" });
    }
  };

  // Thumbnail content: video o doc tienen render propio
  const thumbnailContent = isVideo ? (
    <video
      src={evidence.url}
      className="h-full w-full object-cover"
      controls
      preload="metadata"
    />
  ) : isDoc ? (
    <DocThumbnail url={evidence.url} type={evidence.type} />
  ) : undefined;

  // Badge de tipo
  const badge = (
    <div className="rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
      {evidence.type === "photo" ? "JPG" : evidence.type === "video" ? "MP4" : evidence.type === "pdf" ? "PDF" : "DOC"}
    </div>
  );

  // Acciones hover
  const hoverActions = !readOnly ? (
    <>
      {isDoc && (
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Abrir</p>
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger className="inline-flex">
          <button
            onClick={async () => {
              const ok = await confirmDelete({
                title: "Eliminar evidencia",
                description: "¿Eliminar esta evidencia? Esta acción no se puede deshacer.",
                destructive: true,
                confirmLabel: "Eliminar",
              });
              if (ok) onDelete(evidence.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Eliminar</p>
        </TooltipContent>
      </Tooltip>
    </>
  ) : isDoc ? (
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Abrir</p>
      </TooltipContent>
    </Tooltip>
  ) : isPhoto ? (
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <button
          onClick={() => onImageClick?.(evidence.url)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Ampliar</p>
      </TooltipContent>
    </Tooltip>
  ) : undefined;

  // Fila extra: fecha + uploader + GPS
  const extraInfo = (
    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <Clock className="h-2.5 w-2.5" />
        {dateStr}
      </span>
      {uploaderName && (
        <>
          <span className="opacity-30">·</span>
          <span className="truncate" aria-label={uploaderName}>{uploaderName}</span>
        </>
      )}
      {hasGps && (
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <span
              className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 ml-auto"
            >
              <MapPin className="h-2.5 w-2.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{`GPS (EXIF): ${evidence.exif_lat?.toFixed(6)}, ${evidence.exif_lng?.toFixed(6)}`}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return (
    <>
      
      <ImageCard
        imageUrl={evidence.url}
        imageAlt={evidence.description || ""}
      onImageClick={() => onImageClick?.(evidence.url)}
      badge={badge}
      hoverActions={hoverActions}
      aiStatus={evidence.ai_status}
      aiProgress={null}
      aiTable="inspection_evidences"
      aiRecordId={evidence.id}
      onCancelAi={() => queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] })}
      code={evidence.description || "Sin código"}
      fileSize={meta?.fileSize || null}
      mimeType={meta?.mimeType || null}
      fileName={meta?.originalName}
      aiSummary={evidence.ai_summary}
      aiModel={evidence.ai_model}
      aiPromptSnapshot={evidence.ai_prompt_snapshot as { system_prompt: string; user_prompt: string; refinement_prompt: string | null; source: string } | null}
      aiAnalyzedAt={evidence.ai_analyzed_at}
      onReanalyze={readOnly ? handleReanalyze : undefined}
      extraInfo={extraInfo}
      thumbnailContent={thumbnailContent}
      includeInReport={isPhoto ? evidence.include_in_report : undefined}
      onIncludeToggle={isPhoto ? (include) => {
        if (include && selectedCount !== undefined && maxReport !== undefined && selectedCount >= maxReport && !evidence.include_in_report) {
          showAlert({ title: "Límite alcanzado", description: `Máximo ${maxReport} fotos en el informre.`, type: "error" });
          return;
        }
        includeMutation.mutate({ id: evidence.id, include });
      } : undefined}
    />
    </>
  );
}

// ─── Thumbnail para documentos (PDF icon compacto, no cuadro blanco) ───

function DocThumbnail({ url, type }: { url: string; type: string }) {
  const isPdf = type === "pdf";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-linear-to-br from-muted/40 to-muted/10 transition-colors hover:from-muted/60 hover:to-muted/20"
    >
      {/* Icono de PDF estilizado (no un cuadro blanco gigante) */}
      <div className={`flex h-10 w-8 items-center justify-center rounded-md shadow-sm ${
        isPdf
          ? "bg-red-500/90 text-white"
          : "bg-blue-500/90 text-white"
      }`}>
        <FileText className="h-5 w-5" />
      </div>
      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
        {isPdf ? "PDF" : "DOC"}
      </span>
    </a>
  );
}
