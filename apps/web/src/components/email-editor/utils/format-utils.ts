/**
 * FormatUtils — utilidades para aplicar formato a la selección actual.
 *
 * Usa document.execCommand (deprecated pero soportado en todos los navegadores)
 * para aplicar formato a la selección de texto dentro del contentEditable.
 * Después de aplicar el formato, re-parsea el contentEditable a JSON
 * para mantener el modelo sincronizado.
 *
 * Flujo:
 *   1. Usuario selecciona texto en el contentEditable
 *   2. Usuario hace clic en un botón del Ribbon
 *      (onMouseDown={e.preventDefault()} evita que se pierda el foco)
 *   3. applyFormatToSelection('bold') usa execCommand sobre la selección
 *   4. Se re-parsea el contentEditable a InlineContent[]
 *   5. Se despacha un comando para actualizar el bloque en el store
 */

import type { InlineContent, TextMark, TextNode } from "../core/types";
import type { EmailDocument, Block } from "../core/types";
import { useEditorStore } from "../store/editor-store";
import { GenericCommand } from "../core/commands";
import { parseContentEditable } from "../canvas/inline-text";

/**
 * Type guard: ¿es un TextNode?
 */
function isTextNode(node: InlineContent): node is TextNode {
  return node.type === "text";
}

/**
 * Obtiene el blockId del contentEditable que tiene el foco actualmente.
 */
export function getFocusedBlockId(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node instanceof HTMLElement && node.classList?.contains("ee-inline-text")) {
      return node.dataset.blockId ?? null;
    }
    node = node.parentNode;
  }
  return null;
}

// ─── Mapa de comandos execCommand → tipo de TextMark ───

const TOGGLE_MARK_COMMANDS: Record<string, TextMark["type"]> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikeThrough: "strike",
  superscript: "sup",
  subscript: "sub",
};

/**
 * Aplica un formato a la selección actual.
 *
 * - Si hay selección múltiple de bloques (Ctrl+A o Shift+click), aplica el
 *   formato programáticamente a TODOS los InlineContent[] de los bloques
 *   seleccionados, sin depender de execCommand (que no funciona a través
 *   de múltiples contentEditable).
 * - Si hay un solo bloque con foco y selección nativa de texto, usa
 *   execCommand sobre esa selección (comportamiento original).
 */
export function applyFormatToSelection(command: string, value?: string): void {
  const store = useEditorStore.getState();
  const doc = store.document;
  const selectedIds = store.selection.selectedBlockIds;

  // Selección múltiple → aplicar programáticamente a todos los bloques
  if (selectedIds.length > 1) {
    applyFormatToMultipleBlocks(doc, selectedIds, command, value, store);
    return;
  }

  // Selección simple → usar execCommand sobre la selección nativa
  const blockId = getFocusedBlockId();
  if (!blockId) return;

  const block = doc.blocks.find((b) => b.id === blockId);
  if (!block || !("children" in block)) return;

  const oldChildren = (block as { children: InlineContent[] }).children;

  document.execCommand(command, false, value);

  const element = findContentEditableForBlock(blockId);
  if (!element) return;

  const newChildren = parseContentEditable(element);

  store.executeCommand(
    new GenericCommand(
      (d) => updateBlockChildrenInDoc(d, blockId, newChildren),
      (d) => updateBlockChildrenInDoc(d, blockId, oldChildren),
      `Formato: ${command}`
    )
  );
}

// ─── Formato multi-bloque (programático) ───

/**
 * Aplica un formato a todos los bloques seleccionados.
 * Recorre los children de cada bloque y añade/quita/modifica el mark.
 * Despacha un ÚNICO comando (Ctrl+Z deshace todo a la vez).
 */
function applyFormatToMultipleBlocks(
  doc: EmailDocument,
  selectedIds: string[],
  command: string,
  value: string | undefined,
  store: ReturnType<typeof useEditorStore.getState>
): void {
  // Bloques seleccionados que tienen children (paragraph, heading, quote, callout)
  const targetBlocks = selectedIds
    .map((id) => doc.blocks.find((b) => b.id === id))
    .filter((b): b is Block => b !== undefined && "children" in b);

  if (targetBlocks.length === 0) return;

  // Guardar children anteriores para undo
  const oldChildrenMap = targetBlocks.map((b) => ({
    id: b.id,
    children: (b as { children: InlineContent[] }).children,
  }));

  // Calcular nuevos children para cada bloque
  const newChildrenMap = targetBlocks.map((b) => ({
    id: b.id,
    children: computeNewChildren(
      (b as { children: InlineContent[] }).children,
      command,
      value
    ),
  }));

  const label = formatLabel(command);

  store.executeCommand(
    new GenericCommand(
      (d) => {
        let newDoc = d;
        newChildrenMap.forEach(({ id, children }) => {
          newDoc = updateBlockChildrenInDoc(newDoc, id, children);
        });
        return newDoc;
      },
      (d) => {
        let newDoc = d;
        oldChildrenMap.forEach(({ id, children }) => {
          newDoc = updateBlockChildrenInDoc(newDoc, id, children);
        });
        return newDoc;
      },
      label
    )
  );
}

