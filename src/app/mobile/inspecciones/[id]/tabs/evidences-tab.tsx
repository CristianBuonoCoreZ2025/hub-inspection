"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEvidence, type SessionDetail } from "@/services/inspections";
import { toast } from "sonner";
import {
  Camera, Upload, SwitchCamera, Trash2, Loader2, CheckCircle2, XCircle,
  ImageIcon, FileText, AlertCircle, MapPin,
} from "lucide-react";
import { convertHeicToJpeg } from "@/lib/heic-convert";
import { useConfirm } from "@/hooks/use-confirm";

interface EvidenceMetadata {
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
}

interface Evidence {
  id: string;
  type: string;
  url: string;
  description: string | null;
  created_at: string;
  metadata: EvidenceMetadata | null;
  include_in_report: boolean;
  lat: number | null;
  lng: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  ai_summary: string | null;
  ai_status: string | null;
  source: string | null;
}

interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  loaded: number;
  status: "uploading" | "done" | "error";
  errorMsg?: string;
}

async function fetchEvidences(sessionId: string): Promise<Evidence[]> {
  const res = await fetch(`/api/inspection/evidences/session/${sessionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar evidencias");
  const data = (await res.json()) as { evidences: Evidence[] };
  return data.evidences || [];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MobileEvidencesTabProps {
  sessionId: string;
  sessionStatus?: string;
  offlineMode?: boolean;
  onOfflineSaved?: () => void;
}

export default function MobileEvidencesTab({ sessionId, sessionStatus, offlineMode = false, onOfflineSaved }: MobileEvidencesTabProps) {
  const queryClient = useQueryClient();
  const confirmDelete = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [offlineEvidences, setOfflineEvidences] = useState<Evidence[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(false);

  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

  // Query online (deshabilitada en offline)
  const { data: onlineEvidences, isLoading, isError } = useQuery({
    queryKey: ["evidences", sessionId],
    queryFn: () => fetchEvidences(sessionId),
    enabled: !!sessionId && !offlineMode,
    refetchInterval: (query) => {
      if (offlineMode) return false;
      const evs = query.state.data;
      if (!evs || !evs.some((e) => e.ai_status === "pending" || e.ai_status === "processing")) return false;
      return 10000;
    },
  });

  // Cargar evidencias offline de IndexedDB
  const loadOfflineEvidences = useCallback(async () => {
    if (!offlineMode) return;
    setOfflineLoading(true);
    try {
      const { getOfflineEvidences } = await import("@/lib/offline/sync-session");
      const evs = await getOfflineEvidences(sessionId);
      setOfflineEvidences(evs);
    } catch (e) {
      console.error("Error loading offline evidences:", e);
    } finally {
      setOfflineLoading(false);
    }
  }, [sessionId, offlineMode]);

  useEffect(() => {
    if (offlineMode) loadOfflineEvidences();
  }, [offlineMode, loadOfflineEvidences]);

  const evidences = offlineMode ? offlineEvidences : onlineEvidences;

  const deleteMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      if (offlineMode) {
        const { addPendingEvidenceDeleted } = await import("@/lib/offline/sync-session");
        await addPendingEvidenceDeleted(sessionId, evidenceId);
        onOfflineSaved?.();
        return;
      }
      return deleteEvidence(evidenceId);
    },
    onSuccess: () => {
      if (offlineMode) {
        loadOfflineEvidences();
      } else {
        queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      }
      toast.success("Evidencia eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Upload offline: guardar blob en IndexedDB
  const uploadFileOffline = useCallback(async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: UploadItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      loaded: 0,
      status: "uploading",
    };
    setUploadQueue((q) => [...q, item]);

    try {
      const { addPendingEvidenceCreated } = await import("@/lib/offline/sync-session");
      // Determinar tipo
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const type = isImage ? "photo" : isVideo ? "video" : "document";

      await addPendingEvidenceCreated(sessionId, {
        localId: id,
        blob: file,
        type,
        metadata: {
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      });

      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "done", loaded: it.fileSize } : it)));
      onOfflineSaved?.();
      loadOfflineEvidences();
      toast.success(`${file.name} guardado offline`);
    } catch (e) {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: (e as Error).message } : it)));
    }
  }, [sessionId, onOfflineSaved, loadOfflineEvidences]);

  const uploadFile = useCallback((file: File) => {
    if (offlineMode) {
      uploadFileOffline(file);
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const xhr = new XMLHttpRequest();

    const item: UploadItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      loaded: 0,
      status: "uploading",
    };
    setUploadQueue((q) => [...q, item]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);
    formData.append("originalName", file.name);

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      setUploadQueue((q) =>
        q.map((it) =>
          it.id === id ? { ...it, loaded: e.loaded, fileSize: e.total } : it,
        ),
      );
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "done", loaded: it.fileSize } : it)));
        queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
        toast.success(`${file.name} subido`);
        // Guardar blob en IndexedDB + actualizar snapshot offline
        try {
          const body = JSON.parse(xhr.responseText);
          const evidenceId = body?.id || body?.evidence?.id;
          const evidenceUrl = body?.url || body?.evidence?.url;
          if (evidenceId && evidenceUrl) {
            // Guardar blob
            import("@/db/offline-db").then(({ getOfflineDB }) => {
              const db = getOfflineDB();
              db.evidenceBlobs.put({ id: evidenceId, blob: file });
              // Actualizar snapshot offline con la nueva evidencia
              db.sessions.get(sessionId).then((offline) => {
                if (!offline) return;
                const session = offline.session as SessionDetail;
                const newEvidence = {
                  id: evidenceId,
                  session_id: sessionId,
                  type: file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "document",
                  url: evidenceUrl,
                  description: file.name,
                  source: "mobile-online",
                  include_in_report: false,
                  created_at: new Date().toISOString(),
                  metadata: { originalName: file.name, fileSize: file.size, mimeType: file.type },
                };
                session.inspection_evidences = [...(session.inspection_evidences || []), newEvidence as never];
                db.sessions.update(sessionId, { session });
              });
            });
          }
        } catch (e) {
          console.warn("No se pudo guardar blob offline:", e);
        }
      } else {
        let msg = "Error al subir archivo";
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.error || `Error ${xhr.status}`;
        } catch {
          msg = `Error ${xhr.status}`;
        }
        setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: msg } : it)));
      }
    });

    xhr.addEventListener("error", () => {
      setUploadQueue((q) => q.map((it) => (it.id === id ? { ...it, status: "error", errorMsg: "Error de red" } : it)));
    });

    xhr.open("POST", "/api/inspection/evidences/upload");
    xhr.send(formData);
  }, [queryClient, sessionId, offlineMode, uploadFileOffline]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const f = await convertHeicToJpeg(file);
      uploadFile(f);
    } catch {
      toast.error(`No se pudo convertir ${file.name}: formato HEIC no soportado`);
    }
  }, [uploadFile]);

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files || [])) {
      await handleFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Limpiar cola 2s después de que todas terminen
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    const allDone = uploadQueue.every((it) => it.status === "done" || it.status === "error");
    if (!allDone) return;
    const timer = setTimeout(() => setUploadQueue([]), 2000);
    return () => clearTimeout(timer);
  }, [uploadQueue]);

  const handleDelete = async (evidenceId: string, name: string) => {
    const ok = await confirmDelete({
      title: "Eliminar evidencia",
      description: `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (ok) deleteMutation.mutate(evidenceId);
  };

  // Filtro flexible: el type puede venir como "photo", "image", "jpg", etc.
  const isPhoto = (t: string) => ["photo", "image", "jpg", "jpeg", "png"].includes(t.toLowerCase());
  const isVideo = (t: string) => ["video", "mp4", "mov"].includes(t.toLowerCase());
  const isDoc = (t: string) => ["document", "pdf", "doc", "docx", "file"].includes(t.toLowerCase());
  const photos = evidences?.filter((e) => isPhoto(e.type)) || [];
  const documents = evidences?.filter((e) => isDoc(e.type)) || [];
  const videos = evidences?.filter((e) => isVideo(e.type)) || [];

  const loading = offlineMode ? offlineLoading : isLoading;

  return (
    <div className="space-y-4">
      {/* Banner solo lectura */}
      {readOnly && (
        <div className="mobile-card border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-600">
            Inspección finalizada — las evidencias son de solo lectura
          </p>
        </div>
      )}

      {/* Botones de acción — siempre visibles en móvil */}
      {!readOnly && (
        <div className="space-y-2">
          {/* Tomar foto — botón grande siempre visible */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture={useFrontCamera ? "user" : "environment"}
            onChange={handleInput}
            className="hidden"
            id="mobile-evidence-camera"
          />
          <label
            htmlFor="mobile-evidence-camera"
            className="mobile-btn mobile-btn-primary w-full cursor-pointer"
          >
            <Camera className="h-5 w-5" />
            {useFrontCamera ? "Cámara frontal" : "Cámara trasera"}
          </label>
          <button
            type="button"
            onClick={() => setUseFrontCamera((v) => !v)}
            className="mobile-btn mobile-btn-outline w-full"
          >
            <SwitchCamera className="h-5 w-5" />
            Cambiar cámara
          </button>

          {/* Seleccionar archivos */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={handleInput}
          />
          <button
            className="mobile-btn mobile-btn-outline w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            Seleccionar archivos
          </button>
        </div>
      )}

      {/* Cola de subidas */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map((it) => {
            const progress = it.fileSize > 0 ? Math.round((it.loaded / it.fileSize) * 100) : 0;
            return (
              <div key={it.id} className="mobile-card">
                <div className="flex items-center gap-2">
                  {it.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : it.status === "error" ? (
                    <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{it.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(it.fileSize)}</span>
                      {it.status === "uploading" && <span>{progress}%</span>}
                      {it.errorMsg && <span className="text-rose-500">{it.errorMsg}</span>}
                    </div>
                    {it.status === "uploading" && (
                      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mobile-empty">
          <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
          <p className="mobile-empty-text">Cargando evidencias...</p>
        </div>
      )}

      {/* Error */}
      {!offlineMode && isError && (
        <div className="mobile-empty">
          <AlertCircle className="h-6 w-6 mobile-empty-icon" />
          <p className="mobile-empty-text">No se pudieron cargar las evidencias</p>
        </div>
      )}

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div>
          <p className="mobile-card-title mb-2">
            <ImageIcon className="inline h-4 w-4 mr-1" />
            Fotos ({photos.length})
          </p>
          <div className="mobile-photo-grid">
            {photos.map((ev) => (
              <div key={ev.id} className="mobile-photo-item relative group">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 or blob */}
                <img
                  src={ev.url}
                  alt={ev.description || ev.metadata?.originalName || "Evidencia"}
                  loading="lazy"
                  onClick={() => setZoomImage(ev.url)}
                />
                {/* GPS indicator */}
                {ev.exif_lat != null && ev.exif_lng != null && (
                  <div className="mobile-photo-badge" style={{ top: 4, right: 4 }}>
                    <MapPin className="h-3 w-3 text-white" />
                  </div>
                )}
                {/* AI status */}
                {(ev.ai_status === "pending" || ev.ai_status === "processing") && (
                  <div className="mobile-photo-badge" style={{ bottom: 4, left: 4 }}>
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  </div>
                )}
                {/* Delete button */}
                {!readOnly && (
                  <button
                    className="mobile-photo-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ev.id, ev.metadata?.originalName || ev.description || "evidencia");
                    }}
                    disabled={deleteMutation.isPending}
                    aria-label="Eliminar evidencia"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div>
          <p className="mobile-card-title mb-2">Videos ({videos.length})</p>
          <div className="mobile-photo-grid">
            {videos.map((ev) => (
              <div key={ev.id} className="mobile-photo-item relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded video thumbnail from R2 or blob */}
                <img src={ev.url} alt={ev.description || "video"} loading="lazy" />
                {!readOnly && (
                  <button
                    className="mobile-photo-delete-btn"
                    onClick={() => handleDelete(ev.id, ev.metadata?.originalName || "video")}
                    disabled={deleteMutation.isPending}
                    aria-label="Eliminar video"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentos */}
      {documents.length > 0 && (
        <div>
          <p className="mobile-card-title mb-2">Documentos ({documents.length})</p>
          <div className="space-y-2">
            {documents.map((ev) => (
              <div key={ev.id} className="mobile-card">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {ev.metadata?.originalName || ev.description || "documento"}
                    </p>
                    {ev.metadata?.fileSize && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(ev.metadata.fileSize)}</p>
                    )}
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs font-medium"
                  >
                    Ver
                  </a>
                  {!readOnly && (
                    <button
                      className="mobile-doc-delete-btn"
                      onClick={() => handleDelete(ev.id, ev.metadata?.originalName || "documento")}
                      disabled={deleteMutation.isPending}
                      aria-label="Eliminar documento"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !isError && evidences && evidences.length === 0 && uploadQueue.length === 0 && (
        <div className="mobile-empty">
          <Camera className="h-10 w-10 mobile-empty-icon" />
          <p className="mobile-empty-text">No hay evidencias todavía</p>
          {!readOnly && (
            <p className="text-xs text-muted-foreground mt-1">
              Toma una foto o selecciona archivos para subir
            </p>
          )}
        </div>
      )}

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 or blob */}
          <img src={zoomImage} alt="Evidencia" className="max-w-full max-h-full object-contain" />
          <button
            className="mobile-photo-close-btn mobile-photo-delete-btn"
            onClick={() => setZoomImage(null)}
            aria-label="Cerrar"
          >
            <XCircle className="h-6 w-6 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
