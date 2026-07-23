"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEvidence } from "@/services/inspections";
import { toast } from "sonner";
import {
  Upload, Trash2, ImageIcon, Video, FileText, ExternalLink,
  MapPin, Clock, User, Camera, Lock, X, ZoomIn, Zap, Loader2,
} from "lucide-react";
import { AiAnalysisButton } from "@/components/ai/ai-analysis-button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UploadItem = {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  loaded: number;
  speed: number; // KB/s
  elapsed: number; // ms
  status: "uploading" | "processing" | "done" | "error";
  errorMsg?: string;
  xhr?: XMLHttpRequest;
};

type UploadStatus = "uploading" | "processing" | "done" | "error";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: UploadStatus): string {
  switch (status) {
    case "uploading": return "Subiendo...";
    case "processing": return "Procesando...";
    case "done": return "Listo";
    case "error": return "Error";
    default: return "Subiendo...";
  }
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
  captured_by: string | null;
  lat: number | null;
  lng: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  ai_summary: string | null;
  ai_model: string | null;
  ai_status: string | null;
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

/** Formatea bytes a texto legible. */
function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Iniciales del nombre para el avatar. */
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) return email.substring(0, 2).toUpperCase();
  return "??";
}

// ─── Componente principal ────────────────────────────────────────

