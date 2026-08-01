"use client";

/**
 * Editor de croquis vectorial — orquestador (arquitectura definitiva).
 *
 * Une todas las piezas de la arquitectura definitiva:
 *  - Stage (canvas Fabric) — sketch-canvas-stage.tsx
 *  - Toolbar (7 acciones + más herramientas) — sketch-toolbar.tsx
 *  - Biblioteca (favoritos + buscador + acordeones) — sketch-blocks-palette.tsx
 *  - Panel de propiedades (doble clic) — sketch-properties-panel.tsx
 *  - Renderizador de entidades — entity-renderer.ts
 *  - Numeración automática — entity-numbering.ts
 *  - Snap del motor — sketch-snap.ts
 *  - Anotaciones (etiqueta/comentario) — sketch-annotations.ts
 *  - Export PNG + JSON — sketch-export.ts + sketch-json-export.ts
 *
 * Modos: select, draw, label, comment, line, rectangle, circle, polygon, eraser.
 * Los handlers de mouse leen modo/color desde refs para registrarse una sola vez.
 *
 * Ver PLAN_CANVAS_MIGRATION.md para la arquitectura completa.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { SketchCanvasStage } from "./sketch-canvas-stage";
import { SketchToolbar } from "./sketch-toolbar";
import type { SketchMode } from "./sketch-toolbar";
import { SketchLibrary } from "./sketch-blocks-palette";
import { SketchPropertiesPanel } from "./sketch-properties-panel";
import { createEntity, getEntityMeta, setEntityMeta, finalizeTempShape } from "./entity-renderer";
import { generateAutoName, renumberEntities } from "./entity-numbering";
import { snapToWall, updateAttachedEntities, calculateAlignGuides, applyAlignGuides } from "./sketch-snap";
import { createLabel, createComment } from "./sketch-annotations";
import { exportSketchToPng } from "./sketch-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { AnnotationColor, SketchEditorProps } from "./entity-types";

type ShapeMode = Extract<SketchMode, "line" | "rectangle" | "circle">;
const SHAPE_MODES: ShapeMode[] = ["line", "rectangle", "circle"];
function isShapeMode(m: SketchMode): m is ShapeMode {
  return SHAPE_MODES.includes(m as ShapeMode);
}

export function SketchEditor({
  onSave,
  onCancel,
  saving,
  initialImage,
  height,
  className,
  bienType,
}: SketchEditorProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [canvasInstance, setCanvasInstance] = useState<fabric.Canvas | null>(null);
  const [mode, setMode] = useState<SketchMode>("select");
  const [annotationColor, setAnnotationColor] = useState<AnnotationColor>("yellow");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canClear, setCanClear] = useState(false);
  const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number; mode: "label" | "comment" } | null>(null);
  const [pendingText, setPendingText] = useState("");

  // Refs espejo del estado para los handlers de mouse.
  const modeRef = useRef<SketchMode>(mode);
  const colorRef = useRef<AnnotationColor>(annotationColor);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { colorRef.current = annotationColor; }, [annotationColor]);

  // Stacks de undo/redo.
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

  const eventToCanvasPoint = useCallback((opt: { e: Event }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const e = opt.e as PointerEvent | MouseEvent;
    const rect = canvas.getElement().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleModeChange = useCallback((next: SketchMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tempShapeRef.current) {
      canvas.remove(tempShapeRef.current);
      tempShapeRef.current = null;
      shapeStartRef.current = null;
      canvas.renderAll();
    }
    setMode(next);
    canvas.isDrawingMode = next === "draw";
    // En select y eraser, selection=true para que Fabric detecte el target
    // al hacer clic (necesario para que opt.target no sea null en el borrador).
    canvas.selection = next === "select" || next === "eraser";
    canvas.defaultCursor = next === "select" ? "default" : next === "eraser" ? "not-allowed" : "crosshair";
    canvas.hoverCursor = next === "select" ? "move" : next === "eraser" ? "not-allowed" : "crosshair";
  }, []);

  /** Crea una figura temporal vacía en el punto inicial. */
  function createTempShape(m: ShapeMode, x: number, y: number): fabric.Object {
    const color = "#1f2937";
    switch (m) {
      case "line":
        return new fabric.Line([x, y, x, y], { stroke: color, strokeWidth: 3, strokeLineCap: "round" });
      case "rectangle":
        return new fabric.Rect({ left: x, top: y, width: 0, height: 0, fill: "transparent", stroke: color, strokeWidth: 2 });
      case "circle":
        return new fabric.Circle({ left: x, top: y, radius: 0, originX: "left", originY: "top", fill: "transparent", stroke: color, strokeWidth: 2 });
    }
  }

  /** Actualiza la figura temporal según el punto actual. */
  function updateTempShape(obj: fabric.Object, m: ShapeMode, start: { x: number; y: number }, current: { x: number; y: number }) {
    switch (m) {
      case "line": {
        const line = obj as fabric.Line;
        line.set({ x2: current.x, y2: current.y });
        break;
      }
      case "rectangle": {
        const rect = obj as fabric.Rect;
        rect.set({
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        });
        break;
      }
      case "circle": {
        const circle = obj as fabric.Circle;
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        circle.set({
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          radius: Math.sqrt(dx * dx + dy * dy) / 2,
        });
        break;
      }
    }
  }

  const handleCanvasMouseDown = useCallback((opt: { e: Event; target?: fabric.Object | null }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentMode = modeRef.current;

    if (currentMode === "eraser") {
      const target = opt.target;
      if (target) {
        const meta = getEntityMeta(target);
        canvas.remove(target);
        // Renumerar si era una entidad numerada.
        if (meta) renumberEntities(meta.catalogId, canvas, (obj, name) => {
          setEntityMeta(obj, { name });
          if (obj instanceof fabric.Group) {
            const textObj = obj.getObjects().find((o) => o.type === "text" || o.type === "textbox");
            if (textObj) {
              textObj.set({ text: name });
            }
          }
        });
      }
      return;
    }

    if (currentMode === "label" || currentMode === "comment") {
      const { x, y } = eventToCanvasPoint(opt);
      setPendingAnnotation({ x, y, mode: currentMode });
      setPendingText("");
      return;
    }

    if (isShapeMode(currentMode)) {
      const { x, y } = eventToCanvasPoint(opt);
      shapeStartRef.current = { x, y };
      const shape = createTempShape(currentMode, x, y);
      tempShapeRef.current = shape;
      canvas.add(shape);
    }
  }, [eventToCanvasPoint]);

  const handleCanvasMouseMove = useCallback((opt: { e: Event }) => {
    if (!shapeStartRef.current || !tempShapeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentMode = modeRef.current;
    if (!isShapeMode(currentMode)) return;
    const { x, y } = eventToCanvasPoint(opt);
    updateTempShape(tempShapeRef.current, currentMode, shapeStartRef.current, { x, y });
    canvas.requestRenderAll();
  }, [eventToCanvasPoint]);

  const handleCanvasMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!tempShapeRef.current || !canvas) return;
    tempShapeRef.current.setCoords();
    const obj = tempShapeRef.current;
    const currentMode = modeRef.current;
    const isLine = obj.type === "line";
    const tooSmall = isLine ? false : (obj.width ?? 0) < 3 && (obj.height ?? 0) < 3;
    if (tooSmall) {
      canvas.remove(obj);
    } else if (isShapeMode(currentMode)) {
      const finalObj = finalizeTempShape(obj, currentMode);
      if (finalObj !== obj) {
        canvas.remove(obj);
        canvas.add(finalObj);
      }
      canvas.setActiveObject(finalObj);
    }
    shapeStartRef.current = null;
    tempShapeRef.current = null;
    canvas.renderAll();
    pushHistory();
  }, [pushHistory]);

  /** Doble clic: abrir panel de propiedades. */
  const handleCanvasDoubleClick = useCallback((opt: { target?: fabric.Object | null }) => {
    const target = opt.target;
    if (!target) return;
    const meta = getEntityMeta(target);
    if (!meta) return;
    setSelectedObj(target);
    setShowProperties(true);
  }, []);

  /** Objeto modificado: aplicar snap si es puerta/ventana, guías si es cualquier objeto. */
  const handleObjectModified = useCallback((opt: { target?: fabric.Object | null }) => {
    const canvas = canvasRef.current;
    const target = opt.target;
    if (!canvas || !target) return;
    const meta = getEntityMeta(target);

    // Si es puerta o ventana, snap al muro más cercano.
    if (meta?.catalogId === "puerta" || meta?.catalogId === "ventana") {
      const result = snapToWall(canvas, target);
      if (result.attachedTo) {
        target.set({ left: result.left, top: result.top });
        target.setCoords();
        canvas.renderAll();
      }
    }

    // Si es muro, reubicar puertas/ventanas asociadas.
    if (meta?.catalogId === "muro") {
      updateAttachedEntities(canvas, target);
    }

    // Guías de alineación para cualquier objeto.
    const guides = calculateAlignGuides(canvas, target);
    applyAlignGuides(target, guides);
    canvas.renderAll();
  }, []);

  const handleReady = useCallback((canvas: fabric.Canvas | null) => {
    canvasRef.current = canvas;
    setCanvasInstance(canvas);
    if (!canvas) return;

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#1f2937";
    canvas.freeDrawingBrush.width = 3;

    // Cargar croquis previo como fondo bloqueado.
    if (initialImage) {
      const isCrossOrigin = new URL(initialImage, window.location.href).origin !== window.location.origin;
      const options = isCrossOrigin ? { crossOrigin: "anonymous" as const } : undefined;
      fabric.Image.fromURL(initialImage, options)
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

    // Listeners de historial (object:modified también dispara pushHistory).
    canvas.on("object:added", pushHistory);
    canvas.on("object:removed", pushHistory);
    canvas.on("path:created", pushHistory);

    // object:modified: snap + guías + historial.
    canvas.on("object:modified", (opt) => {
      handleObjectModified(opt);
      pushHistory();
    });

    // Listeners de interacción.
    canvas.on("mouse:down", handleCanvasMouseDown);
    canvas.on("mouse:move", handleCanvasMouseMove);
    canvas.on("mouse:up", handleCanvasMouseUp);
    canvas.on("mouse:dblclick", handleCanvasDoubleClick);

    updateButtons();
  }, [initialImage, pushHistory, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasDoubleClick, handleObjectModified, updateButtons]);

  // Listener de teclado: Delete/Backspace elimina el objeto seleccionado.
  // En modo draw no interfere con el dibujo. No intercepta inputs.
  useEffect(() => {
    if (!canvasInstance) return;
    const canvas = canvasInstance;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current === "draw") return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const active = canvas.getActiveObject();
      if (!active) return;
      e.preventDefault();
      const meta = getEntityMeta(active);
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      if (meta) renumberEntities(meta.catalogId, canvas, (obj, name) => {
        setEntityMeta(obj, { name });
        if (obj instanceof fabric.Group) {
          const textObj = obj.getObjects().find((o) => o.type === "text" || o.type === "textbox");
          if (textObj) textObj.set({ text: name });
        }
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasInstance]);

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

  /** Drop de entidad desde la biblioteca (drag & drop). */
  const handleDropEntity = useCallback((entityId: string, x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x: cx, y: cy } = clientToCanvas(x, y);
    const name = generateAutoName(entityId, canvas);
    const obj = createEntity(entityId, cx, cy, name);
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  }, [clientToCanvas]);

  /** Select de entidad desde el select móvil. */
  const handleSelectEntity = useCallback((entityId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getWidth() / 2 - 80;
    const cy = canvas.getHeight() / 2 - 60;
    const name = generateAutoName(entityId, canvas);
    const obj = createEntity(entityId, cx, cy, name);
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
    const entityId = e.dataTransfer.getData("text/sketch-entity");
    if (entityId) handleDropEntity(entityId, e.clientX, e.clientY);
  }, [handleDropEntity]);

  const handleConfirmAnnotation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pendingAnnotation || !pendingText.trim()) {
      setPendingAnnotation(null);
      setPendingText("");
      return;
    }
    const { x, y, mode } = pendingAnnotation;
    const obj = mode === "label"
      ? createLabel(x, y, pendingText.trim(), colorRef.current)
      : createComment(x, y, pendingText.trim(), colorRef.current);
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
    setPendingAnnotation(null);
    setPendingText("");
    handleModeChange("select");
  }, [pendingAnnotation, pendingText, handleModeChange]);

  const handleCloseAnnotation = useCallback(() => {
    setPendingAnnotation(null);
    setPendingText("");
    handleModeChange("select");
  }, [handleModeChange]);

  const handleCloseProperties = useCallback(() => {
    setShowProperties(false);
    setSelectedObj(null);
  }, []);

  return (
    <div
      className={`sketch-editor ${className ?? ""}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <SketchToolbar
        mode={mode}
        onModeChange={handleModeChange}
        annotationColor={annotationColor}
        onAnnotationColorChange={setAnnotationColor}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onSave={handleSave}
        onCancel={onCancel}
        canUndo={canUndo}
        canRedo={canRedo}
        canClear={canClear}
        saving={!!saving}
      />
      <div className="sketch-body">
        <SketchLibrary onSelectEntity={handleSelectEntity} bienType={bienType} />
        <SketchCanvasStage onReady={handleReady} fixedHeight={height} />
        {showProperties && (
          <SketchPropertiesPanel
            obj={selectedObj}
            canvas={canvasInstance}
            onClose={handleCloseProperties}
          />
        )}
      </div>

      <Dialog open={!!pendingAnnotation} dismissible={false} onOpenChange={(open: boolean) => { if (!open) handleCloseAnnotation(); }}>
        <DialogContent showCloseButton={false} className="gap-4 p-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingAnnotation?.mode === "label" ? "Texto de la etiqueta" : "Texto del comentario"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={pendingText}
            onChange={(e) => setPendingText(e.target.value)}
            placeholder="Escribe aquí..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && pendingText.trim()) {
                handleConfirmAnnotation();
              } else if (e.key === "Escape") {
                handleCloseAnnotation();
              }
            }}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleCloseAnnotation}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmAnnotation} disabled={!pendingText.trim()}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
