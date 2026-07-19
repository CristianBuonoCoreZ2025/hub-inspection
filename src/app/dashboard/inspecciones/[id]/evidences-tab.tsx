"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEvidence } from "@/services/inspections";
import { toast } from "sonner";
import {
  Upload, Trash2, ImageIcon, Video, FileText, ExternalLink,
  MapPin, Clock, User, Camera, Lock, X, ZoomIn, Sparkles,
} from "lucide-react";

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
  aiSummary?: string;
  aiModel?: string;
  pdfSummary?: string;
  pdfPageCount?: number;
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
  uploader: EvidenceUploader | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function fetchEvidences(sessionId: string): Promise<Evidence[]> {
  const res = await fetch(`/api/inspection/evidences/session/${sessionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar evidencias");
  const data = (await res.json()) as { evidences: Evidence[] };
  return data.evidences;
}

/** Intenta obtener la geolocalización del navegador (con permiso del usuario). */
function getGeoLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // Si falla o se rechaza, subir sin geo
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
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
  const [uploadingCount, setUploadingCount] = useState(0);
  const [geoActive, setGeoActive] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const geoRef = useRef<{ lat: number; lng: number } | null>(null);
  const geoRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

  // Pedir geolocalización al montar (una sola vez, solo si se puede subir)
  useEffect(() => {
    if (geoRequestedRef.current || readOnly) return;
    geoRequestedRef.current = true;
    getGeoLocation().then((g) => {
      if (g) {
        geoRef.current = g;
        setGeoActive(true);
        toast.success("Ubicación capturada para evidencias", { duration: 2000 });
      }
    });
  }, [readOnly]);

  const { data: evidences, isLoading } = useQuery({
    queryKey: ["evidences", sessionId],
    queryFn: () => fetchEvidences(sessionId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);
      formData.append("originalName", file.name);
      if (geoRef.current) {
        formData.append("lat", String(geoRef.current.lat));
        formData.append("lng", String(geoRef.current.lng));
      }
      const res = await fetch("/api/inspection/evidences/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al subir evidencia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      toast.success("Evidencia subida");
    },
    onError: (err: Error) => toast.error(err.message),
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

  const handleFile = useCallback(
    async (file: File) => {
      setUploadingCount((c) => c + 1);
      try {
        await uploadMutation.mutateAsync(file);
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    },
    [uploadMutation]
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
        {uploadingCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            Subiendo {uploadingCount}...
          </div>
        )}
        {geoActive && (
          <div className="hidden items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 sm:flex">
            <MapPin className="h-3 w-3" />
            Geo activa
          </div>
        )}
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
    </div>
  );
}

// ─── Sección por tipo ────────────────────────────────────────────

function EvidenceSection({
  title, count, icon, items, onDelete, readOnly, onImageClick,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  items: Evidence[];
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
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
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card individual (miniatura) ─────────────────────────────────

function EvidenceCard({ evidence, onDelete, readOnly, onImageClick }: {
  evidence: Evidence;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  onImageClick?: (url: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isDoc = evidence.type === "pdf" || evidence.type === "document";
  const isVideo = evidence.type === "video";
  const isPhoto = evidence.type === "photo";

  const meta = evidence.metadata;
  const uploaderName = evidence.uploader?.full_name || evidence.uploader?.email || null;
  const dateStr = formatDate(evidence.captured_at || evidence.created_at);
  const sizeStr = formatSize(meta?.fileSize);
  const hasDeviceGeo = evidence.lat != null && evidence.lng != null;
  const hasExifGeo = evidence.exif_lat != null && evidence.exif_lng != null;

  // Detectar discrepancia entre ubicación del dispositivo y EXIF de la foto
  // Si la diferencia es > 1km (~0.01 grados), marcar como sospechosa
  let geoMismatch = false;
  if (hasDeviceGeo && hasExifGeo) {
    const dLat = Math.abs(evidence.lat! - evidence.exif_lat!);
    const dLng = Math.abs(evidence.lng! - evidence.exif_lng!);
    geoMismatch = dLat > 0.01 || dLng > 0.01; // ~1km
  }

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
          {/* Indicadores de ubicación: dispositivo + EXIF de la foto */}
          <div className="flex items-center gap-1">
            {hasDeviceGeo && (
              <span
                className="flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400"
                title={`Ubicación del dispositivo: ${evidence.lat?.toFixed(6)}, ${evidence.lng?.toFixed(6)}`}
              >
                <MapPin className="h-2.5 w-2.5" />
              </span>
            )}
            {hasExifGeo && (
              <span
                className={`flex items-center gap-0.5 text-[9px] ${
                  geoMismatch
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}
                title={`Ubicación de la foto (EXIF): ${evidence.exif_lat?.toFixed(6)}, ${evidence.exif_lng?.toFixed(6)}${geoMismatch ? " — DIFIERE del dispositivo" : ""}`}
              >
                <Camera className="h-2.5 w-2.5" />
              </span>
            )}
            {geoMismatch && (
              <span
                className="text-[8px] font-bold text-amber-600 dark:text-amber-400"
                title="La ubicación de la foto no coincide con la del dispositivo"
              >
                ⚠
              </span>
            )}
          </div>
        </div>

        {/* Resumen IA */}
        {meta?.aiSummary && (
          <div className="flex items-start gap-1 text-[9px] text-violet-600 dark:text-violet-400 pt-1">
            <Sparkles className="h-2.5 w-2.5 shrink-0 mt-0.5" />
            <span className="italic line-clamp-2">{meta.aiSummary}</span>
          </div>
        )}
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
