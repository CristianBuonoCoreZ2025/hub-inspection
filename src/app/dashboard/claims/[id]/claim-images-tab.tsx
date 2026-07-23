"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClaimImages,
  deleteClaimImage,
  getInspectionPhotosByClaim,
  getInspectionSketchesByClaim,
  type ClaimImage,
} from "@/services/claim-images";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Loader2,
  Camera,
  Pencil,
  X,
  ZoomIn,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiAnalysisButton } from "@/components/ai/ai-analysis-button";
import { usePermissions } from "@/hooks/use-permissions";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";

interface ClaimImagesTabProps {
  claimId: string;
  claimStatusId?: string | null;
}

// ─── Tipo unificado para todas las imágenes ───
type UnifiedImage = {
  id: string;
  origen: "siniestro" | "inspeccion" | "croquis";
  codigo: string;
  descripcion: string | null;
  url: string;
  fileSize: number | null;
  aiSummary: string | null;
  aiStatus: string | null;
  canDelete: boolean;
  canAnalyze: boolean;
  table: "claim_images" | "inspection_evidences" | null;
  fileName: string;
};

export default function ClaimImagesTab({ claimId, claimStatusId }: ClaimImagesTabProps) {
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();
  const { statusCode } = useClaimStatuses();
  const currentStatusCode = statusCode(claimStatusId) ?? "created";
  const isClaimClosed = currentStatusCode === "closed";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [aiSummaryModal, setAiSummaryModal] = useState<{ visible: boolean; title: string; summary: string }>({ visible: false, title: "", summary: "" });

  // ─── Modal de subida (drag&drop + progreso) ───
  const [uploadModal, setUploadModal] = useState<{
    visible: boolean;
    fileName: string;
    fileSize: number;
    loaded: number;
    speed: number;
    elapsed: number;
    status: "idle" | "uploading" | "processing" | "done" | "error";
    errorMsg?: string;
    isDragging: boolean;
  }>({ visible: false, fileName: "", fileSize: 0, loaded: 0, speed: 0, elapsed: 0, status: "idle", isDragging: false });

  const canCreateImages = canCreate("claims_imagenes");
  const canDeleteImages = canDelete("claims_imagenes") && !isClaimClosed;

  // ─── Queries ───
  const { data: claimImages, isLoading: imagesLoading } = useQuery({
    queryKey: ["claim-images", claimId],
    queryFn: () => getClaimImages(claimId),
    // Polling cada 5s mientras hay imágenes siendo procesadas.
    // Timeout: deja de pollar después de 2 min si el after() falló.
    refetchInterval: (query) => {
      const imgs = query.state.data;
      if (!imgs || !imgs.some((i) => i.ai_status === "pending")) return false;
      const oldest = imgs.filter((i) => i.ai_status === "pending")
        .reduce((min, i) => Math.min(min, new Date(i.created_at).getTime()), Date.now());
      if (Date.now() - oldest > 120_000) return false;
      return 5000;
    },
  });

  const { data: inspectionPhotos } = useQuery({
    queryKey: ["inspection-photos-by-claim", claimId],
    queryFn: () => getInspectionPhotosByClaim(claimId),
    // Polling cada 5s mientras hay fotos de inspección siendo procesadas por IA
    refetchInterval: (query) => {
      const photos = query.state.data;
      if (!photos || !photos.some((p) => p.ai_status === "pending")) return false;
      const oldest = photos.filter((p) => p.ai_status === "pending")
        .reduce((min, p) => Math.min(min, new Date(p.created_at).getTime()), Date.now());
      if (Date.now() - oldest > 120_000) return false;
      return 5000;
    },
  });

  const { data: inspectionSketches } = useQuery({
    queryKey: ["inspection-sketches-by-claim", claimId],
    queryFn: () => getInspectionSketchesByClaim(claimId),
  });

  // ─── Unificar todas las imágenes en una sola lista ───
  const allImages = useMemo<UnifiedImage[]>(() => {
    const imgs: UnifiedImage[] = [];

    // 1. Imágenes del siniestro
    for (const img of claimImages || []) {
      imgs.push({
        id: img.id,
        origen: "siniestro",
        codigo: img.img_code,
        descripcion: img.original_filename,
        url: img.url,
        fileSize: img.file_size,
        aiSummary: img.ai_summary,
        aiStatus: img.ai_status,
        canDelete: canDeleteImages,
        canAnalyze: true,
        table: "claim_images",
        fileName: img.original_filename || img.img_code,
      });
    }

    // 2. Fotos de inspección
    for (const photo of inspectionPhotos || []) {
      const session = photo.session;
      const actionCode = session?.claim_action?.code || session?.action_template?.code || "INS";
      const date = session?.scheduled_at
        ? new Date(session.scheduled_at).toLocaleDateString("es-CL")
        : "";
      imgs.push({
        id: photo.id,
        origen: "inspeccion",
        codigo: `${actionCode}${date ? " " + date : ""}`,
        descripcion: photo.description,
        url: photo.url,
        fileSize: photo.metadata?.fileSize || null,
        aiSummary: photo.ai_summary,
        aiStatus: photo.ai_status,
        canDelete: false,
        canAnalyze: true,
        table: "inspection_evidences",
        fileName: photo.metadata?.originalName || photo.description || "Evidencia",
      });
    }

    // 3. Croquis de inspección
    for (const sketch of inspectionSketches || []) {
      const session = sketch.session;
      const actionCode = session?.claim_action?.code || session?.action_template?.code || "INS";
      const date = session?.scheduled_at
        ? new Date(session.scheduled_at).toLocaleDateString("es-CL")
        : "";
      imgs.push({
        id: sketch.id,
        origen: "croquis",
        codigo: `${actionCode}${date ? " " + date : ""}`,
        descripcion: sketch.label,
        url: sketch.sketch_url,
        fileSize: null,
        aiSummary: null,
        aiStatus: null,
        canDelete: false,
        canAnalyze: false,
        table: null,
        fileName: sketch.label || "Croquis",
      });
    }

    return imgs;
  }, [claimImages, inspectionPhotos, inspectionSketches, canDeleteImages]);

  // ─── Paginación ───
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } =
    usePagination(allImages, 12);

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
            setUploadModal((p) => ({
              ...p,
              loaded: e.loaded,
              fileSize: e.total,
              speed,
              elapsed,
              status: "uploading",
            }));
          }
        });

        xhr.upload.addEventListener("load", () => {
          const elapsed = Date.now() - startTime;
          const finalSpeed = elapsed > 0 ? (file.size / 1024) / (elapsed / 1000) : 0;
          setUploadModal((p) => ({
            ...p,
            loaded: p.fileSize,
            speed: finalSpeed,
            elapsed,
            status: "uploading",
          }));
          setTimeout(() => {
            setUploadModal((p) => ({ ...p, status: "processing" }));
          }, 400);
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadModal((p) => ({ ...p, status: "done" }));
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
            setUploadModal((p) => ({ ...p, status: "error", errorMsg: msg }));
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => {
          setUploadModal((p) => ({ ...p, status: "error", errorMsg: "Error de red" }));
          reject(new Error("Error de red"));
        });

        xhr.open("POST", "/api/claims/images/upload");
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      toast.success("Imagen subida");
      queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
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
      const file = e.target.files?.[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} no es una imagen`);
          return;
        }
        uploadMut.mutate(file);
      }
      e.target.value = "";
    },
    [uploadMut]
  );

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (kbps: number) =>
    kbps > 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${kbps.toFixed(0)} KB/s`;

  // ─── Badge de origen ───
  function OrigenBadge({ origen }: { origen: UnifiedImage["origen"] }) {
    if (origen === "siniestro") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300">
          <ImageIcon className="h-3 w-3" />
          Siniestro
        </span>
      );
    }
    if (origen === "inspeccion") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300">
          <Camera className="h-3 w-3" />
          Inspección
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-700 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-300">
        <Pencil className="h-3 w-3" />
        Croquis
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ GRILLA UNIFICADA: todas las imágenes ═══ */}
      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <h3 className="app-section-title">
              <ImageIcon className="h-4 w-4" />
              Imágenes
              {total > 0 && (
                <span className="text-[11px] text-muted-foreground">({total})</span>
              )}
            </h3>
            {canCreateImages && (
              <Button
                onClick={() => setUploadModal((p) => ({ ...p, visible: true, status: "idle", fileName: "", fileSize: 0, loaded: 0, isDragging: false }))}
                className="pg-btn-platinum-icon"
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir
              </Button>
            )}
          </div>
          {total > 0 && (
            <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          )}
        </div>

        {imagesLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : paginatedData.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {paginatedData.map((img) => (
                <UnifiedImageCard
                  key={img.id}
                  image={img}
                  onZoom={() => setZoomImage(img.url)}
                  onDelete={() => deleteMut.mutate(img.id)}
                  onShowSummary={() => setAiSummaryModal({ visible: true, title: img.descripcion || img.codigo, summary: img.aiSummary! })}
                  claimId={claimId}
                  formatFileSize={formatFileSize}
                  OrigenBadge={OrigenBadge}
                />
              ))}
            </div>

            {/* Paginación abajo */}
            <div className="mt-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay imágenes para este siniestro.
          </p>
        )}
      </div>

      {/* ═══ MODAL: Subir imagen (drag&drop + progreso) ═══ */}
      <Dialog
        open={uploadModal.visible}
        onOpenChange={(open) => {
          if (!open && (uploadModal.status === "uploading" || uploadModal.status === "processing")) return;
          setUploadModal((p) => ({ ...p, visible: open, status: "idle" }));
        }}
        dismissible={false}
      >
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {uploadModal.status === "done"
                ? "Imagen subida"
                : uploadModal.status === "error"
                ? "Error"
                : uploadModal.status === "idle"
                ? "Subir imagen"
                : "Subiendo imagen"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* ─── Fase idle: drag&drop ─── */}
            {uploadModal.status === "idle" && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setUploadModal((p) => ({ ...p, isDragging: true }));
                  }}
                  onDragLeave={() => setUploadModal((p) => ({ ...p, isDragging: false }))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setUploadModal((p) => ({ ...p, isDragging: false }));
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (!file.type.startsWith("image/")) {
                        toast.error(`${file.name} no es una imagen`);
                        return;
                      }
                      uploadMut.mutate(file);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    uploadModal.isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <Upload className={`h-8 w-8 ${uploadModal.isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-[12px] font-medium text-foreground">
                    Arrastra la imagen aquí
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    o haz clic para seleccionar
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="pg-btn-platinum mt-1"
                  >
                    Seleccionar
                  </Button>
                </div>

                <div className="text-[10px] text-muted-foreground text-center">
                  JPG, PNG, WebP, GIF · máx. 50 MB
                </div>
              </>
            )}

            {/* ─── Fase uploading/processing/done/error: info + progreso ─── */}
            {uploadModal.status !== "idle" && (
              <>
                {/* Info del archivo */}
                <div className="flex items-center gap-2.5 rounded-md bg-muted/40 p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-foreground">{uploadModal.fileName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatFileSize(uploadModal.fileSize)}</div>
                  </div>
                </div>

                {/* Subiendo: barra de progreso */}
                {uploadModal.status === "uploading" && (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-[11px] text-muted-foreground">Subiendo...</span>
                      <div className="flex items-end gap-3">
                        {uploadModal.speed > 0 && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatSpeed(uploadModal.speed)}
                          </span>
                        )}
                        <span className="text-lg font-bold tabular-nums text-primary leading-none">
                          {uploadModal.fileSize > 0
                            ? Math.round((uploadModal.loaded / uploadModal.fileSize) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                        style={{
                          width: `${uploadModal.fileSize > 0 ? (uploadModal.loaded / uploadModal.fileSize) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>
                        {formatFileSize(uploadModal.loaded)} / {formatFileSize(uploadModal.fileSize)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Procesando */}
                {uploadModal.status === "processing" && (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-[11px] text-muted-foreground">Registrando imagen...</span>
                  </div>
                )}

                {/* Done */}
                {uploadModal.status === "done" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600">Imagen subida correctamente</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-6">
                      {formatFileSize(uploadModal.fileSize)} · {uploadModal.fileName}
                    </div>
                  </div>
                )}

                {/* Error */}
                {uploadModal.status === "error" && (
                  <div className="flex items-center gap-2 py-1">
                    <XCircle className="h-4 w-4 text-rose-500" />
                    <span className="text-[11px] font-medium text-rose-600">
                      {uploadModal.errorMsg || "Error al subir"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {uploadModal.status === "idle" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false }))}
              >
                Cancelar
              </Button>
            )}
            {uploadModal.status === "done" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false, status: "idle" }))}
              >
                Cerrar
              </Button>
            )}
            {uploadModal.status === "error" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, status: "idle", fileName: "", fileSize: 0, loaded: 0 }))}
              >
                Reintentar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
            <div style={{ maxHeight: "60vh", overflowY: "auto" }} className="rounded-md bg-violet-50/50 p-3 text-[12px] leading-relaxed text-violet-900 dark:bg-violet-950/20 dark:text-violet-200 whitespace-pre-wrap">
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