/**
 * Calcula los nuevos InlineContent[] para un bloque dado un comando.
 * - Comandos toggle (bold, italic, underline, strike, sup, sub):
 *   si TODOS los nodos de texto ya tienen el mark → quitar; si no → añadir.
 * - Comandos set (foreColor, hiliteColor, fontName, fontSize, createLink):
 *   siempre establecen el mark con el valor dado.
 * - removeFormat: quita todos los marks de todos los nodos.
 */
function computeNewChildren(
  children: InlineContent[],
  command: string,
  value: string | undefined
): InlineContent[] {
  // Toggle marks
  const toggleType = TOGGLE_MARK_COMMANDS[command];
  if (toggleType) {
    return toggleMarkOnChildren(children, toggleType);
  }

  // Set marks (color, highlight, fontFamily, fontSize, link)
  if (command === "foreColor" && value) {
    return setMarkOnChildren(children, { type: "color", color: value });
  }
  if (command === "hiliteColor" && value) {
    return setMarkOnChildren(children, { type: "highlight", color: value });
  }
  if (command === "fontName" && value) {
    return setMarkOnChildren(children, { type: "fontFamily", family: value });
  }
  if (command === "fontSize" && value) {
    return setMarkOnChildren(children, { type: "fontSize", size: mapFontSizeValue(value) });
  }
  if (command === "createLink" && value) {
    return setMarkOnChildren(children, { type: "link", href: value, target: "_blank" });
  }
  if (command === "removeFormat") {
    return children.map((node) =>
      node.type === "text" ? { ...node, marks: undefined } : node
    );
  }

  // Comando no soportado en multi-bloque → no cambiar
  return children;
}

/**
 * Toggle de un mark en todos los nodos de texto.
 * Si todos lo tienen → quitar. Si alguno no lo tiene → añadir a todos.
 */
function toggleMarkOnChildren(children: InlineContent[], markType: TextMark["type"]): InlineContent[] {
  const textNodes = children.filter(isTextNode);
  if (textNodes.length === 0) return children;

  const allHaveMark = textNodes.every((node) =>
    Boolean(node.marks?.some((m) => m.type === markType))
  );

  return children.map((node) => {
    if (!isTextNode(node)) return node;
    const marks = node.marks ?? [];
    if (allHaveMark) {
      // Quitar el mark
      const filtered = marks.filter((m) => m.type !== markType);
      return { ...node, marks: filtered.length > 0 ? filtered : undefined };
    }
    // Añadir el mark
    const newMark = createMark(markType);
    if (!newMark) return node;
    const filtered = marks.filter((m) => m.type !== markType);
    return { ...node, marks: [...filtered, newMark] };
  });
}

/**
 * Establece un mark (con valor) en todos los nodos de texto, reemplazando
 * cualquier mark del mismo tipo que ya existiera.
 */
function setMarkOnChildren(children: InlineContent[], mark: TextMark): InlineContent[] {
  return children.map((node) => {
    if (node.type !== "text") return node;
    const marks = (node.marks ?? []).filter((m) => m.type !== mark.type);
    return { ...node, marks: [...marks, mark] };
  });
}

function createMark(type: TextMark["type"]): TextMark | null {
  switch (type) {
    case "bold": return { type: "bold" };
    case "italic": return { type: "italic" };
    case "underline": return { type: "underline" };
    case "strike": return { type: "strike" };
    case "sup": return { type: "sup" };
    case "sub": return { type: "sub" };
    default: return null;
  }
}

/**
 * Mapea el valor de fontSize de execCommand (1-7) a px.
 * El ribbon usa valores 2-7 que corresponden a 10-28px aprox.
 */
function mapFontSizeValue(value: string): string {
  const sizeMap: Record<string, string> = {
    "1": "10px",
    "2": "13px",
    "3": "16px",
    "4": "18px",
    "5": "24px",
    "6": "32px",
    "7": "48px",
  };
  return sizeMap[value] ?? "16px";
}

function formatLabel(command: string): string {
  const names: Record<string, string> = {
    bold: "Negrita",
    italic: "Cursiva",
    underline: "Subrayado",
    strikeThrough: "Tachado",
    superscript: "Superíndice",
    subscript: "Subíndice",
    foreColor: "Color de texto",
    hiliteColor: "Resaltado",
    fontName: "Fuente",
    fontSize: "Tamaño de fuente",
    createLink: "Insertar enlace",
    removeFormat: "Quitar formato",
  };
  return names[command] ?? `Formato: ${command}`;
}

