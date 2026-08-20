"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDamageSketches,
  updateDamageSketch,
  deleteDamageSketch,
} from "@/services/inspections";
import { SimpleDrawingCanvas } from "@/components/mobile/simple-drawing-canvas";
import { toast } from "sonner";
import { Trash2, ImageIcon, Pencil, Check, X, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";

interface MobileSketchesTabProps {
  sessionId: string;
  sessionStatus?: string;
  magicLinkToken?: string;
  /** Modo offline: guardar en IndexedDB */
  offlineMode?: boolean;
  onOfflineSaved?: () => void;
}

export default function MobileSketchesTab({
  sessionId,
  sessionStatus,
  magicLinkToken,
  offlineMode = false,
  onOfflineSaved,
}: MobileSketchesTabProps) {
  const queryClient = useQueryClient();
  const confirmDelete = useConfirm();
  const [mode, setMode] = useState<"view" | "draw">("view");
  const [editingSketch, setEditingSketch] = useState<{ id: string; url: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

  const { data: sketches, isLoading } = useQuery({
    queryKey: ["damage-sketches", sessionId],
    queryFn: () => getDamageSketches(sessionId),
    enabled: !!sessionId && !offlineMode,
  });

  const syncSketches = () => {
    queryClient.invalidateQueries({ queryKey: ["damage-sketches", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    if (magicLinkToken) queryClient.invalidateQueries({ queryKey: ["magic-link-live", magicLinkToken] });
  };

  const handleSaveNew = async (dataUrl: string) => {
    setSaving(true);
    try {
      if (offlineMode) {
        // Guardar en IndexedDB
        const { addPendingSketch } = await import("@/lib/offline/sync-session");
        const blob = await (await fetch(dataUrl)).blob();
        await addPendingSketch(sessionId, {
          localId: `sketch-${Date.now()}`,
          blob,
          label: null,
        });
        onOfflineSaved?.();
        toast.success("Croquis guardado offline");
      } else {
        // Subir al servidor
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append("file", blob, `sketch-${Date.now()}.png`);
        formData.append("sessionId", sessionId);

        const res = await fetch("/api/inspection/sketch/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Error al subir croquis");
        syncSketches();
        toast.success("Croquis guardado");
      }
      setMode("view");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDelete({
      title: "Eliminar croquis",
      description: "¿Eliminar este croquis?",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDamageSketch(id);
      syncSketches();
      toast.success("Croquis eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (readOnly && mode === "view") {
    // Solo lectura
  }

  if (mode === "draw") {
    return (
      <div className="space-y-3">
        <SimpleDrawingCanvas
          onSave={handleSaveNew}
          onCancel={() => {
            setMode("view");
            setEditingSketch(null);
          }}
          saving={saving}
          initialImage={editingSketch?.url}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Botón nuevo croquis */}
      {!readOnly && (
        <button
          className="mobile-btn mobile-btn-primary w-full"
          onClick={() => {
            setEditingSketch(null);
            setMode("draw");
          }}
        >
          <PenTool className="h-4 w-4" /> Dibujar
        </button>
      )}

      {/* Lista de croquis */}
      {isLoading ? (
        <div className="mobile-empty">
          <p className="mobile-empty-text">Cargando croquis...</p>
        </div>
      ) : !sketches || sketches.length === 0 ? (
        <div className="mobile-empty">
          <ImageIcon className="h-10 w-10 mobile-empty-icon" />
          <p className="mobile-empty-text">No hay croquis</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sketches.map((sketch) => (
            <div key={sketch.id} className="mobile-sketch-card">
              <img
                src={sketch.sketch_url}
                alt={sketch.label || "Croquis"}
                className="mobile-sketch-image"
              />
              {sketch.label && (
                <p className="mobile-sketch-label">{sketch.label}</p>
              )}
              {!readOnly && (
                <div className="mobile-sketch-actions">
                  <button
                    className="mobile-sketch-action-btn"
                    onClick={() => {
                      setEditingSketch({ id: sketch.id, url: sketch.sketch_url, label: sketch.label || "" });
                      setMode("draw");
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="mobile-sketch-action-btn danger"
                    onClick={() => handleDelete(sketch.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
