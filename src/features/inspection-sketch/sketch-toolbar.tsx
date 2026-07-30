"use client";

/**
 * Barra de herramientas del editor de croquis.
 *
 * Botones de modo (Seleccionar / Mano alzada / Línea / Rectángulo / Círculo /
 * Triángulo / Borrador / Texto) usan .sketch-mode-btn (toggles compactos
 * temáticos). La acción principal "Guardar" usa pg-btn-platinum (botón
 * primario del sistema, ver DESIGN_SYSTEM.md). Color y grosor usan
 * .app-input para respetar el sistema de formularios.
 *
 * Cero inline styles (REGLA #2): toda la estilización vive en
 * sketch-editor.css. Iconos de lucide-react, sin emojis.
 */

import {
  MousePointer2, Pencil, Slash, Square, Circle, Triangle,
  Eraser, Type, Undo2, Redo2, Save,
} from "lucide-react";
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

/** Definición de cada botón de modo (icono + label + title). */
const MODE_BUTTONS: { mode: SketchMode; icon: typeof Pencil; title: string }[] = [
  { mode: "select", icon: MousePointer2, title: "Seleccionar y mover" },
  { mode: "draw", icon: Pencil, title: "Dibujar a mano alzada" },
  { mode: "line", icon: Slash, title: "Línea recta" },
  { mode: "rectangle", icon: Square, title: "Rectángulo" },
  { mode: "circle", icon: Circle, title: "Círculo" },
  { mode: "triangle", icon: Triangle, title: "Triángulo" },
  { mode: "eraser", icon: Eraser, title: "Borrar objeto" },
  { mode: "text", icon: Type, title: "Texto" },
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
      {/* Herramientas de interacción / dibujo */}
      <div className="sketch-toolbar-group">
        {MODE_BUTTONS.map(({ mode: m, icon: Icon, title }) => (
          <button
            key={m}
            type="button"
            className={`sketch-mode-btn ${mode === m ? "is-active" : ""}`}
            onClick={() => onModeChange(m)}
            title={title}
            aria-label={title}
            aria-pressed={mode === m}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
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
              // Excepción REGLA #2: color dinámico del catálogo.
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
          aria-label="Deshacer"
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rehacer"
          aria-label="Rehacer"
        >
          <Redo2 className="size-3.5" />
        </button>
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onClear}
          disabled={!canClear}
          title="Limpiar"
          aria-label="Limpiar"
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