/**
 * Verifica si todos los nodos de texto de un conjunto de children tienen
 * un mark específico. Se usa para el estado activo de los botones del ribbon.
 */
export function hasMarkInChildren(children: InlineContent[], markType: TextMark["type"]): boolean {
  const textNodes = children.filter(isTextNode);
  if (textNodes.length === 0) return false;
  return textNodes.every((node) => Boolean(node.marks?.some((m) => m.type === markType)));
}

/**
 * Aplica un color de texto a la selección.
 */
export function applyTextColor(color: string): void {
  document.execCommand("styleWithCSS", false, "true");
  applyFormatToSelection("foreColor", color);
  document.execCommand("styleWithCSS", false, "false");
}

/**
 * Aplica un color de fondo (resaltado) a la selección.
 */
export function applyHighlightColor(color: string): void {
  document.execCommand("styleWithCSS", false, "true");
  applyFormatToSelection("hiliteColor", color);
  document.execCommand("styleWithCSS", false, "false");
}

/**
 * Aplica una fuente a la selección.
 */
export function applyFontFamily(family: string): void {
  document.execCommand("styleWithCSS", false, "true");
  applyFormatToSelection("fontName", family);
  document.execCommand("styleWithCSS", false, "false");
}

/**
 * Aplica un tamaño de fuente a la selección.
 */
export function applyFontSize(size: string): void {
  document.execCommand("styleWithCSS", false, "true");
  applyFormatToSelection("fontSize", size);
  document.execCommand("styleWithCSS", false, "false");
}

/**
 * Inserta un enlace en la selección actual.
 */
export function insertLink(href: string): void {
  applyFormatToSelection("createLink", href);
  // Después de crear el enlace, agregar target="_blank"
  const sel = window.getSelection();
  if (sel && sel.anchorNode) {
    let node: Node | null = sel.anchorNode;
    while (node && node.nodeName !== "A") {
      node = node.parentNode;
    }
    if (node instanceof HTMLAnchorElement) {
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  }
  // Re-parsear
  const blockId = getFocusedBlockId();
  if (!blockId) return;
  const element = findContentEditableForBlock(blockId);
  if (!element) return;
  const newChildren = parseContentEditable(element);
  const store = useEditorStore.getState();
  const block = store.document.blocks.find((b) => b.id === blockId);
  if (!block || !("children" in block)) return;
  const oldChildren = (block as { children: InlineContent[] }).children;
  store.executeCommand(
    new GenericCommand(
      (d) => updateBlockChildrenInDoc(d, blockId, newChildren),
      (d) => updateBlockChildrenInDoc(d, blockId, oldChildren),
      "Insertar enlace"
    )
  );
}

/**
 * Quita todo el formato de la selección.
 */
export function removeFormat(): void {
  applyFormatToSelection("removeFormat");
}

// ─── Helpers internos ───

function findContentEditableForBlock(blockId: string): HTMLElement | null {
  const elements = document.querySelectorAll(".ee-inline-text");
  for (const el of elements) {
    if (el instanceof HTMLElement && el.dataset.blockId === blockId) {
      return el;
    }
  }
  return null;
}

function updateBlockChildrenInDoc(
  doc: EmailDocument,
  blockId: string,
  children: InlineContent[]
): EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id === blockId && "children" in b) {
        return { ...b, children } as Block;
      }
      // Buscar en bloques anidados (columns, container, table cells, signature)
      if ("blocks" in b && Array.isArray((b as { blocks: Block[] }).blocks)) {
        return {
          ...b,
          blocks: (b as { blocks: Block[] }).blocks.map(updateNestedBlock(blockId, children)),
        } as Block;
      }
      if ("columns" in b) {
        const columnsBlock = b as { columns: { id: string; blocks: Block[] }[] };
        return {
          ...b,
          columns: columnsBlock.columns.map((col) => ({
            ...col,
            blocks: col.blocks.map(updateNestedBlock(blockId, children)),
          })),
        } as Block;
      }
      if ("rows" in b) {
        const tableBlock = b as { rows: { id: string; cells: { id: string; children: Block[] }[] }[] };
        return {
          ...b,
          rows: tableBlock.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({
              ...cell,
              children: cell.children.map(updateNestedBlock(blockId, children)),
            })),
          })),
        } as Block;
      }
      return b;
    }),
  };
}

function updateNestedBlock(blockId: string, children: InlineContent[]) {
  return (b: Block): Block => {
    if (b.id === blockId && "children" in b) {
      return { ...b, children } as Block;
    }
    return b;
  };
}
