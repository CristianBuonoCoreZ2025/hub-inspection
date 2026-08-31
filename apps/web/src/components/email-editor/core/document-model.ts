/**
 * DocumentModel — funciones puras para crear y manipular el documento JSON.
 *
 * Todas las funciones son inmutables: retornan una nueva copia del documento
 * o bloque, nunca mutan el original.
 *
 * El documento JSON es la única fuente de verdad.
 * El HTML nunca se edita directamente.
 */

import type {
  Block,
  EmailDocument,
  ParagraphBlock,
  HeadingBlock,
  ListBlock,
  ListItem,
  TableBlock,
  TableRow,
  TableCell,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  ColumnsBlock,
  Column,
  ContainerBlock,
  QuoteBlock,
  CalloutBlock,
  TextNode,
  VariableNode,
  TextMark,
} from "./types";
import { generateId, generateCellId, generateRowId, generateColumnId } from "../utils/id";

// ─── Crear documento vacío ───

export function createEmptyDocument(): EmailDocument {
  return {
    version: 1,
    blocks: [
      {
        id: "blk_initial",
        type: "paragraph",
        children: [],
      },
    ],
    metadata: {
      backgroundColor: "#ffffff",
      maxWidth: "600px",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      textColor: "#333333",
      linkColor: "#0066cc",
    },
  };
}

// ─── Crear bloques ───

export function createParagraph(text = ""): ParagraphBlock {
  return {
    id: generateId(),
    type: "paragraph",
    children: text ? [createTextNode(text)] : [],
  };
}

export function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6 = 1, text = ""): HeadingBlock {
  return {
    id: generateId(),
    type: "heading",
    level,
    children: text ? [createTextNode(text)] : [],
  };
}

export function createList(ordered = false): ListBlock {
  return {
    id: generateId(),
    type: "list",
    ordered,
    items: [{ id: generateId(), children: [createTextNode("")] }],
  };
}

export function createListItem(text = ""): ListItem {
  return {
    id: generateId(),
    children: text ? [createTextNode(text)] : [],
  };
}

export function createTable(rows = 3, cols = 3): TableBlock {
  const tableRows: TableRow[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: generateCellId(),
        children: [createParagraph()],
        horizontalAlign: "left",
        verticalAlign: "top",
      });
    }
    tableRows.push({
      id: generateRowId(),
      cells,
      header: r === 0,
    });
  }
  return {
    id: generateId(),
    type: "table",
    rows: tableRows,
    borderWidth: 1,
    borderColor: "#cccccc",
    cellPadding: 8,
    cellSpacing: 0,
    width: "100%",
  };
}

export function createImage(src = "", alt = ""): ImageBlock {
  return {
    id: generateId(),
    type: "image",
    src,
    alt,
    width: "auto",
    alignment: "center",
  };
}

export function createButton(text = "Haz clic aquí", href = "#"): ButtonBlock {
  return {
    id: generateId(),
    type: "button",
    text,
    href,
    backgroundColor: "#0066cc",
    textColor: "#ffffff",
    fontSize: "16px",
    padding: "12px 24px",
    borderRadius: 6,
    alignment: "center",
  };
}

export function createDivider(): DividerBlock {
  return {
    id: generateId(),
    type: "divider",
    color: "#cccccc",
    thickness: 1,
    width: "100%",
  };
}

export function createSpacer(height = 20): SpacerBlock {
  return {
    id: generateId(),
    type: "spacer",
    height,
  };
}

export function createColumns(count = 2): ColumnsBlock {
  const columns: Column[] = [];
  const width = `${Math.floor(100 / count)}%`;
  for (let i = 0; i < count; i++) {
    columns.push({
      id: generateColumnId(),
      blocks: [createParagraph()],
      width,
    });
  }
  return {
    id: generateId(),
    type: "columns",
    columns,
    gap: 16,
  };
}

export function createContainer(): ContainerBlock {
  return {
    id: generateId(),
    type: "container",
    blocks: [createParagraph()],
    padding: 20,
    maxWidth: "600px",
  };
}

export function createQuote(): QuoteBlock {
  return {
    id: generateId(),
    type: "quote",
    children: [createTextNode("")],
    borderColor: "#cccccc",
    backgroundColor: "#f9f9f9",
  };
}

export function createCallout(): CalloutBlock {
  return {
    id: generateId(),
    type: "callout",
    children: [createTextNode("")],
    backgroundColor: "#fef3cd",
    borderColor: "#ffc107",
    icon: "info",
  };
}

// ─── Crear nodos inline ───

