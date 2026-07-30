"use client";

/**
 * Editor de croquis vectorial — orquestador.
 *
 * Une el stage (canvas Fabric), la toolbar (modos/color/grosor/acciones) y la
 * paleta de bloques (drag & drop). Maneja:
 *  - Modos de interacción: select (mover/resize/rotar objetos) y draw (mano
 *    alzada con PencilBrush de Fabric).
 *  - Undo/redo a nivel de objetos (no de bitmap): stack de estados del canvas
 *    serializados como JSON string (liviano vs ImageData).
 *  - Carga de croquis previo como fondo bloqueado (compatibilidad hacia atrás).
 *  - Export a PNG base64 via sketch-export.ts (contrato del backend intacto).
 *
 * Respeta el contrato de props de DrawingCanvas para que los 2 consumidores
 * no cambien. El wrapper drawing-canvas.tsx delega en este componente.
 */

import { useCallback, useRef, useState } from "react";
import * as fabric from "fabric";
import { SketchCanvasStage } from "./sketch-canvas-stage";
import { SketchToolbar } from "./sketch-toolbar";
import { SketchBlocksPalette } from "./sketch-blocks-palette";
import { createBlock } from "./sketch-block-factory";
import { exportSketchToPng } from "./sketch-export";
import type { BlockId, SketchEditorProps, SketchMode } from "./sketch-types";

export function SketchEditor({
  onSave,
  saving,
  initialImage,
  height,
  className,
}: SketchEditorProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [mode, setMode] = useState<SketchMode>("select");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canClear, setCanClear] = useState(false);

  // Stacks de undo/redo. Cada snapshot es el JSON string del canvas.
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isApplyingHistoryRef = useRef(false);

  const updateButtons = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
    setCanClear(canvas.getObjects().length > 0 || !!canvas.backgroundImage);
  }, []);

  /** Empuja el estado actual al stack de undo y limpia el redo. */
  const pushHistory = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStackRef.current.push(JSON.stringify(canvas.toJSON()));
    redoStackRef.current = [];
    // Limitar el historial para no crecer indefinidamente.
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    updateButtons();
  }, [updateButtons]);

  /** Restaura un snapshot (JSON string) en el canvas. */
  const restore = useCallback(async (json: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isApplyingHistoryRef.current = true;
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    isApplyingHistoryRef.current = false;
    updateButtons();
  }, [updateButtons]);

  /** Cuando el stage notifica que el canvas está listo. */
  const handleReady = useCallback((canvas: fabric.Canvas | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;

    // Configurar PencilBrush para el modo draw.
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = lineWidth;

    // Cargar croquis previo como fondo bloqueado (compatibilidad hacia atrás).
    // Fabric v6: Image.fromURL devuelve una Promise.
    if (initialImage) {
      fabric.Image.fromURL(initialImage, { crossOrigin: "anonymous" })
        .then((img) => {
          img.set({
            selectable: false,
            evented: false,
            hoverCursor: "default",
          });
          // Escalar la imagen al ancho del canvas manteniendo proporción.
          const scale = canvas.getWidth() / (img.width || canvas.getWidth());
          img.scale(Math.min(scale, 1));
          canvas.backgroundImage = img;
          canvas.renderAll();
          pushHistory();
        })
        .catch(() => {
          // Si la imagen no carga (CORS, 404), seguir con canvas vacío.
          pushHistory();
        });
    } else {
      pushHistory();
    }

    // Listeners para mantener el historial tras modificaciones de objetos.
    canvas.on("object:added", pushHistory);
    canvas.on("object:removed", pushHistory);
    canvas.on("object:modified", pushHistory);
    canvas.on("path:created", pushHistory);

    updateButtons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImage]);

  /** Cambiar modo: select vs draw. */
  const handleModeChange = useCallback((next: SketchMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setMode(next);
    canvas.isDrawingMode = next === "draw";
    canvas.selection = next !== "draw";
  }, []);

  /** Actualizar color del pincel. */
  const handleColorChange = useCallback((c: string) => {
    setColor(c);
    const canvas = canvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = c;
    }
  }, []);

  /** Actualizar grosor del pincel. */
  const handleLineWidthChange = useCallback((w: number) => {
    setLineWidth(w);
    const canvas = canvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = w;
    }
  }, []);

  /** Deshacer. */
  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;
    const current = undoStackRef.current.pop();
    if (current) redoStackRef.current.push(current);
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (previous) restore(previous);
  }, [restore]);

  /** Rehacer. */
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(next);
    restore(next);
  }, [restore]);

  /** Limpiar: quita todos los objetos (mantiene el fondo cargado). */
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    pushHistory();
  }, [pushHistory]);

  /** Guardar: export PNG base64 y llamar onSave. */
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = exportSketchToPng(canvas);
    if (dataUrl) onSave(dataUrl);
  }, [onSave]);

  /**
   * Convierte coordenadas de pantalla (clientX/Y) a coordenadas del canvas
   * usando el bounding rect del elemento canvas. Evita construir un evento
   * sintético (getScenePoint espera un TPointerEvent real).
   */
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getElement().getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  /** Drop de un bloque arrastrado desde la paleta. */
  const handleDropBlock = useCallback((blockId: BlockId, x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x: cx, y: cy } = clientToCanvas(x, y);
    const obj = createBlock(blockId, cx, cy);
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  }, [clientToCanvas]);

  /** Select móvil: agregar bloque al centro del canvas. */
  const handleSelectBlock = useCallback((blockId: BlockId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getWidth() / 2 - 80;
    const cy = canvas.getHeight() / 2 - 60;
    const obj = createBlock(blockId, cx, cy);
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  }, []);

  /** Prevenir el comportamiento por defecto del drop. */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData("text/sketch-block") as BlockId;
    if (blockId) handleDropBlock(blockId, e.clientX, e.clientY);
  }, [handleDropBlock]);

  return (
    <div
      className={`sketch-editor ${className ?? ""}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <SketchToolbar
        mode={mode}
        onModeChange={handleModeChange}
        color={color}
        onColorChange={handleColorChange}
        lineWidth={lineWidth}
        onLineWidthChange={handleLineWidthChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
        canUndo={canUndo}
        canRedo={canRedo}
        canClear={canClear}
        saving={!!saving}
      />
      <div className="sketch-body">
        <SketchBlocksPalette onDropBlock={handleDropBlock} onSelectBlock={handleSelectBlock} />
        <SketchCanvasStage onReady={handleReady} fixedHeight={height} />
      </div>
    </div>
  );
}
