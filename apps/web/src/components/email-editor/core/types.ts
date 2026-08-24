/**
 * Tipos del modelo de documento del editor de email.
 *
 * El documento es un árbol JSON de bloques. Cada bloque es un componente
 * independiente con su propio tipo y propiedades.
 *
 * El HTML nunca es el formato de edición — solo de exportación.
 * El JSON es la única fuente de verdad.
 */

// ─── Inline: marcas de formato dentro de un nodo de texto ───

export type TextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "link"; href: string; target?: string }
  | { type: "color"; color: string }
  | { type: "highlight"; color: string }
  | { type: "fontSize"; size: string }
  | { type: "fontFamily"; family: string }
  | { type: "sup" }
  | { type: "sub" };

// ─── Nodo de texto inline ───

export interface TextNode {
  type: "text";
  text: string;
  marks?: TextMark[];
}

// ─── Variable dinámica (chip) ───

export interface VariableNode {
  type: "variable";
  variable: string; // ej: "cliente", "numeroCaso"
  fallback?: string; // texto alternativo si la variable no tiene valor
}

// ─── Tipos de contenido inline ───

export type InlineContent = TextNode | VariableNode;

// ─── Alineación ───

export type Alignment = "left" | "center" | "right" | "justify";

// ─── Bloques base ───

interface BlockBase {
  id: string;
  locked?: boolean; // para plantillas (header, footer, firma)
}

// ─── Párrafo ───

export interface ParagraphBlock extends BlockBase {
  type: "paragraph";
  children: InlineContent[];
  alignment?: Alignment;
  indent?: number; // nivel de sangría (0 = sin sangría)
  lineHeight?: number; // 1, 1.15, 1.5, 2
}

// ─── Título ───

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineContent[];
  alignment?: Alignment;
}

// ─── Lista (viñetas o numerada) ───

export interface ListItem {
  id: string;
  children: InlineContent[];
  subItems?: ListItem[];
}

export interface ListBlock extends BlockBase {
  type: "list";
  ordered: boolean; // true = numerada, false = viñetas
  items: ListItem[];
  alignment?: Alignment;
}

// ─── Tabla ───

export interface TableCell {
  id: string;
  children: Block[]; // una celda puede contener múltiples bloques
  colspan?: number;
  rowspan?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  verticalAlign?: "top" | "middle" | "bottom";
  horizontalAlign?: Alignment;
  width?: string; // ej: "25%", "200px"
}

export interface TableRow {
  id: string;
  cells: TableCell[];
  header?: boolean;
  height?: string;
}

export interface TableBlock extends BlockBase {
  type: "table";
  rows: TableRow[];
  borderWidth?: number;
  borderColor?: string;
  cellPadding?: number;
  cellSpacing?: number;
  width?: string; // "100%", "500px", "auto"
  alignment?: Alignment;
}

// ─── Imagen ───

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  width?: string; // "100%", "300px"
  height?: string;
  alignment?: Alignment;
  link?: string; // URL al hacer clic
  borderRadius?: number;
}

// ─── Botón (CTA) ───

export interface ButtonBlock extends BlockBase {
  type: "button";
  text: string;
  href: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  padding?: string;
  borderRadius?: number;
  alignment?: Alignment;
  width?: string;
}

// ─── Cita ───

export interface QuoteBlock extends BlockBase {
  type: "quote";
  children: InlineContent[];
  borderColor?: string;
  backgroundColor?: string;
}

// ─── Divisor (línea horizontal) ───

export interface DividerBlock extends BlockBase {
  type: "divider";
  color?: string;
  thickness?: number;
  width?: string; // "100%", "50%"
}

// ─── Espaciador ───

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number; // en px
}

// ─── Columnas ───

export interface Column {
  id: string;
  blocks: Block[];
  width?: string; // "50%", "33%"
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  columns: Column[];
  gap?: number;
}

// ─── Contenedor ───

export interface ContainerBlock extends BlockBase {
  type: "container";
  blocks: Block[];
  backgroundColor?: string;
  padding?: number;
  maxWidth?: string;
}

// ─── Callout (caja destacada) ───

export interface CalloutBlock extends BlockBase {
  type: "callout";
  children: InlineContent[];
  backgroundColor?: string;
  borderColor?: string;
  icon?: string;
}

// ─── Bloque HTML crudo (para casos especiales) ───

export interface HtmlBlock extends BlockBase {
  type: "html";
  html: string;
}

// ─── Firma ───

export interface SignatureBlock extends BlockBase {
  type: "signature";
  blocks: Block[];
}

// ─── Unión de todos los bloques ───

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | ButtonBlock
  | QuoteBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | ContainerBlock
  | CalloutBlock
  | HtmlBlock
  | SignatureBlock;

// ─── Documento raíz ───

export interface EmailDocument {
  version: number;
  blocks: Block[];
  metadata?: {
    subject?: string;
    previewText?: string;
    backgroundColor?: string;
    maxWidth?: string;
    fontFamily?: string;
    fontSize?: string;
    textColor?: string;
    linkColor?: string;
  };
}

// ─── Modos del editor ───

export type EditorMode = "compose" | "template" | "reply" | "forward";

// ─── Layout visual del editor ───

export type EditorLayout = "legacy" | "office365";

// ─── Variables disponibles ───

export interface VariableDefinition {
  key: string; // "cliente"
  label: string; // "Cliente"
  value?: string; // valor actual para preview
  group?: string; // agrupación en el panel
}

// ─── Helpers de tipo ───

export type BlockType = Block["type"];

export function isBlockOfType<T extends Block>(
  block: Block,
  type: T["type"]
): block is T {
  return block.type === type;
}