export function createTextNode(text: string, marks?: TextMark[]): TextNode {
  return { type: "text", text, marks };
}

export function createVariableNode(variable: string, fallback?: string): VariableNode {
  return { type: "variable", variable, fallback };
}

// ─── Manipulación de bloques ───

/**
 * Inserta un bloque en una posición específica del documento.
 */
export function insertBlock(doc: EmailDocument, block: Block, index: number): EmailDocument {
  const blocks = [...doc.blocks];
  blocks.splice(index, 0, block);
  return { ...doc, blocks };
}

/**
 * Elimina un bloque por su ID.
 */
export function removeBlock(doc: EmailDocument, blockId: string): EmailDocument {
  return { ...doc, blocks: doc.blocks.filter((b) => b.id !== blockId) };
}

/**
 * Reemplaza un bloque por su ID.
 */
export function updateBlock(doc: EmailDocument, blockId: string, patch: Partial<Block>): EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } as Block : b)),
  };
}

/**
 * Mueve un bloque de una posición a otra.
 */
export function moveBlock(doc: EmailDocument, fromIndex: number, toIndex: number): EmailDocument {
  const blocks = [...doc.blocks];
  const [moved] = blocks.splice(fromIndex, 1);
  blocks.splice(toIndex, 0, moved);
  return { ...doc, blocks };
}

/**
 * Encuentra un bloque por su ID.
 */
export function findBlock(doc: EmailDocument, blockId: string): Block | undefined {
  return doc.blocks.find((b) => b.id === blockId);
}

/**
 * Encuentra el índice de un bloque por su ID.
 */
export function findBlockIndex(doc: EmailDocument, blockId: string): number {
  return doc.blocks.findIndex((b) => b.id === blockId);
}

// ─── Manipulación de texto inline ───

/**
 * Aplica una marca a todos los nodos de texto de un bloque.
 */
export function applyMarkToBlock(block: Block, mark: TextMark): Block {
  if (!("children" in block) || !Array.isArray(block.children)) return block;
  return {
    ...block,
    children: block.children.map((node) => {
      if (node.type === "text") {
        return applyMarkToText(node, mark);
      }
      return node;
    }),
  } as Block;
}

/**
 * Aplica una marca a un nodo de texto, evitando duplicados del mismo tipo.
 */
export function applyMarkToText(node: TextNode, mark: TextMark): TextNode {
  const marks = node.marks ?? [];
  // Remover marca existente del mismo tipo (toggle)
  const filtered = marks.filter((m) => m.type !== mark.type);
  filtered.push(mark);
  return { ...node, marks: filtered };
}

/**
 * Quita una marca de un nodo de texto.
 */
export function removeMarkFromText(node: TextNode, markType: TextMark["type"]): TextNode {
  if (!node.marks) return node;
  return { ...node, marks: node.marks.filter((m) => m.type !== markType) };
}

/**
 * Quita todas las marcas de un nodo de texto.
 */
export function clearAllMarks(node: TextNode): TextNode {
  return { ...node, marks: [] };
}

// ─── Manipulación de tablas ───

/**
 * Agrega una fila al final de la tabla.
 */
export function addTableRow(table: TableBlock, header = false): TableBlock {
  const colCount = table.rows[0]?.cells.length ?? 3;
  const cells: TableCell[] = [];
  for (let c = 0; c < colCount; c++) {
    cells.push({
      id: generateCellId(),
      children: [createParagraph()],
      horizontalAlign: "left",
      verticalAlign: "top",
    });
  }
  return {
    ...table,
    rows: [...table.rows, { id: generateRowId(), cells, header }],
  };
}

/**
 * Agrega una columna al final de la tabla.
 */
export function addTableColumn(table: TableBlock): TableBlock {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: [
        ...row.cells,
        {
          id: generateCellId(),
          children: [createParagraph()],
          horizontalAlign: "left",
          verticalAlign: "top",
        },
      ],
    })),
  };
}

/**
 * Elimina una fila por índice.
 */
export function removeTableRow(table: TableBlock, rowIndex: number): TableBlock {
  return { ...table, rows: table.rows.filter((_, i) => i !== rowIndex) };
}

/**
 * Elimina una columna por índice.
 */
export function removeTableColumn(table: TableBlock, colIndex: number): TableBlock {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, i) => i !== colIndex),
    })),
  };
}

// ─── Serialización JSON ───

export function serializeToJson(doc: EmailDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function deserializeFromJson(json: string): EmailDocument {
  const parsed = JSON.parse(json);
  if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
    throw new Error("JSON inválido: falta el array 'blocks'");
  }
  return parsed as EmailDocument;
}
