"use client";

/**
 * Barra superior del editor de croquis — arquitectura definitiva.
 *
 * Simplificada a 7 acciones principales + sección "Más herramientas"
 * desplegable con figuras geométricas básicas (línea, rectángulo, círculo,
 * polígono) para casos excepcionales.
 *
 * Sin selector de color libre. Sin control de grosor visible. La paleta de
 * 5 colores fijos se usa para anotaciones (rojo, azul, verde, amarillo, gris).
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 9 (Barra superior).
 */

import { useState } from "react";
import {
  MousePointer2, Pencil, Tag, MessageSquare, Undo2, Redo2, Save, X,
  Slash, Square, Circle, Hexagon, ChevronDown, Eraser,
} from "lucide-react";
import { ANNOTATION_COLORS } from "./entity-types";
import type { AnnotationColor } from "./entity-types";

/** Modo de interacción activo en el editor. */
export type SketchMode =
  | "select"
  | "draw"
  | "label"
  | "comment"
  | "line"
  | "rectangle"
  | "circle"
  | "polygon"
  | "eraser";

interface SketchToolbarProps {
  mode: SketchMode;
  onModeChange: (mode: SketchMode) => void;
  annotationColor: AnnotationColor;
  onAnnotationColorChange: (color: AnnotationColor) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  /** Se llama al cancelar. Si se pasa, muestra botón Cancelar junto a Guardar. */
  onCancel?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  saving: boolean;
}

/** Botones principales de la barra (7 acciones). */
const MAIN_BUTTONS: { mode: SketchMode; icon: typeof Pencil; title: string }[] = [
  { mode: "select", icon: MousePointer2, title: "Seleccionar y mover" },
  { mode: "draw", icon: Pencil, title: "Dibujar a mano alzada" },
  { mode: "label", icon: Tag, title: "Etiqueta" },
  { mode: "comment", icon: MessageSquare, title: "Comentario" },
];

/** Botones de "Más herramientas" (figuras geométricas, ocultas por defecto). */
const MORE_BUTTONS: { mode: SketchMode; icon: typeof Pencil; title: string }[] = [
  { mode: "line", icon: Slash, title: "Línea recta" },
  { mode: "rectangle", icon: Square, title: "Rectángulo" },
  { mode: "circle", icon: Circle, title: "Círculo" },
  { mode: "polygon", icon: Hexagon, title: "Polígono" },
  { mode: "eraser", icon: Eraser, title: "Borrar objeto" },
];

export function SketchToolbar({
  mode,
  onModeChange,
  annotationColor,
  onAnnotationColorChange,
  onUndo,
  onRedo,
  onClear,
  onSave,
  onCancel,
  canUndo,
  canRedo,
  canClear,
  saving,
}: SketchToolbarProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="sketch-toolbar">
      {/* Herramientas principales */}
      <div className="sketch-toolbar-group">
        {MAIN_BUTTONS.map(({ mode: m, icon: Icon, title }) => (
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

      {/* Paleta de 5 colores fijos (para anotaciones) */}
      <div className="sketch-toolbar-group">
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`sketch-mode-btn ${annotationColor === c.id ? "is-active" : ""}`}
            onClick={() => onAnnotationColorChange(c.id)}
            title={c.label}
            aria-label={`Color ${c.label}`}
            aria-pressed={annotationColor === c.id}
          >
            <span
              className="sketch-block-swatch"
              // Excepción REGLA #2: color dinámico de la paleta de anotaciones.
              style={{ backgroundColor: c.hex }}
            />
          </button>
        ))}
      </div>

      <div className="sketch-toolbar-divider" />

      {/* Más herramientas (desplegable) */}
      <div className="sketch-toolbar-group">
        <button
          type="button"
          className={`sketch-mode-btn ${showMore ? "is-active" : ""}`}
          onClick={() => setShowMore(!showMore)}
          title="Más herramientas"
          aria-label="Más herramientas"
          aria-expanded={showMore}
        >
          <ChevronDown className={`size-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
        </button>
        {showMore && (
          <div className="sketch-more-tools">
            {MORE_BUTTONS.map(({ mode: m, icon: Icon, title }) => (
              <button
                key={m}
                type="button"
                className={`sketch-mode-btn ${mode === m ? "is-active" : ""}`}
                onClick={() => { onModeChange(m); setShowMore(false); }}
                title={title}
                aria-label={title}
                aria-pressed={mode === m}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}
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

      {/* Acciones principales: Cancelar + Guardar juntos a la derecha */}
      <div className="sketch-toolbar-group sketch-toolbar-spacer">
        {onCancel && (
          <button
            type="button"
            className="sketch-action-btn"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="size-3.5" />
            Cancelar
          </button>
        )}
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