// ─── Card unificada para todas las imágenes ────────────────────

function UnifiedImageCard({
  image,
  onZoom,
  onDelete,
  onShowSummary,
  claimId,
  formatFileSize,
  OrigenBadge,
}: {
  image: UnifiedImage;
  onZoom: () => void;
  onDelete: () => void;
  onShowSummary: () => void;
  claimId: string;
  formatFileSize: (bytes?: number | null) => string;
  OrigenBadge: React.ComponentType<{ origen: UnifiedImage["origen"] }>;
}) {
  const isPending = image.aiStatus === "pending";

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Imagen */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
        <img
          src={image.url}
          alt={image.descripcion || image.codigo}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          loading="lazy"
        />
        {/* Acciones sobre la imagen (hover) */}
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onZoom}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
            title="Ampliar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm ${
              isPending ? "cursor-not-allowed opacity-40" : "hover:bg-black/80"
            }`}
            title={isPending ? "Procesando..." : "Abrir"}
            onClick={isPending ? (e) => e.preventDefault() : undefined}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {image.canDelete && (
            <button
              onClick={() => {
                if (isPending) return;
                if (confirm("¿Eliminar esta imagen?")) onDelete();
              }}
              disabled={isPending}
              className={`flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm ${
                isPending ? "cursor-not-allowed opacity-40" : "hover:bg-red-500/80"
              }`}
              title={isPending ? "Procesando..." : "Eliminar"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Badge de origen sobre la imagen */}
        <div className="absolute left-1.5 top-1.5">
          <OrigenBadge origen={image.origen} />
        </div>
      </div>

      {/* Info debajo de la imagen */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        {/* Código + tamaño */}
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[10px] font-medium text-foreground truncate">
            {image.codigo}
          </span>
          <span className="shrink-0 text-[9px] text-muted-foreground">
            {formatFileSize(image.fileSize)}
          </span>
        </div>

        {/* Descripción / filename */}
        {image.descripcion && (
          <div className="truncate text-[9px] text-muted-foreground" title={image.descripcion}>
            {image.descripcion}
          </div>
        )}

        {/* Análisis IA */}
        {isPending ? (
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
            <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
            <span className="font-medium">Analizando con IA...</span>
          </div>
        ) : image.aiSummary ? (
          <div
            className="mt-0.5 flex items-start gap-1 rounded bg-violet-50/50 p-1 dark:bg-violet-950/20 cursor-pointer hover:bg-violet-100/70 dark:hover:bg-violet-900/30"
            title={image.aiSummary}
            onClick={onShowSummary}
          >
            <Zap className="mt-0.5 h-2.5 w-2.5 shrink-0 text-violet-500" />
            <p className="line-clamp-2 text-[9px] leading-relaxed text-violet-700 dark:text-violet-300">
              {image.aiSummary}
            </p>
          </div>
        ) : null}

        {/* Botón IA */}
        {image.canAnalyze && image.table && (
          <div className="mt-auto pt-1">
            <AiAnalysisButton
              table={image.table}
              id={image.id}
              fileName={image.fileName}
              hasSummary={!!image.aiSummary}
              queryKey={
                image.origen === "siniestro"
                  ? ["claim-images", claimId]
                  : ["inspection-photos-by-claim", claimId]
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
