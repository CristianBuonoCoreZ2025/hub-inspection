"use client";

/**
 * Editor de croquis vectorial — orquestador.
 *
 * Une el stage (canvas Fabric), la toolbar (modos/color/grosor/acciones) y la
 * paleta de bloques (drag & drop). Maneja:
 *  - Modos: select, draw (mano alzada), line/rectangle/circle/triangle
 *    (drag-to-create), eraser (clic elimina objeto), text (clic coloca Textbox).
 *  - Undo/redo a nivel de objetos serializados como JSON string.
 *  - Carga de croquis previo como fondo bloqueado (compatibilidad hacia atrás).
 *  - Export a PNG base64 via sketch-export.ts (contrato del backend intacto).
 *
 * Los handlers de mouse leen el modo/color/grosor desde refs (no desde state)
 * para poder registrarse una sola vez en el canvas sin recrearse en cada
 * cambio de modo, evitando dependencias circulares con handleReady.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { SketchCanvasStage } from "./sketch-canvas-stage";
import { SketchToolbar } from "./sketch-toolbar";
import { SketchBlocksPalette } from "./sketch-blocks-palette";
import { createBlock } from "./sketch-block-factory";
import { createShape, updateShape } from "./sketch-shape-drawing";
import { exportSketchToPng } from "./sketch-export";
import type { BlockId, SketchEditorProps, SketchMode } from "./sketch-types";

type ShapeMode = Extract<SketchMode, "line" | "rectangle" | "circle" | "triangle">;
const SHAPE_MODES: ShapeMode[] = ["line", "rectangle", "circle", "triangle"];
function isShapeMode(m: SketchMode): m is ShapeMode {
  return SHAPE_MODES.includes(m as ShapeMode);
}

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

  // Refs espejo del estado para que los handlers de mouse (registrados una
  // sola vez) lean siempre el valor actual sin recrearse.
  const modeRef = useRef<SketchMode>(mode);
  const colorRef = useRef<string>(color);
  const lineWidthRef = useRef<number>(lineWidth);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);

  // Stacks de undo/redo (JSON string del canvas).
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isApplyingHistoryRef = useRef(false);

  // Estado del dibujo de figuras (drag-to-create).
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const tempShapeRef = useRef<fabric.Object | null>(null);

  const updateButtons = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
    setCanClear(canvas.getObjects().length > 0 || !!canvas.backgroundImage);
  }, []);

  const pushHistory = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStackRef.current.push(JSON.stringify(canvas.toJSON()));
    redoStackRef.current = [];
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    updateButtons();
  }, [updateButtons]);

  const restore = useCallback(async (json: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isApplyingHistoryRef.current = true;
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    isApplyingHistoryRef.current = false;
    updateButtons();
  }, [updateButtons]);

  /** Convierte un evento de Fabric a coordenadas del canvas. */
  const eventToCanvasPoint = useCallback((opt: { e: Event }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const e = opt.e as PointerEvent | MouseEvent;
    const rect = canvas.getElement().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  /** Cambiar modo: ajusta isDrawingMode y selection de Fabric. */
  const handleModeChange = useCallback((next: SketchMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Cancelar figura en curso si se cambia de modo a mitad de un trazo.
    if (tempShapeRef.current) {
      canvas.remove(tempShapeRef.current);
      tempShapeRef.current = null;
      shapeStartRef.current = null;
      canvas.renderAll();
    }
    setMode(next);
    canvas.isDrawingMode = next === "draw";
    canvas.selection = next === "select";
    canvas.defaultCursor = next === "select" ? "default" : "crosshair";
    canvas.hoverCursor = next === "select" ? "move" : "crosshair";
  }, []);

  /** mouse:down — inicio de figura, borrador o texto según el modo activo. */
  const handleCanvasMouseDown = useCallback((opt: { e: Event; target?: fabric.Object | null }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentMode = modeRef.current;

    if (currentMode === "eraser") {
      const target = opt.target;
      if (target) canvas.remove(target);
      return;
    }

    if (currentMode === "text") {
      const { x, y } = eventToCanvasPoint(opt);
      const textbox = new fabric.Textbox("Texto", {
        left: x,
        top: y,
        width: 120,
        fontSize: 16,
        fill: colorRef.current,
        fontFamily: "sans-serif",
      });
      canvas.add(textbox);
      canvas.setActiveObject(textbox);
      canvas.renderAll();
      // Volver a modo selección tras colocar el texto.
      handleModeChange("select");
      return;
    }

    if (isShapeMode(currentMode)) {
      const { x, y } = eventToCanvasPoint(opt);
      shapeStartRef.current = { x, y };
      const shape = createShape(currentMode, x, y, colorRef.current, lineWidthRef.current);
      tempShapeRef.current = shape;
      canvas.add(shape);
    }
  }, [eventToCanvasPoint, handleModeChange]);

  /** mouse:move — actualiza la figura temporal mientras se arrastra. */
  const handleCanvasMouseMove = useCallback((opt: { e: Event }) => {
    if (!shapeStartRef.current || !tempShapeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentMode = modeRef.current;
    if (!isShapeMode(currentMode)) return;
    const { x, y } = eventToCanvasPoint(opt);
    updateShape(tempShapeRef.current, currentMode, shapeStartRef.current, { x, y });
    canvas.requestRenderAll();
  }, [eventToCanvasPoint]);

  /** mouse:up — finaliza la figura temporal. */
  const handleCanvasMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!tempShapeRef.current || !canvas) return;
    tempShapeRef.current.setCoords();
    const obj = tempShapeRef.current;
    const isLine = obj.type === "line";
    const tooSmall = isLine
      ? false
      : (obj.width ?? 0) < 3 && (obj.height ?? 0) < 3;
    if (tooSmall) canvas.remove(obj);
    shapeStartRef.current = null;
    tempShapeRef.current = null;
    canvas.renderAll();
    pushHistory();
  }, [pushHistory]);

  /** Cuando el stage notifica que el canvas está listo. */
  const handleReady = useCallback((canvas: fabric.Canvas | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = colorRef.current;
    canvas.freeDrawingBrush.width = lineWidthRef.current;

    // Cargar croquis previo como fondo bloqueado (compatibilidad hacia atrás).
    if (initialImage) {
      fabric.Image.fromURL(initialImage, { crossOrigin: "anonymous" })
        .then((img) => {
          img.set({ selectable: false, evented: false, hoverCursor: "default" });
          const scale = canvas.getWidth() / (img.width || canvas.getWidth());
          img.scale(Math.min(scale, 1));
          canvas.backgroundImage = img;
          canvas.renderAll();
          pushHistory();
        })
        .catch(() => pushHistory());
    } else {
      pushHistory();
    }

    // Listeners de historial.
    canvas.on("object:added", pushHistory);
    canvas.on("object:removed", pushHistory);
    canvas.on("object:modified", pushHistory);
    canvas.on("path:created", pushHistory);

    // Listeners de dibujo de figuras / borrador / texto.
    canvas.on("mouse:down", handleCanvasMouseDown);
    canvas.on("mouse:move", handleCanvasMouseMove);
    canvas.on("mouse:up", handleCanvasMouseUp);

    updateButtons();
  }, [initialImage, pushHistory, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, updateButtons]);

  const handleColorChange = useCallback((c: string) => {
    setColor(c);
    const canvas = canvasRef.current;
    if (canvas?.freeDrawingBrush) canvas.freeDrawingBrush.color = c;
  }, []);

  const handleLineWidthChange = useCallback((w: number) => {
    setLineWidth(w);
    const canvas = canvasRef.current;
    if (canvas?.freeDrawingBrush) canvas.freeDrawingBrush.width = w;
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;
    const current = undoStackRef.current.pop();
    if (current) redoStackRef.current.push(current);
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (previous) restore(previous);
  }, [restore]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(next);
    restore(next);
  }, [restore]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    pushHistory();
  }, [pushHistory]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = exportSketchToPng(canvas);
    if (dataUrl) onSave(dataUrl);
  }, [onSave]);

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getElement().getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

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
        <SketchBlocksPalette onSelectBlock={handleSelectBlock} />
        <SketchCanvasStage onReady={handleReady} fixedHeight={height} />
      </div>
    </div>
  );
}
