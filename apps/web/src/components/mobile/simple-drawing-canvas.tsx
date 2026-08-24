"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Eraser, Trash2, Undo, Check, X } from "lucide-react";

interface SimpleDrawingCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  saving?: boolean;
  initialImage?: string;
  className?: string;
}

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
  isEraser?: boolean;
}

const COLORS = [
  { name: "black", value: "#1a1a1a" },
  { name: "red", value: "#ef4444" },
  { name: "blue", value: "#3b82f6" },
  { name: "green", value: "#22c55e" },
  { name: "amber", value: "#f59e0b" },
  { name: "violet", value: "#8b5cf6" },
];

const PEN_WIDTH = 3;
const ERASER_WIDTH = 20;

/**
 * Canvas de dibujo simple para mobile.
 * No usa Fabric.js — solo HTML5 Canvas con touch/mouse.
 * Soporta: pluma, borrador, colores, deshacer, limpiar.
 */
export function SimpleDrawingCanvas({
  onSave,
  onCancel,
  saving,
  initialImage,
  className,
}: SimpleDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [isEraser, setIsEraser] = useState(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Mantener refs sincronizadas
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { currentStrokeRef.current = currentStroke; }, [currentStroke]);

  const drawAllStrokes = (ctx: CanvasRenderingContext2D, allStrokes: Stroke[]) => {
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.isEraser ? ERASER_WIDTH : stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    const all = [...strokesRef.current];
    if (currentStrokeRef.current) all.push(currentStrokeRef.current);
    drawAllStrokes(ctx, all);
  }, []);

  // Setup canvas con device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const setupCanvas = () => {
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      redraw();
    };

    setupCanvas();
    const ro = new ResizeObserver(setupCanvas);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redraw]);

  // Cargar imagen inicial si existe
  useEffect(() => {
    if (!initialImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = initialImage;
  }, [initialImage]);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = getPos(e);
    const newStroke: Stroke = {
      color,
      width: PEN_WIDTH,
      points: [pos],
      isEraser,
    };
    setCurrentStroke(newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!currentStroke) return;
    e.preventDefault();
    const pos = getPos(e);
    const updated = {
      ...currentStroke,
      points: [...currentStroke.points, pos],
    };
    setCurrentStroke(updated);
  };

  const handlePointerUp = () => {
    if (!currentStroke) return;
    setStrokes([...strokes, currentStroke]);
    setCurrentStroke(null);
  };

  // Redibujar cuando cambian los strokes
  useEffect(() => {
    redraw();
  }, [strokes, currentStroke, redraw]);

  const handleUndo = () => {
    setStrokes(strokes.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className={`simple-drawing-canvas ${className || ""}`}>
      {/* Toolbar superior */}
      <div className="simple-drawing-toolbar">
        <div className="simple-drawing-colors">
          {COLORS.map((c) => (
            <button
              key={c.name}
              className={`simple-drawing-color ${color === c.value && !isEraser ? "active" : ""}`}
              style={{ background: c.value }}
              onClick={() => {
                setColor(c.value);
                setIsEraser(false);
              }}
              aria-label={c.name}
            />
          ))}
        </div>
        <div className="simple-drawing-tools">
          <button
            className={`simple-drawing-tool ${isEraser ? "active" : ""}`}
            onClick={() => setIsEraser(true)}
            aria-label="Borrador"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            className={`simple-drawing-tool ${!isEraser ? "active" : ""}`}
            onClick={() => setIsEraser(false)}
            aria-label="Pluma"
          >
            <Pen className="h-4 w-4" />
          </button>
          <button
            className="simple-drawing-tool"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            aria-label="Deshacer"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            className="simple-drawing-tool"
            onClick={handleClear}
            disabled={strokes.length === 0}
            aria-label="Limpiar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="simple-drawing-stage">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="simple-drawing-canvas-element"
        />
      </div>

      {/* Botones guardar/cancelar */}
      <div className="simple-drawing-actions">
        {onCancel && (
          <button
            className="mobile-btn mobile-btn-outline"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
        )}
        <button
          className="mobile-btn mobile-btn-success"
          onClick={handleSave}
          disabled={saving}
        >
          <Check className="h-4 w-4" /> Guardar
        </button>
      </div>
    </div>
  );
}