export default function EvidencesTab({ sessionId, sessionStatus }: { sessionId: string; sessionStatus?: string }) {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [aiSummaryModal, setAiSummaryModal] = useState<{ visible: boolean; title: string; summary: string }>({ visible: false, title: "", summary: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";
  const uploadModalOpen = uploadQueue.length > 0;

  const { data: evidences, isLoading } = useQuery({
    queryKey: ["evidences", sessionId],
    queryFn: () => fetchEvidences(sessionId),
    // Polling cada 5s mientras hay evidencias siendo procesadas por IA.
    // Timeout: deja de pollar después de 2 minutos (24 polls × 5s) para no
    // quedar pegado infinitamente si el after() de Next.js falla.
    refetchInterval: (query) => {
      const evs = query.state.data;
      if (!evs || !evs.some((e) => e.ai_status === "pending")) return false;
      // Calcular cuánto tiempo llevan las pending
      const oldestPending = evs
        .filter((e) => e.ai_status === "pending")
        .reduce((oldest, e) => {
          const t = new Date(e.created_at).getTime();
          return t < oldest ? t : oldest;
        }, Date.now());
      const elapsedMs = Date.now() - oldestPending;
      // Después de 2 minutos, dejar de pollar (el usuario puede reintentar manualmente)
      if (elapsedMs > 120_000) return false;
      return 5000;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      toast.success("Evidencia eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
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
          toast.success(`${file.name} subido`);
        } catch {
          setUploadQueue((q) =>
            q.map((it) =>
              it.id === id
                ? { ...it, status: "error", errorMsg: "Respuesta inválida del servidor" }
                : it,
            ),
          );
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
      }
      // El cierre automático del modal se maneja en useEffect cuando
      // todas las subidas llegan a done/error.
    });

    xhr.addEventListener("error", () => {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: "Error de red" } : it)));
    });

    xhr.addEventListener("abort", () => {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: "Cancelado" } : it)));
    });

    xhr.open("POST", "/api/inspection/evidences/upload");
    xhr.send(formData);
  }, [queryClient, sessionId]);

  const handleFile = useCallback(
    (file: File) => uploadFile(file),
    [uploadFile],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(handleFile);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(handleFile);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeUploadModal = () => {
    // Abortar las que aún estén subiendo
    uploadQueue.forEach((it) => {
      if (it.status === "uploading" && it.xhr) {
        it.xhr.abort();
      }
    });
    setUploadQueue([]);
  };

  // Cerrar modal automáticamente 1.5s después de que todas las subidas terminen
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    const allDone = uploadQueue.every((it) => it.status === "done" || it.status === "error");
    if (!allDone) return;
    const id = setTimeout(() => setUploadQueue([]), 1500);
    return () => clearTimeout(id);
  }, [uploadQueue]);

  const photos = evidences?.filter((e) => e.type === "photo") || [];
  const videos = evidences?.filter((e) => e.type === "video") || [];
  const documents = evidences?.filter((e) => e.type === "document" || e.type === "pdf") || [];

  return (
    <div className="app-stack">
      {/* ─── Banner de solo lectura (inspección finalizada) ─── */}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Inspección finalizada — las evidencias son de solo lectura
        </div>
      )}

      {/* ─── Drop zone compacto (oculto si readOnly) ─── */}
      {!readOnly && (
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 transition-all ${
          isDragging
            ? "border-blue-400/60 bg-blue-500/10"
            : "border-border bg-card/40 hover:border-border/80"
        }`}
        style={{
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
        }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">
            Arrastra archivos o{" "}
            <label htmlFor="evidence-upload" className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80">
              selecciónalos
            </label>
          </p>
          <p className="text-[11px] text-muted-foreground">JPG · PNG · MP4 · PDF — se optimizan automáticamente</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf"
          onChange={handleInput}
          className="hidden"
          id="evidence-upload"
        />
        {uploadQueue.length > 0 && (
          <button
            type="button"
            onClick={() => {}}
            className="text-[11px] text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Subiendo {uploadQueue.filter((it) => it.status === "uploading").length}...
          </button>
        )}
      </div>
      )}

      {/* ═══ MODAL: Progreso de subida ═══ */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Subiendo evidencias</h3>
              <button
                type="button"
                onClick={closeUploadModal}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cerrar
              </button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {uploadQueue.map((it) => {
                const progress = it.fileSize > 0 ? Math.round((it.loaded / it.fileSize) * 100) : 0;
                return (
                  <div key={it.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium truncate flex-1" title={it.fileName}>
                        {it.fileName}
                      </span>
                      <span
                        className={`text-[11px] shrink-0 ${
                          it.status === "error" ? "text-rose-600" : it.status === "done" ? "text-emerald-600" : "text-muted-foreground"
                        }`}
                      >
                        {statusLabel(it.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatFileSize(it.loaded)} / {formatFileSize(it.fileSize)} · {it.speed.toFixed(0)} KB/s · {Math.round(it.elapsed / 1000)}s
                    </p>
                    {it.errorMsg && (
                      <p className="text-[10px] text-rose-600 mt-1">{it.errorMsg}</p>
                    )}
                    {it.status !== "done" && it.status !== "error" && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Contenido ─── */}
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando evidencias...</div>
      ) : evidences?.length === 0 ? (
        <div className="app-panel text-center py-10 text-muted-foreground text-sm">
          <Camera className="mx-auto h-8 w-8 mb-2 opacity-30" />
          No hay evidencias aún
        </div>
      ) : (
        <div className="space-y-4">
          {photos.length > 0 && (
            <EvidenceSection
              title="Fotos"
              count={photos.length}
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              items={photos}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              onImageClick={setZoomImage}
              onShowSummary={(ev) => setAiSummaryModal({ visible: true, title: ev.description || "Evidencia", summary: ev.ai_summary! })}
              sessionId={sessionId}
            />
          )}
          {videos.length > 0 && (
            <EvidenceSection
              title="Videos"
              count={videos.length}
              icon={<Video className="h-3.5 w-3.5" />}
              items={videos}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              onShowSummary={(ev) => setAiSummaryModal({ visible: true, title: ev.description || "Evidencia", summary: ev.ai_summary! })}
              sessionId={sessionId}
            />
          )}
          {documents.length > 0 && (
            <EvidenceSection
              title="Documentos"
              count={documents.length}
              icon={<FileText className="h-3.5 w-3.5" />}
              items={documents}
              onDelete={deleteMutation.mutate}
              readOnly={readOnly}
              onShowSummary={(ev) => setAiSummaryModal({ visible: true, title: ev.description || "Evidencia", summary: ev.ai_summary! })}
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
          <button
            onClick={() => setZoomImage(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
          <img
            src={zoomImage}
            alt="Evidencia ampliada"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ═══ MODAL: Ver análisis IA completo ═══ */}
      <Dialog
        open={aiSummaryModal.visible}
        onOpenChange={(open) => setAiSummaryModal((p) => ({ ...p, visible: open }))}
      >
        <DialogContent className="modal-md-wide" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-500" />
              Análisis IA
            </DialogTitle>
          </div>
          <div className="modal-body space-y-2">
            <div className="text-[11px] font-medium text-foreground">{aiSummaryModal.title}</div>
            <div
              style={{ maxHeight: "60vh", overflowY: "auto" }}
              className="rounded-md bg-violet-50/50 p-3 text-[12px] leading-relaxed text-violet-900 dark:bg-violet-950/20 dark:text-violet-200 whitespace-pre-wrap"
            >
              {aiSummaryModal.summary}
            </div>
          </div>
          <div className="modal-footer">
            <Button
              className="pg-btn-platinum"
              onClick={() => setAiSummaryModal((p) => ({ ...p, visible: false }))}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sección por tipo ────────────────────────────────────────────

function EvidenceSection({
  title, count, icon, items, onDelete, readOnly, onImageClick, onShowSummary, sessionId,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  items: Evidence[];
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
  onShowSummary?: (evidence: Evidence) => void;
  sessionId: string;
}) {
  return (
    <div className="app-panel">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground">({count})</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((ev) => (
          <EvidenceCard
            key={ev.id}
            evidence={ev}
            onDelete={onDelete}
            readOnly={readOnly}
            onImageClick={onImageClick}
            onShowSummary={onShowSummary}
            sessionId={sessionId}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card individual (miniatura) ─────────────────────────────────

function EvidenceCard({ evidence, onDelete, readOnly, onImageClick, onShowSummary, sessionId }: {
  evidence: Evidence;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
  onShowSummary?: (evidence: Evidence) => void;
  sessionId: string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [isAiStuck, setIsAiStuck] = useState(false);
  const isDoc = evidence.type === "pdf" || evidence.type === "document";
  const isVideo = evidence.type === "video";
  const isPhoto = evidence.type === "photo";

  const meta = evidence.metadata;
  const uploaderName = evidence.uploader?.full_name || evidence.uploader?.email || null;
  const dateStr = formatDate(evidence.captured_at || evidence.created_at);
  const sizeStr = formatSize(meta?.fileSize);
  // La geo de la foto viene exclusivamente del EXIF GPS (lat/lng = exif_lat/exif_lng).
  // No se usa la ubicación del dispositivo para evidencias.
  const hasGps = evidence.exif_lat != null && evidence.exif_lng != null;

  // IA atascada: si está pending por más de 2 min, mostrar mensaje de retry
  useEffect(() => {
    if (evidence.ai_status !== "pending") return;
    const elapsedMs = Date.now() - new Date(evidence.created_at).getTime();
    const remaining = Math.max(0, 120_000 - elapsedMs);
    const timer = setTimeout(() => setIsAiStuck(true), remaining);
    return () => clearTimeout(timer);
  }, [evidence.ai_status, evidence.created_at]);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/30"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
      }}
    >
      {/* ─── Thumbnail (cuadrado, pequeño) ─── */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {isPhoto && (
          <button
            type="button"
            onClick={() => onImageClick?.(evidence.url)}
            className="block h-full w-full cursor-zoom-in"
            title="Click para ampliar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 with dynamic URL */}
            <img
              src={evidence.url}
              alt={evidence.description || ""}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </button>
        )}
        {isVideo && (
          <video
            src={evidence.url}
            className="h-full w-full object-cover"
            controls
            preload="metadata"
          />
        )}
        {isDoc && (
          <DocThumbnail url={evidence.url} type={evidence.type} />
        )}

        {/* Badge de tipo (esquina superior izquierda) */}
        <div className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {evidence.type === "photo" ? "JPG" : evidence.type === "video" ? "MP4" : evidence.type === "pdf" ? "PDF" : "DOC"}
        </div>

        {/* Acciones hover (esquina superior derecha) */}
        {showActions && !readOnly && (
          <div className="absolute right-1 top-1 flex gap-1">
            {isDoc && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                title="Abrir"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <AiAnalysisButton
              table="inspection_evidences"
              id={evidence.id}
              fileName={evidence.description || evidence.type}
              hasSummary={!!evidence.ai_summary}
              queryKey={["evidences", sessionId]}
            />
            <button
              onClick={() => { if (confirm("¿Eliminar esta evidencia?")) onDelete(evidence.id); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80"
              title="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
        {/* En readOnly, documentos siguen abribles pero sin eliminar */}
        {showActions && readOnly && isDoc && (
          <div className="absolute right-1 top-1 flex gap-1">
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              title="Abrir"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {/* En readOnly, fotos muestran icono de zoom */}
        {showActions && readOnly && isPhoto && (
          <div className="absolute right-1 top-1 flex gap-1">
            <button
              onClick={() => onImageClick?.(evidence.url)}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              title="Ampliar"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ─── Info debajo del thumbnail ─── */}
      <div className="space-y-1 p-1.5">
        {/* Código del archivo */}
        <p className="truncate text-[10px] font-semibold text-foreground" title={evidence.description || ""}>
          {evidence.description || "Sin código"}
        </p>

        {/* Fecha + tamaño */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {dateStr}
          </span>
          {sizeStr && (
            <>
              <span className="opacity-30">·</span>
              <span>{sizeStr}</span>
            </>
          )}
        </div>

        {/* Quién subió + ubicación */}
        <div className="flex items-center justify-between gap-1">
          {uploaderName ? (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[7px] font-bold text-primary">
                {getInitials(evidence.uploader?.full_name ?? null, evidence.uploader?.email ?? null)}
              </div>
              <span className="truncate" title={uploaderName}>{uploaderName}</span>
            </div>
          ) : (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
              <User className="h-2.5 w-2.5" />
              Anónimo
            </span>
          )}
          {/* Indicador de GPS de la foto (EXIF) */}
          <div className="flex items-center gap-1">
            {hasGps ? (
              <span
                className="flex items-center gap-0.5 text-[9px] text-blue-600 dark:text-blue-400"
                title={`GPS de la foto (EXIF): ${evidence.exif_lat?.toFixed(6)}, ${evidence.exif_lng?.toFixed(6)}`}
              >
                <MapPin className="h-2.5 w-2.5" />
              </span>
            ) : (
              <span
                className="flex items-center gap-0.5 text-[9px] text-muted-foreground/50"
                title="La foto no contiene información GPS en sus metadatos EXIF"
              >
                <MapPin className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>

        {/* Resumen IA */}
        {evidence.ai_status === "pending" ? (
          isAiStuck ? (
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-red-500 dark:text-red-400 pt-1">
              <span className="font-medium">IA timeout — usa el botón Brain para reintentar</span>
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 pt-1">
              <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
              <span className="font-medium">Analizando con IA...</span>
            </div>
          )
        ) : evidence.ai_status === "error" ? (
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-red-500 dark:text-red-400 pt-1">
            <span className="font-medium">IA falló — usa el botón Brain para reintentar</span>
          </div>
        ) : evidence.ai_summary ? (
          <div
            className="mt-0.5 flex items-start gap-1 rounded bg-violet-50/50 p-1 dark:bg-violet-950/20 cursor-pointer hover:bg-violet-100/70 dark:hover:bg-violet-900/30 pt-1"
            title={evidence.ai_summary}
            onClick={() => onShowSummary?.(evidence)}
          >
            <Zap className="mt-0.5 h-2.5 w-2.5 shrink-0 text-violet-500" />
            <p className="line-clamp-2 text-[9px] leading-relaxed text-violet-700 dark:text-violet-300">
              {evidence.ai_summary}
            </p>
          </div>
        ) : null}
      </div>
    </div>
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
