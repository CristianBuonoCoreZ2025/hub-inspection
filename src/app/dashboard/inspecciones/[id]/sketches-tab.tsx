"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDamageSketches,
  createDamageSketch,
  updateDamageSketch,
  deleteDamageSketch,
} from "@/services/inspections";
import { uploadFileToStorage } from "@/lib/nhost/storage-upload";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SketchesTab({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sketches, isLoading } = useQuery({
    queryKey: ["damage-sketches", sessionId],
    queryFn: () => getDamageSketches(sessionId),
  });

  const createMutation = useMutation({
    mutationFn: createDamageSketch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damage-sketches", sessionId] });
      toast.success("Croquis subido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      updateDamageSketch(id, { label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damage-sketches", sessionId] });
      setEditingId(null);
      toast.success("Croquis actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDamageSketch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damage-sketches", sessionId] });
      toast.success("Croquis eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const path = `sketches/${sessionId}/${Date.now()}_${file.name}`;
      const url = await uploadFileToStorage(file, path);
      createMutation.mutate({
        session_id: sessionId,
        sketch_url: url,
        label: file.name,
      });
    } catch (err) {
      toast.error("Error al subir archivo");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files || []).forEach(handleFile);
  }

  function startEdit(sketch: { id: string; label: string | null }) {
    setEditingId(sketch.id);
    setEditingLabel(sketch.label || "");
  }

  function saveEdit(id: string) {
    if (editingLabel.trim()) {
      updateMutation.mutate({ id, label: editingLabel.trim() });
    } else {
      setEditingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="app-panel">
        <p className="text-sm text-muted-foreground">Cargando croquis...</p>
      </div>
    );
  }

  return (
    <div className="app-stack">
      {/* Upload zone */}
      <div
        className="app-panel flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-border py-8 transition-colors hover:border-primary/50"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInput}
          multiple
        />
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {uploading ? "Subiendo..." : "Haz clic o arrastra imágenes para subir croquis"}
        </p>
      </div>

      {/* Grid */}
      {sketches && sketches.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sketches.map((sketch) => (
            <div key={sketch.id} className="app-panel space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <img
                  src={sketch.sketch_url}
                  alt={sketch.label || "Croquis"}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center gap-2">
                {editingId === sketch.id ? (
                  <>
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="app-input h-7 flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(sketch.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => saveEdit(sketch.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-medium">
                      {sketch.label || "Sin título"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(sketch)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500"
                      onClick={() => {
                        if (confirm("¿Eliminar este croquis?")) {
                          deleteMutation.mutate(sketch.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="app-panel text-center py-8">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No hay croquis subidos aún.
          </p>
        </div>
      )}
    </div>
  );
}
