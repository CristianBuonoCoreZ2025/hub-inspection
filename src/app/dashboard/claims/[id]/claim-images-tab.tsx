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
  CheckCircle2,
  XCircle,
  Ban,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AiAnalysisButton } from "@/components/ai/ai-analysis-button";
import { AiProgressOverlay } from "@/components/ai/ai-progress-overlay";
import { cleanMarkdown } from "@/lib/utils";
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
  aiModel: string | null;
  aiStatus: string | null;
  aiProgress: string | null;
  aiPromptSnapshot: { system_prompt: string; user_prompt: string; refinement_prompt: string | null; source: string } | null;
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
  // El popover de IA ahora vive dentro de cada card (no estado global)

  // ─── Modal de subida (drag&drop + progreso) ───
  type UploadItem = {
    id: string;
    file: File;
    status: "queued" | "uploading" | "processing" | "done" | "error";
    loaded: number;
    speed: number;
    errorMsg?: string;
    result?: {
      imgCode: string;
      url: string;
      fileSize: number;
      ext: string;
    };
  };

  const [uploadModal, setUploadModal] = useState<{
    visible: boolean;
    items: UploadItem[];
    isDragging: boolean;
  }>({ visible: false, items: [], isDragging: false });

  const uploadStatus: "idle" | "uploading" | "done" | "error" = (() => {
    if (uploadModal.items.length === 0) return "idle";
    if (uploadModal.items.some((i) => i.status === "uploading" || i.status === "processing" || i.status === "queued")) return "uploading";
    if (uploadModal.items.some((i) => i.status === "error")) return "error";
    return "done";
  })();

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
      if (!imgs || !imgs.some((i) => i.ai_status === "pending" || i.ai_status === "processing")) return false;
      const oldest = imgs.filter((i) => i.ai_status === "pending" || i.ai_status === "processing")
        .reduce((min, i) => Math.min(min, new Date(i.created_at).getTime()), Date.now());
      if (Date.now() - oldest > 300_000) return false;
      // 2s mientras hay processing (para actualizar el termómetro), 5s si solo hay pending
      const hasProcessing = imgs.some((i) => i.ai_status === "processing");
      return hasProcessing ? 2000 : 5000;
    },
  });

  const { data: inspectionPhotos } = useQuery({
    queryKey: ["inspection-photos-by-claim", claimId],
    queryFn: () => getInspectionPhotosByClaim(claimId),
    // Polling cada 5s mientras hay fotos de inspección siendo procesadas por IA
    refetchInterval: (query) => {
      const photos = query.state.data;
      if (!photos || !photos.some((p) => p.ai_status === "pending" || p.ai_status === "processing")) return false;
      const oldest = photos.filter((p) => p.ai_status === "pending" || p.ai_status === "processing")
        .reduce((min, p) => Math.min(min, new Date(p.created_at).getTime()), Date.now());
      if (Date.now() - oldest > 300_000) return false;
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
        aiModel: img.ai_model,
        aiStatus: img.ai_status,
        aiProgress: img.ai_progress,
        aiPromptSnapshot: img.ai_prompt_snapshot,
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
        aiModel: photo.ai_model,
        aiStatus: photo.ai_status,
        aiProgress: photo.ai_progress,
        aiPromptSnapshot: photo.ai_prompt_snapshot,
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
        aiModel: null,
        aiStatus: null,
        aiProgress: null,
        aiPromptSnapshot: null,
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

  // ─── Subir un archivo individual (XHR con progreso) ───
  const uploadOneFile = useCallback(
    (item: UploadItem): Promise<{ imgCode: string; url: string; fileSize: number; ext: string }> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("claimId", claimId);

        const xhr = new XMLHttpRequest();
        const startTime = Date.now();

        const updateItem = (patch: Partial<UploadItem>) => {
          setUploadModal((p) => ({
            ...p,
            items: p.items.map((it) => (it.id === item.id ? { ...it, ...patch } : it)),
          }));
        };

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const elapsed = Date.now() - startTime;
            const speed = elapsed > 0 ? (e.loaded / 1024) / (elapsed / 1000) : 0;
            updateItem({ loaded: e.loaded, speed, status: "uploading" });
          }
        });

        xhr.upload.addEventListener("load", () => {
          updateItem({ loaded: item.file.size, status: "processing" });
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              const img = data.image as ClaimImage;
              const ext = item.file.name.split(".").pop()?.toUpperCase() || "IMG";
              updateItem({
                status: "done",
                result: {
                  imgCode: img.img_code,
                  url: img.url,
                  fileSize: item.file.size,
                  ext,
                },
              });
              resolve({ imgCode: img.img_code, url: img.url, fileSize: item.file.size, ext });
            } catch {
              updateItem({ status: "error", errorMsg: "Respuesta inválida del servidor" });
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
            updateItem({ status: "error", errorMsg: msg });
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => {
          updateItem({ status: "error", errorMsg: "Error de red" });
          reject(new Error("Error de red"));
        });

        xhr.open("POST", "/api/claims/images/upload");
        xhr.send(formData);
      });
    },
    [claimId]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;

      // Filtrar solo imágenes
      const images = files.filter((f) => f.type.startsWith("image/"));
      const skipped = files.length - images.length;
      if (skipped > 0) {
        toast.error(`${skipped} archivo(s) no son imágenes y se omitieron`);
      }
      if (images.length === 0) return;

      // Crear items en cola
      const newItems: UploadItem[] = images.map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        status: "queued",
        loaded: 0,
        speed: 0,
      }));

      setUploadModal((p) => ({
        ...p,
        visible: true,
        items: [...p.items, ...newItems],
      }));

      // Subir secuencialmente
      for (const item of newItems) {
        try {
          await uploadOneFile(item);
        } catch {
          // El error ya está en el item, continuar con el siguiente
        }
      }

      // Invalidar query para refrescar la grilla
      queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });

      // Disparar análisis de IA en background
      fetch("/api/ai/process-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId }),
      }).catch(() => {});
    },
    [uploadOneFile, claimId, queryClient]
  );

  // ─── Mutation: eliminar imagen ───
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClaimImage(id),
    onSuccess: () => {
      toast.success("Imagen eliminada");
      queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
                onClick={() => setUploadModal((p) => ({ ...p, visible: true, items: [], isDragging: false }))}
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
                  claimId={claimId}
                  formatFileSize={formatFileSize}
                  OrigenBadge={OrigenBadge}
                  queryClient={queryClient}
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

      {/* ═══ MODAL: Subir imágenes (cola + resultados) ═══ */}
      <Dialog
        open={uploadModal.visible}
        onOpenChange={(open) => {
          if (!open && uploadStatus === "uploading") return;
          setUploadModal((p) => ({ ...p, visible: open, items: [] }));
        }}
        dismissible={false}
      >
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {uploadStatus === "done"
                ? `Subidas completadas (${uploadModal.items.filter((i) => i.status === "done").length}/${uploadModal.items.length})`
                : uploadStatus === "error"
                ? "Subida con errores"
                : uploadStatus === "uploading"
                ? `Subiendo imágenes (${uploadModal.items.filter((i) => i.status === "done").length}/${uploadModal.items.length})`
                : "Subir imágenes"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* ─── Fase idle: drag&drop ─── */}
            {uploadModal.items.length === 0 && (
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
                    const files = Array.from(e.dataTransfer.files || []);
                    if (files.length > 0) {
                      const input = { target: { files: e.dataTransfer.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      handleFileSelect(input);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    uploadModal.isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <Upload className={`h-8 w-8 ${uploadModal.isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-[11px] font-medium text-foreground">
                    Arrastra las imágenes aquí
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    o haz clic para seleccionar (múltiples)
                  </div>
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
                    className="pg-btn-platinum mt-1"
                  >
                    Seleccionar
                  </Button>
                </div>

                <div className="text-[10px] text-muted-foreground text-center">
                  JPG, PNG, WebP, GIF · máx. 50 MB · múltiples archivos
                </div>
              </>
            )}

            {/* ─── Cola de subida / Resultados ─── */}
            {uploadModal.items.length > 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {uploadModal.items.map((item, idx) => {
                  const ext = item.file.name.split(".").pop()?.toUpperCase() || "IMG";
                  const pct = item.file.size > 0 ? Math.round((item.loaded / item.file.size) * 100) : 0;
                  return (
                    <div key={item.id} className="upload-result-row">
                      {/* Fila superior: icono + nombre + estado */}
                      <div className="flex items-center gap-2.5">
                        {/* Icono / thumbnail */}
                        <div className="upload-result-icon">
                          {item.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : item.status === "error" ? (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          ) : item.status === "uploading" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : item.status === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                            <span className="truncate text-[11px] font-medium text-foreground">
                              {item.file.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{ext}</span>
                            <span>·</span>
                            <span>{formatFileSize(item.file.size)}</span>
                            {item.result?.imgCode && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-foreground font-medium">{item.result.imgCode}</span>
                              </>
                            )}
                            {item.errorMsg && (
                              <>
                                <span>·</span>
                                <span className="text-rose-500">{item.errorMsg}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Porcentaje / badge */}
                        <div className="shrink-0">
                          {item.status === "uploading" && (
                            <span className="text-sm font-bold tabular-nums text-primary">{pct}%</span>
                          )}
                          {item.status === "processing" && (
                            <span className="text-[10px] text-amber-600">guardando...</span>
                          )}
                          {item.status === "queued" && (
                            <span className="text-[10px] text-muted-foreground">en cola</span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      {item.status === "uploading" && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                            style={{ width: `${pct}%` }}
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
            {uploadModal.items.length === 0 && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false }))}
              >
                Cancelar
              </Button>
            )}
            {uploadStatus === "uploading" && (
              <div className="text-[10px] text-muted-foreground">
                Subiendo en orden... no cierres esta ventana
              </div>
            )}
            {(uploadStatus === "done" || uploadStatus === "error") && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false, items: [] }))}
              >
                Cerrar
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
    </div>
  );
}

// ─── Card unificada para todas las imágenes ────────────────────

function UnifiedImageCard({
  image,
  onZoom,
  onDelete,
  claimId,
  formatFileSize,
  OrigenBadge,
  queryClient,
}: {
  image: UnifiedImage;
  onZoom: () => void;
  onDelete: () => void;
  claimId: string;
  formatFileSize: (bytes?: number | null) => string;
  OrigenBadge: React.ComponentType<{ origen: UnifiedImage["origen"] }>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const isPending = image.aiStatus === "pending" || image.aiStatus === "processing";

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
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
            title="Abrir"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {image.canDelete && (
            <button
              onClick={() => {
                if (isPending) {
                  if (confirm("La IA está procesando esta imagen. ¿Eliminar de todos modos? Se cancelará el análisis.")) {
                    onDelete();
                  }
                } else {
                  if (confirm("¿Eliminar esta imagen?")) onDelete();
                }
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-red-500/80"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Badge de origen sobre la imagen */}
        <div className="absolute left-1.5 top-1.5">
          <OrigenBadge origen={image.origen} />
        </div>
        {/* Overlay termómetro de progreso IA */}
        {isPending && (
          <AiProgressOverlay
            aiStatus={image.aiStatus}
            aiProgress={image.aiProgress}
            table={image.table || "claim_images"}
            recordId={image.id}
            onCancel={() => {
              // Invalidar cache para que se refresque el estado
              queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
              queryClient.invalidateQueries({ queryKey: ["inspection-photos-by-claim", claimId] });
            }}
          />
        )}
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

        {/* ─── Acciones IA según estado ─── */}
        {/* pending → botón "Omitir" (sacar de la cola) */}
        {image.aiStatus === "pending" && (
          <div className="mt-auto pt-1">
            <button
              onClick={async () => {
                try {
                  await fetch("/api/ai/cancel", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ table: image.table || "claim_images", id: image.id }),
                  });
                  queryClient.invalidateQueries({ queryKey: ["claim-images", claimId] });
                  queryClient.invalidateQueries({ queryKey: ["inspection-photos-by-claim", claimId] });
                  toast.success("Análisis omitido");
                } catch {
                  toast.error("No se pudo omitir");
                }
              }}
              className="ai-card-skip-btn"
              title="Omitir análisis IA"
            >
              <Ban className="h-3 w-3" />
              <span>Omitir IA</span>
            </button>
          </div>
        )}

        {/* done → "Rehacer" + "Log" */}
        {image.aiSummary && image.aiStatus === "done" && image.table && (
          <div className="mt-auto flex items-center gap-1 pt-1">
            {/* Rehacer análisis */}
            <AiAnalysisButton
              table={image.table}
              id={image.id}
              fileName={image.fileName}
              hasSummary={true}
              queryKey={
                image.origen === "siniestro"
                  ? ["claim-images", claimId]
                  : ["inspection-photos-by-claim", claimId]
              }
            />
            {/* Log: popover con resumen + prompt colapsable */}
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    className="ai-card-log-btn"
                    title="Ver log del análisis"
                  >
                    <FileText className="h-3 w-3" />
                  </button>
                }
              />
              <PopoverContent side="top" align="start" className="ai-log-popover">
                {/* Header: código + modelos separados */}
                <div className="ai-log-header">
                  <span className="ai-log-code">{image.codigo}</span>
                </div>
                {image.aiModel && (
                  <div className="ai-log-models">
                    {image.aiModel.split("|").map((m, i) => {
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
                {/* Resumen — lo principal, primero y grande */}
                <div className="ai-log-section ai-log-section-summary">
                  <div className="ai-log-summary">{cleanMarkdown(image.aiSummary)}</div>
                </div>
                {/* Tooltip: ver prompt enviado */}
                {image.aiPromptSnapshot && (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button className="ai-log-prompt-trigger" title="Ver prompt enviado">
                          <ChevronDown className="h-2.5 w-2.5" />
                          <span>Prompt enviado</span>
                        </button>
                      }
                    />
                    <PopoverContent side="top" align="start" className="ai-prompt-tooltip">
                      <div className="ai-log-prompt">
                        {image.aiPromptSnapshot.system_prompt && (
                          <div className="ai-log-prompt-block">
                            <span className="ai-log-prompt-tag">system</span>
                            <pre className="ai-log-prompt-text">{image.aiPromptSnapshot.system_prompt}</pre>
                          </div>
                        )}
                        {image.aiPromptSnapshot.user_prompt && (
                          <div className="ai-log-prompt-block">
                            <span className="ai-log-prompt-tag">user</span>
                            <pre className="ai-log-prompt-text">{image.aiPromptSnapshot.user_prompt}</pre>
                          </div>
                        )}
                        {image.aiPromptSnapshot.refinement_prompt && (
                          <div className="ai-log-prompt-block">
                            <span className="ai-log-prompt-tag">refinement</span>
                            <pre className="ai-log-prompt-text">{image.aiPromptSnapshot.refinement_prompt}</pre>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* error → "Rehacer" solamente */}
        {image.aiStatus === "error" && image.table && (
          <div className="mt-auto pt-1">
            <AiAnalysisButton
              table={image.table}
              id={image.id}
              fileName={image.fileName}
              hasSummary={false}
              queryKey={
                image.origen === "siniestro"
                  ? ["claim-images", claimId]
                  : ["inspection-photos-by-claim", claimId]
              }
            />
          </div>
        )}

        {/* skipped → nada. Sin icono IA, sin botones. */}
      </div>
    </div>
  );
}
