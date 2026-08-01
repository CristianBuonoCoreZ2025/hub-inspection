/**
 * Contrato de entidades del Editor de Croquis.
 *
 * Cada entidad del catálogo implementa este contrato. El editor interactúa con
 * entidades a través de esta interfaz, sin acoplarse a tipos concretos. Agregar
 * una nueva entidad = agregar una definición al catalog.json + implementar el
 * contrato. El editor no se modifica.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 4 (Modelo de entidades) y § 16 (API interna).
 */

/** Categoría de entidad (5 categorías definitivas). */
export type EntityCategory =
  | "spaces"
  | "structure"
  | "objects"
  | "equipment"
  | "annotations";

/** Cómo se dibuja la entidad en el lienzo. */
export type EntityRenderer =
  | "block"          // Espacio: rectángculo redimensionable con nombre dentro.
  | "line"           // Muro: línea gruesa.
  | "group"          // Puerta/ventana/escalera: grupo de líneas con forma propia.
  | "circle"         // Pilar: círculo.
  | "svg"            // Objeto/equipamiento: path SVG con escalamiento proporcional.
  | "annotation-label"   // Etiqueta: rectángculo con texto, fondo y borde.
  | "annotation-comment"; // Comentario: rectángculo con texto y marca visual distinta.

/** Cómo escala la entidad al redimensionar. */
export type EntityScaleMode =
  | "free"           // Redimensionar libre (espacios, estructura).
  | "proportional";  // Mantener proporción (objetos, equipamiento).

/** ID de textura visual (no representa materialidad). */
export type TextureId = "none" | "dots" | "lines" | "grid" | "tiles";

/** Nombre de propiedad editable en el panel de doble clic. */
export type PropertyName =
  | "name"
  | "width"
  | "height"
  | "length"
  | "wallType"
  | "destination"
  | "text"
  | "color";

/** Tipo de muro (para la propiedad wallType). */
export type WallType = "interior" | "exterior" | "medianero";

/** Color de la paleta reducida (5 colores fijos). */
export type AnnotationColor = "red" | "blue" | "green" | "yellow" | "gray";

/** Definición de una entidad en el catálogo (catalog.json). */
export interface EntityDefinition {
  id: string;
  category: EntityCategory;
  label: string;
  defaultLabel: string;
  icon: string;
  renderer: EntityRenderer;
  scaleMode: EntityScaleMode;
  defaultWidth: number;
  defaultHeight: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  texture: TextureId;
  properties: PropertyName[];
  /** SVG path para entidades con renderer="svg". */
  svgPath?: string;
  /** ID de entidad a la que se asocia por snap (ej: puerta -> muro). */
  snapTo?: string;
  /** Si true, al soltar la entidad se solicita texto al usuario. */
  promptText?: boolean;
}

/** Catálogo raíz (catalog.json). */
export interface Catalog {
  version: number;
  entities: EntityDefinition[];
}

/**
 * Contrato que toda entidad implementa en runtime (sobre el objeto Fabric).
 * Se almacena como metadata en el objeto Fabric para persistir en
 * serialización y exportación.
 */
export interface EntityMetadata {
  /** ID de la definición en el catálogo. */
  catalogId: string;
  /** Categoría. */
  category: EntityCategory;
  /** Nombre visible (asignado por numeración automática o editado). */
  name: string;
  /** Prefijo de numeración (del catálogo). */
  defaultLabel: string;
  /** Renderer. */
  renderer: EntityRenderer;
  /** Modo de escalamiento. */
  scaleMode: EntityScaleMode;
  /** Textura actual. */
  texture: TextureId;
  /** Propiedades editables y sus valores. */
  properties: Record<string, string | number | null>;
  /** ID de la entidad a la que está asociada (ej: puerta -> muro). */
  attachedTo?: string;
  /** Color de anotación (solo para annotations). */
  annotationColor?: AnnotationColor;
}

/** Metadata del catálogo para la UI (categorías). */
export interface CategoryMeta {
  id: EntityCategory;
  label: string;
  icon: string;
}

/** Orden de las categorías en la biblioteca. */
export const CATEGORY_ORDER: CategoryMeta[] = [
  { id: "spaces", label: "Espacios", icon: "home" },
  { id: "structure", label: "Estructura", icon: "brick-wall" },
  { id: "objects", label: "Objetos", icon: "package" },
  { id: "equipment", label: "Equipamiento", icon: "cog" },
  { id: "annotations", label: "Anotaciones", icon: "tag" },
];

/** Reorden de categorías según tipo de bien. */
export type BienType =
  | "casa"
  | "departamento"
  | "edificio"
  | "galpon"
  | "maquinaria"
  | "oficina"
  | "otros";

/** Orden de categorías por tipo de bien (la primera se abre por defecto). */
export const CATEGORY_ORDER_BY_BIEN: Record<BienType, EntityCategory[]> = {
  casa: ["spaces", "structure", "objects", "annotations", "equipment"],
  departamento: ["spaces", "structure", "objects", "annotations", "equipment"],
  edificio: ["spaces", "structure", "equipment", "objects", "annotations"],
  galpon: ["structure", "equipment", "spaces", "objects", "annotations"],
  maquinaria: ["equipment", "structure", "spaces", "objects", "annotations"],
  oficina: ["spaces", "objects", "structure", "annotations", "equipment"],
  otros: ["spaces", "structure", "objects", "equipment", "annotations"],
};

/** Paleta de 5 colores fijos para anotaciones. */
export const ANNOTATION_COLORS: { id: AnnotationColor; hex: string; label: string }[] = [
  { id: "red", hex: "#ef4444", label: "Rojo" },
  { id: "blue", hex: "#3b82f6", label: "Azul" },
  { id: "green", hex: "#22c55e", label: "Verde" },
  { id: "yellow", hex: "#f59e0b", label: "Amarillo" },
  { id: "gray", hex: "#6b7280", label: "Gris" },
];

/** Props del editor de croquis (contrato estable, sin cambios). */
export interface SketchEditorProps {
  onSave: (data: { dataUrl: string; sketchData: Record<string, unknown> }) => void;
  /** Se llama al cancelar. Si se pasa, muestra botón Cancelar junto a Guardar. */
  onCancel?: () => void;
  saving?: boolean;
  initialImage?: string;
  initialSketchData?: Record<string, unknown> | null;
  height?: number;
  className?: string;
  /** Tipo de bien para reordenar la biblioteca (opcional). */
  bienType?: BienType;
}
