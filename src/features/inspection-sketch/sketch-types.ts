/**
 * Tipos compartidos del feature de croquis vectorial.
 *
 * El editor usa Fabric.js v6 para manipular objetos vectoriales (rectángculos,
 * líneas, grupos) que representan habitaciones y elementos estructurales de un
 * plano. El export final sigue siendo PNG base64 para no alterar el backend.
 */

/** Categoría de bloque predefinido (para agrupar en la paleta). */
export type BlockCategory = "habitaciones" | "oficina" | "estacionamiento" | "maquinaria" | "negocio" | "exterior" | "estructura";

/**
 * Modo de interacción activo en el editor.
 *  - select: mover/resize/rotar objetos (selección nativa de Fabric).
 *  - draw: mano alzada con PencilBrush (isDrawingMode).
 *  - line / rectangle / circle / triangle: dibujar figura arrastrando.
 *  - eraser: clic sobre un objeto lo elimina.
 *  - text: clic coloca un Textbox editable.
 */
export type SketchMode =
  | "select"
  | "draw"
  | "line"
  | "rectangle"
  | "circle"
  | "triangle"
  | "eraser"
  | "text";

/** Identificador de bloque predefinido del catálogo. */
export type BlockId =
  // Habitaciones
  | "living"
  | "comedor"
  | "bano"
  | "cocina"
  | "dormitorio"
  | "garage"
  | "oficina-room"
  // Oficina
  | "escritorio"
  | "silla"
  | "archivador"
  | "reunion"
  | "recepcion"
  // Estacionamiento
  | "vehiculo"
  | "plaza"
  | "rampa"
  | "bicicleta"
  // Maquinaria
  | "motor"
  | "tanque"
  | "panel"
  | "equipo"
  // Negocio
  | "mostrador"
  | "estanteria"
  | "caja"
  | "exhibidor"
  // Exterior
  | "arbol"
  | "jardin"
  | "vereda"
  | "porton"
  // Estructura
  | "muro"
  | "puerta"
  | "ventana"
  | "escalera";

/** Tipo primitivo de Fabric que instancia el bloque. */
export type BlockFabricType = "rect" | "line" | "group" | "path" | "circle" | "ellipse";

/** Definición de un bloque arrastrable del catálogo. */
export interface BlockDefinition {
  id: BlockId;
  label: string;
  category: BlockCategory;
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

/** Metadata de una categoría para la paleta (título + orden). */
export interface CategoryMeta {
  id: BlockCategory;
  label: string;
}

/** Orden de las categorías en la paleta. */
export const CATEGORY_ORDER: CategoryMeta[] = [
  { id: "habitaciones", label: "Habitaciones" },
  { id: "oficina", label: "Oficina" },
  { id: "estacionamiento", label: "Estacionamiento" },
  { id: "maquinaria", label: "Maquinaria" },
  { id: "negocio", label: "Negocio" },
  { id: "exterior", label: "Exterior" },
  { id: "estructura", label: "Estructura" },
];
