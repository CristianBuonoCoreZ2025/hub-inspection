/**
 * Tipos compartidos del feature de croquis vectorial.
 *
 * El editor usa Fabric.js v6 para manipular objetos vectoriales (rectángculos,
 * líneas, grupos) que representan habitaciones y elementos estructurales de un
 * plano. El export final sigue siendo PNG base64 para no alterar el backend.
 */

/** Modo de interacción activo en el editor. */
export type SketchMode = "select" | "draw" | "pan";

/** Identificador de bloque predefinido del catálogo. */
export type BlockId =
  | "living"
  | "comedor"
  | "bano"
  | "cocina"
  | "dormitorio"
  | "garage"
  | "oficina"
  | "muro"
  | "puerta"
  | "ventana"
  | "escalera";

/** Tipo primitivo de Fabric que instancia el bloque. */
export type BlockFabricType = "rect" | "line" | "group" | "path";

/** Definición de un bloque arrastrable del catálogo. */
export interface BlockDefinition {
  id: BlockId;
  label: string;
  fabricType: BlockFabricType;
  /** Ancho inicial en px del objeto al soltarlo en el canvas. */
  defaultWidth: number;
  /** Alto inicial en px del objeto al soltarlo en el canvas. */
  defaultHeight: number;
  /** Color de relleno (hex). */
  fill: string;
  /** Color de borde (hex). */
  stroke: string;
  /** Grosor de borde en px. */
  strokeWidth: number;
  /** Opacidad 0..1. */
  opacity: number;
}

/** Props del editor de croquis (contrato estable). */
export interface SketchEditorProps {
  /** Se llama con un PNG base64 cuando el usuario guarda. */
  onSave: (dataUrl: string) => void;
  /** Indica que el guardado está en curso (deshabilita el botón). */
  saving?: boolean;
  /** URL de un croquis previo a cargar como fondo bloqueado (edición). */
  initialImage?: string;
  /** Alto fijo del canvas en px (override del alto responsivo por breakpoint). */
  height?: number;
  /** Clase CSS extra para el contenedor raíz. */
  className?: string;
}
