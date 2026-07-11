"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createEvidence, deleteEvidence } from "@/services/inspections";
import { uploadFileToStorage } from "@/lib/supabase/storage-upload";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Trae evidencias con presigned URLs desde la API route server-side
async function fetchEvidences(sessionId: string) {
  const res = await fetch(`/api/inspection/evidences/${sessionId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar evidencias");
  const data = (await res.json()) as { evidences: any[] };
  return data.evidences;
}

export default function EvidencesTab({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: evidences, isLoading } = useQuery({
    queryKey: ["evidences", sessionId],
    queryFn: () => fetchEvidences(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createEvidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      toast.success("Evidencia subida");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
      toast.success("Evidencia eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const path = `evidences/${sessionId}/${Date.now()}_${file.name}`;
        const url = await uploadFileToStorage(file, path);
        const type: "photo" | "video" | "document" =
          file.type.startsWith("image/") ? "photo" :
          file.type.startsWith("video/") ? "video" : "document";
        createMutation.mutate({
          session_id: sessionId,
          type,
          url,
          description: file.name,
        });
      } catch (err) {
        toast.error("Error al subir archivo");
        console.error(err);
      } finally {
        setUploading(false);
      }
    },
    [sessionId, createMutation]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(handleFile);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(handleFile);
  };

  const photos = evidences?.filter((e) => e.type === "photo") || [];
  const videos = evidences?.filter((e) => e.type === "video") || [];
  const documents = evidences?.filter((e) => e.type === "document") || [];

  const renderGrid = (items: typeof evidences, typeLabel: string, icon: React.ReactNode) => {
    if (!items?.length) return null;
    return (
      <div className="app-panel">
        <h3 className="app-section-title">
          {icon} {typeLabel} ({items?.length || 0})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items?.map((ev) => (
            <div key={ev.id} className="group relative rounded-lg border overflow-hidden bg-muted/20">
              {ev.type === "photo" ? (
                <img src={ev.url} alt={ev.description || ""} className="aspect-square w-full object-cover" />
              ) : ev.type === "video" ? (
                <video src={ev.url} className="aspect-square w-full object-cover" controls />
              ) : (
                <div className="aspect-square w-full flex items-center justify-center bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="btn-danger btn-icon text-white hover:text-white hover:bg-red-500/80"
                  onClick={() => { if (confirm("¿Eliminar esta evidencia?")) deleteMutation.mutate(ev.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {ev.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-[11px] text-white truncate">{ev.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app-stack">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Arrastra fotos, videos o documentos aquí</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, MP4, PDF</p>
        <input type="file" multiple accept="image/*,video/*,.pdf" onChange={handleInput} className="hidden" id="evidence-upload" />
        <label htmlFor="evidence-upload" className="mt-3 inline-flex cursor-pointer">
          <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-[13px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            <Upload className="mr-2 h-3.5 w-3.5" /> Seleccionar archivos
          </span>
        </label>
        {uploading && <p className="mt-2 text-xs text-muted-foreground">Subiendo...</p>}
      </div>

      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando evidencias...</div>
      ) : (
        <>
          {renderGrid(photos, "Fotos", <ImageIcon className="h-4 w-4" />)}
          {renderGrid(videos, "Videos", <Video className="h-4 w-4" />)}
          {renderGrid(documents, "Documentos", <FileText className="h-4 w-4" />)}
          {evidences?.length === 0 && (
            <div className="app-panel text-center py-8 text-muted-foreground text-sm">
              No hay evidencias aún. Sube fotos, videos o documentos arriba.
            </div>
          )}
        </>
      )}
    </div>
  );
}
