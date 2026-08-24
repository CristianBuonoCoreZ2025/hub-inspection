"use client";

/**
 * DrawingCanvas — wrapper delgado del editor de croquis vectorial.
 *
 * Mantiene el MISMO contrato de props que el canvas raster original para que
 * los 2 consumidores (sketches-tab.tsx y inspection/[token]/page.tsx) no
 * requieran cambios:
 *   onSave(dataUrl: string)   → PNG base64
 *   saving?, initialImage?, width?, height?, className?
 *
 * Internamente delega en SketchEditor (Fabric.js v6). El código raster viejo
 * (353 líneas de HTML5 Canvas puro) se eliminó para no acumular código muerto
 * (REGLA de Cero Redundancia).
 *
 * Nota: la prop `width` del contrato original ya no aplica (el stage es
 * responsivo al 100% del contenedor vía ResizeObserver). Se acepta para
 * preservar la firma pero se ignora.
 */

import { SketchEditor } from "@/features/inspection-sketch/sketch-editor";

interface DrawingCanvasProps {
  onSave: (dataUrl: string, sketchData: Record<string, unknown>) => void;
  /** Se llama al cancelar. Si se pasa, muestra botón Cancelar junto a Guardar. */
  onCancel?: () => void;
  saving?: boolean;
  initialImage?: string;
  initialSketchData?: Record<string, unknown> | null;
  /** Aceptado por compatibilidad; el stage es responsivo al contenedor. */
  width?: number;
  height?: number;
  className?: string;
}

export function DrawingCanvas({
  onSave,
  onCancel,
  saving,
  initialImage,
  initialSketchData,
  height,
  className,
}: DrawingCanvasProps) {
  return (
    <SketchEditor
      onSave={({ dataUrl, sketchData }) => onSave(dataUrl, sketchData)}
      onCancel={onCancel}
      saving={saving}
      initialImage={initialImage}
      initialSketchData={initialSketchData}
      height={height}
      className={className}
    />
  );
}
