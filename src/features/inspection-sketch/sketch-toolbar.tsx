"use client";

/**
 * Barra de herramientas del editor de croquis.
 *
 * Botones de modo (Seleccionar / Mano) usan .sketch-mode-btn (toggles
 * compactos temáticos). La acción principal "Guardar" usa pg-btn-platinum
 * (botón primario del sistema, ver DESIGN_SYSTEM.md). Color y grosor usan
 * .app-input para respetar el sistema de formularios.
 *
 * Cero inline styles (REGLA #2): toda la estilización vive en
 * sketch-editor.css. Iconos de lucide-react, sin emojis.
 */

import { MousePointer2, Hand, Undo2, Redo2, Eraser, Save } from "lucide-react";
import type { SketchMode } from "./sketch-types";

interface SketchToolbarProps {
  mode: SketchMode;
  onModeChange: (mode: SketchMode) => void;
  color: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  saving: boolean;
}

const COLORS = [
  "#000000", "#ef4444", "#3b82f6", "#22c55e",
  "#f59e0b", "#8b5cf6", "#ec4899", "#6b7280",
];

export function SketchToolbar({
  mode,
  onModeChange,
  color,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  onUndo,
  onRedo,
  onClear,
  onSave,
  canUndo,
  canRedo,
  canClear,
  saving,
}: SketchToolbarProps) {
  return (
    <div className="sketch-toolbar">
      {/* Modos de interacción */}
      <div className="sketch-toolbar-group">
        <button
          type="button"
          className={`sketch-mode-btn ${mode === "select" ? "is-active" : ""}`}
          onClick={() => onModeChange("select")}
          title="Seleccionar y mover"
        >
          <MousePointer2 className="size-3.5" />
        </button>
        <button
          type="button"
          className={`sketch-mode-btn ${mode === "draw" ? "is-active" : ""}`}
          onClick={() => onModeChange("draw")}
          title="Dibujar a mano alzada"
        >
          <Hand className="size-3.5" />
        </button>
      </div>

      <div className="sketch-toolbar-divider" />

      {/* Colores */}
      <div className="sketch-toolbar-group">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`sketch-mode-btn ${color === c ? "is-active" : ""}`}
            onClick={() => onColorChange(c)}
            title={c}
            aria-label={`Color ${c}`}
          >
            <span
              className="sketch-block-swatch"
              // Excepción REGLA #2: color dinámico del catálogo, no existe
              // como clase porque son 8 valores arbitrarios del usuario.
              style={{ backgroundColor: c }}
            />
          </button>
        ))}
        <input
          type="color"
          className="sketch-color-input"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          title="Color personalizado"
          aria-label="Color personalizado"
        />
      </div>

      <div className="sketch-toolbar-divider" />

      {/* Grosor */}
      <div className="sketch-toolbar-group">
        <span className="sketch-range-label">Grosor</span>
        <input
          type="range"
          min={1}
          max={12}
          value={lineWidth}
          onChange={(e) => onLineWidthChange(Number(e.target.value))}
          className="sketch-range-input"
          aria-label="Grosor de línea"
        />
        <span className="sketch-range-label">{lineWidth}</span>
      </div>

      <div className="sketch-toolbar-divider" />

      {/* Acciones de historial */}
      <div className="sketch-toolbar-group">
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Deshacer"
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rehacer"
        >
          <Redo2 className="size-3.5" />
        </button>
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onClear}
          disabled={!canClear}
          title="Limpiar"
        >
          <Eraser className="size-3.5" />
        </button>
      </div>

      {/* Acción principal */}
      <div className="sketch-toolbar-group sketch-toolbar-spacer">
        <button
          type="button"
          className="pg-btn-platinum"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="size-3.5" />
          {saving ? "Guardando" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
