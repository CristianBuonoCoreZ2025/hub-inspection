"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type Tool = "pencil" | "line" | "rectangle" | "circle" | "triangle" | "eraser";

interface Point { x: number; y: number; }

interface DrawingCanvasProps {
  onSave: (dataUrl: string) => void;
  saving?: boolean;
  initialImage?: string;
  width?: number;
  height?: number;
  className?: string;
}

const COLORS = [
  "#000000", "#ef4444", "#3b82f6", "#22c55e",
  "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280",
];

const TOOL_LABELS: Record<Tool, string> = {
  pencil: "Mano Alzada",
  line: "Línea Recta",
  rectangle: "Rectángulo",
  circle: "Círculo",
  triangle: "Triángulo",
  eraser: "Borrar",
};

export function DrawingCanvas({
  onSave,
  saving,
  initialImage,
  width = 800,
  height = 500,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, data]);
  }, []);

  // Canvas setup with proper resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width || width;
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Load initial image if provided
    if (initialImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        saveHistory();
      };
      img.src = initialImage;
    } else {
      saveHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImage]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      const lastState = newHistory[newHistory.length - 1];
      if (lastState) {
        ctx.putImageData(lastState, 0, 0);
      }
      return newHistory;
    });
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHistory([]);
    saveHistory();
  }, [saveHistory]);

  const getPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(e);
    startPoint.current = point;
    lastPoint.current = point;
    setIsDrawing(true);

    // Snapshot for shape preview
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === "pencil" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineWidth = tool === "eraser" ? 20 : lineWidth;
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineTo(point.x + 0.1, point.y + 0.1);
      ctx.stroke();
    }
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(e);
    const start = startPoint.current;
    if (!start) return;

    if (tool === "pencil" || tool === "eraser") {
      // Freehand drawing
      const last = lastPoint.current;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineWidth = tool === "eraser" ? 20 : lineWidth;
        ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      lastPoint.current = point;
    } else {
      // Shape preview: restore snapshot then draw shape
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();

      switch (tool) {
        case "line":
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
          break;
        case "rectangle":
          ctx.rect(start.x, start.y, point.x - start.x, point.y - start.y);
          ctx.stroke();
          break;
        case "circle": {
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case "triangle":
          ctx.moveTo(start.x, point.y);
          ctx.lineTo(point.x, point.y);
          ctx.lineTo((start.x + point.x) / 2, start.y);
          ctx.closePath();
          ctx.stroke();
          break;
      }
    }
  };

  const stop = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    startPoint.current = null;
    lastPoint.current = null;
    snapshotRef.current = null;
    saveHistory();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  const tools: Tool[] = ["pencil", "line", "rectangle", "circle", "triangle", "eraser"];

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2 p-2 rounded-lg border border-border bg-card">
        {/* Tools */}
        <div className="flex flex-wrap gap-1">
          {tools.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                tool === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              title={TOOL_LABELS[t]}
            >
              {TOOL_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        {/* Colors */}
        <div className="flex flex-wrap gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setTool(tool === "eraser" ? "pencil" : tool); }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? "border-primary scale-110" : "border-border"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        {/* Line width */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Grosor</span>
          <input
            type="range"
            min={1}
            max={12}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 h-1.5"
          />
          <span className="text-[11px] text-muted-foreground w-4">{lineWidth}</span>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        {/* Actions */}
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={undo}
            disabled={history.length <= 1}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={clear}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground hover:bg-muted"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="rounded-lg border border-border bg-white overflow-hidden w-full">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none"
          style={{ height }}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
    </div>
  );
}
