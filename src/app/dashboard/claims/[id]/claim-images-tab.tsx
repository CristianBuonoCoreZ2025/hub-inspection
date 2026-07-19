"use client";

import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClaimImages,
  deleteClaimImage,
  getInspectionPhotosByClaim,
  getInspectionSketchesByClaim,
  type ClaimImage,
  type InspectionImageFromSession,
  type InspectionSketchFromSession,
} from "@/services/claim-images";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Camera,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiAnalysisButton } from "@/components/ai/ai-analysis-button";
import { usePermissions } from "@/hooks/use-permissions";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";

interface ClaimImagesTabProps {
  claimId: string;
  claimStatusId?: string | null;
}

export default function ClaimImagesTab({ claimId, claimStatusId }: ClaimImagesTabProps) {
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();
  const { statusCode } = useClaimStatuses();
  const currentStatusCode = statusCode(claimStatusId) ?? "created";
  const isClaimClosed = currentStatusCode === "closed";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    visible: boolean;
    fileName: string;
    fileSize: number;
    loaded: number;
    speed: number;
    elapsed: number;
    status: "uploading" | "processing" | "done" | "error";
    errorMsg?: string;
  } | null>(null);

  const canCreateImages = canCreate("claims_imagenes");
  const canDeleteImages = canDelete("claims_imagenes") && !isClaimClosed;

  // ─── Query: imágenes del siniestro ───
  const { data: claimImages, isLoading: imagesLoading } = useQuery({
    queryKey: ["claim-images", claimId],
    queryFn: () => getClaimImages(claimId),
  });

  // ─── Query: fotos de inspecciones del siniestro ───
  const { data: inspectionPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ["inspection-photos-by-claim", claimId],
    queryFn: () => getInspectionPhotosByClaim(claimId),
  });

  // ─── Query: croquis de inspecciones del siniestro ───
  const { data: inspectionSketches, isLoading: sketchesLoading } = useQuery({
    queryKey: ["inspection-sketches-by-claim", claimId],
    queryFn: () => getInspectionSketchesByClaim(claimId),
  });

  // ─── Mutation: subir imagen ───
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      return new Promise<{ image: ClaimImage }>((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("claimId", claimId);

        const xhr = new XMLHttpRequest();
        const startTime = Date.now();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const elapsed = Date.now() - startTime;
            const speed = elapsed > 0 ? (e.loaded / 1024) / (elapsed / 1000) : 0;
            setUploadProgress({
              visible: true,
              fileName: file.name,
              fileSize: e.total,
              loaded: e.loaded,
              speed,
              elapsed,
              status: "uploading",
            });
          }
        });

        xhr.upload.addEventListener("load", () => {
          const elapsed = Date.now() - startTime;
          const finalSpeed = elapsed > 0 ? (file.size / 1024) / (elapsed / 1000) : 0;
          setUploadProgress((p) => ({
            ...p!,
            loaded: p!.fileSize,
            speed: finalSpeed,
            elapsed,
            status: "uploading",
          }));
          setTimeout(() => {
            setUploadProgress((p) => ({ ...p!, status: "processing" }));
          }, 400);
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadProgress((p) => ({ ...p!, status: "done" }));
              resolve(data);
            } catch {
              reject(new Error("Respuesta inválida del servidor"));
            }
          } else {
            let msg = "Error al subir imagen";
            try {
              const body = JSON.parse(xhr.responseText);
              if (body.error) msg = body.error;
            } catch {
              msg = `Error ${xhr.status}`;
            }
            setUploadProgress((p) => ({ ...p!, status: "error", errorMsg: msg }));
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => {
          setUploadProgress((p) => ({ ...p!, status: "error", errorMsg: "Error de red" }));
          reject(new Error("Error de red"));
        });

        xhr.open("POST", "/api/claims/images/upload");
        xhr.send(formData);
      });
    },
    onMutate: (file) => {
      setUploadProgress({
        visible: true,
        fileName: file.name,
        fileSize: file.size,
        loaded: 0,
        speed: 0,
        elapsed: 0,
        status: "uploading",
      });
    },
    onSuccess: () => {
      toast.success("Imagen subida");
      queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
      setTimeout(() => setUploadProgress(null), 1500);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setTimeout(() => setUploadProgress(null), 3000);
    },
  });

  // ─── Mutation: eliminar imagen ───
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClaimImage(id),
    onSuccess: () => {
      toast.success("Imagen eliminada");
      queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} no es una imagen`);
          continue;
        }
        uploadMut.mutate(file);
      }
      e.target.value = "";
    },
    [uploadMut]
  );

  const formatSpeed = (kbps: number) =>
    kbps > 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${kbps.toFixed(0)} KB/s`;

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Agrupar fotos de inspección por sesión
  const photosBySession = (inspectionPhotos || []).reduce<
    Record<string, { sessionLabel: string; photos: InspectionImageFromSession[] }>
  >((acc, photo) => {
    const sid = photo.session_id;
    if (!acc[sid]) {
      const session = photo.session;
      const actionCode = session?.claim_action?.code || session?.action_template?.code || "INS";
      const date = session?.scheduled_at
        ? new Date(session.scheduled_at).toLocaleDateString("es-CL")
        : "Sin fecha";
      acc[sid] = { sessionLabel: `${actionCode} — ${date}`, photos: [] };
    }
    acc[sid].photos.push(photo);
    return acc;
  }, {});

  const sketchesBySession = (inspectionSketches || []).reduce<
    Record<string, { sessionLabel: string; sketches: InspectionSketchFromSession[] }>
  >((acc, sketch) => {
    const sid = sketch.session_id;
    if (!acc[sid]) {
      const session = sketch.session;
      const actionCode = session?.claim_action?.code || session?.action_template?.code || "INS";
      const date = session?.scheduled_at
        ? new Date(session.scheduled_at).toLocaleDateString("es-CL")
        : "Sin fecha";
      acc[sid] = { sessionLabel: `${actionCode} — ${date}`, sketches: [] };
    }
    acc[sid].sketches.push(sketch);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ═══ Sección 1: Imágenes del Siniestro ═══ */}
      <div className="app-panel">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Imágenes del Siniestro
            {claimImages && claimImages.length > 0 && (
              <span className="text-[11px] text-muted-foreground">({claimImages.length})</span>
            )}
          </h3>
          {canCreateImages && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="pg-btn-platinum-icon"
                disabled={uploadMut.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadMut.isPending ? "Subiendo..." : "Subir"}
              </Button>
            </>
          )}
        </div>

        {imagesLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : claimImages && claimImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {claimImages.map((img) => (
              <ClaimImageCard
                key={img.id}
                image={img}
                canDelete={canDeleteImages}
                onDelete={() => deleteMut.mutate(img.id)}
                onZoom={() => setZoomImage(img.url)}
                claimId={claimId}
              />
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            No hay imágenes subidas al siniestro.
          </p>
        )}

        {/* Barra de progreso de subida */}
        {uploadProgress?.visible && (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium truncate max-w-[200px]">{uploadProgress.fileName}</span>
              {uploadProgress.status === "uploading" && (
                <span className="text-muted-foreground tabular-nums">
                  {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.fileSize)} · {formatSpeed(uploadProgress.speed)} · {formatElapsed(uploadProgress.elapsed)}
                </span>
              )}
              {uploadProgress.status === "processing" && (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Procesando (optimización + IA)...
                </span>
              )}
              {uploadProgress.status === "done" && (
                <span className="text-emerald-600 dark:text-emerald-400">Completado</span>
              )}
              {uploadProgress.status === "error" && (
                <span className="text-red-600 dark:text-red-400">{uploadProgress.errorMsg}</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={
                  "h-full transition-all duration-200 " +
                  (uploadProgress.status === "error"
                    ? "bg-red-500"
                    : uploadProgress.status === "done"
                    ? "bg-emerald-500"
                    : uploadProgress.status === "processing"
                    ? "bg-amber-500 animate-pulse w-full"
                    : "bg-primary")
                }
                style={{
                  width:
                    uploadProgress.status === "processing" || uploadProgress.status === "done"
                      ? "100%"
                      : `${(uploadProgress.loaded / uploadProgress.fileSize) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ Sección 2: Imágenes de Inspecciones ═══ */}
      <div className="app-panel">
        <h3 className="mb-3 text-[13px] font-semibold flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Imágenes de Inspecciones
          {inspectionPhotos && inspectionPhotos.length > 0 && (
            <span className="text-[11px] text-muted-foreground">({inspectionPhotos.length})</span>
          )}
        </h3>
        {photosLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : inspectionPhotos && inspectionPhotos.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(photosBySession).map(([sessionId, { sessionLabel, photos }]) => (
              <div key={sessionId}>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {sessionLabel}
                  <span className="text-muted-foreground/60">({photos.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {photos.map((photo) => (
                    <InspectionImageCard
                      key={photo.id}
                      photo={photo}
                      onZoom={() => setZoomImage(photo.url)}
                      claimId={claimId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            No hay imágenes de inspecciones para este siniestro.
          </p>
        )}
      </div>

      {/* ═══ Sección 3: Croquis de Inspecciones ═══ */}
      <div className="app-panel">
        <h3 className="mb-3 text-[13px] font-semibold flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Croquis de Inspecciones
          {inspectionSketches && inspectionSketches.length > 0 && (
            <span className="text-[11px] text-muted-foreground">({inspectionSketches.length})</span>
          )}
        </h3>
        {sketchesLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : inspectionSketches && inspectionSketches.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(sketchesBySession).map(([sessionId, { sessionLabel, sketches }]) => (
              <div key={sessionId}>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {sessionLabel}
                  <span className="text-muted-foreground/60">({sketches.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {sketches.map((sketch) => (
                    <div
                      key={sketch.id}
                      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
                      <img
                        src={sketch.sketch_url}
                        alt={sketch.label || "Croquis"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <a
                          href={sketch.sketch_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                          title="Abrir"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => setZoomImage(sketch.sketch_url)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                          title="Ampliar"
                        >
                          <ZoomIn className="h-3 w-3" />
                        </button>
                      </div>
                      {sketch.label && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-white truncate">
                          {sketch.label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            No hay croquis de inspecciones para este siniestro.
          </p>
        )}
      </div>

      {/* ═══ Modal de zoom ═══ */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomImage(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setZoomImage(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
          <img
            src={zoomImage}
            alt="Imagen ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Card: imagen del siniestro (con delete + IA) ───────────────

function ClaimImageCard({
  image,
  canDelete,
  onDelete,
  onZoom,
  claimId,
}: {
  image: ClaimImage;
  canDelete: boolean;
  onDelete: () => void;
  onZoom: () => void;
  claimId: string;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/20">
      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
      <img
        src={image.url}
        alt={image.original_filename || image.img_code}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {/* Overlay de acciones */}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onZoom}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
          title="Ampliar"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
          title="Abrir"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        {canDelete && (
          <button
            onClick={() => {
              if (confirm("¿Eliminar esta imagen?")) onDelete();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-red-500/80"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* Código + IA */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
        <div className="text-[9px] font-mono text-white truncate">{image.img_code}</div>
        {image.ai_summary && (
          <div className="text-[8px] text-violet-200 truncate italic" title={image.ai_summary}>
            {image.ai_summary}
          </div>
        )}
      </div>
      {/* Botón IA (esquina inferior derecha, sobre el overlay) */}
      <div className="absolute bottom-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
        <AiAnalysisButton
          table="claim_images"
          id={image.id}
          fileName={image.original_filename || image.img_code}
          hasSummary={!!image.ai_summary}
          queryKey={["claim-images", claimId]}
        />
      </div>
    </div>
  );
}

// ─── Card: imagen de inspección (read-only + IA) ────────────────

function InspectionImageCard({
  photo,
  onZoom,
  claimId,
}: {
  photo: InspectionImageFromSession;
  onZoom: () => void;
  claimId: string;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/20">
      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
      <img
        src={photo.url}
        alt={photo.description || "Evidencia"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onZoom}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
          title="Ampliar"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        <a
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
          title="Abrir"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {/* Badge "Inspección" — no se puede eliminar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
        <div className="text-[9px] font-mono text-white truncate">{photo.description || "EVI"}</div>
        {photo.ai_summary && (
          <div className="text-[8px] text-violet-200 truncate italic" title={photo.ai_summary}>
            {photo.ai_summary}
          </div>
        )}
      </div>
      <div className="absolute bottom-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
        <AiAnalysisButton
          table="inspection_evidences"
          id={photo.id}
          fileName={photo.metadata?.originalName || photo.description || "Evidencia"}
          hasSummary={!!photo.ai_summary}
          queryKey={["inspection-photos-by-claim", claimId]}
        />
      </div>
    </div>
  );
}
