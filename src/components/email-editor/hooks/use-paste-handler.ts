/**
 * PasteHandler — intercepta el pegado y convierte HTML a bloques del documento.
 *
 * Siempre intercepta cuando hay HTML en el portapapeles (no solo de Word).
 * Limpia el HTML, lo convierte a bloques JSON y los inserta en la posición
 * del cursor.
 *
 * Si no hay HTML (solo texto plano), lo inserta directamente en la selección.
 */

"use client";

import { useCallback, useEffect } from "react";
import { useEditorStore } from "../store/editor-store";
import { GenericCommand, InsertBlockCommand } from "../core/commands";
import { createParagraph, createTextNode } from "../core/document-model";
import type { Block, InlineContent, TextMark } from "../core/types";

export function usePasteHandler() {
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const showPreview = useEditorStore((s) => s.showPreview);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const html = e.clipboardData?.getData("text/html");
      const text = e.clipboardData?.getData("text/plain") ?? "";

      console.log("[paste] html length:", html?.length ?? 0, "text length:", text.length);

      // Si no hay HTML ni texto, no hacer nada
      if (!html && !text) return;

      // Si hay HTML, siempre interceptar y convertir a bloques
      if (html && html.trim()) {
        e.preventDefault();

        const cleaned = cleanHtml(html);
        const blocks = htmlToBlocks(cleaned);

        if (blocks.length === 0) {
          // El HTML no produjo bloques: fallback a texto plano
          insertTextAtCursor(text, e);
          return;
        }

        // Determinar posición de inserción: después del bloque seleccionado
        const doc = useEditorStore.getState().document;
        const sel = useEditorStore.getState().selection;
        const insertIndex = sel.blockId
          ? doc.blocks.findIndex((b) => b.id === sel.blockId) + 1
          : doc.blocks.length;

        executeCommand(
          new GenericCommand(
            (d) => {
              const newBlocks = [...d.blocks];
              newBlocks.splice(insertIndex, 0, ...blocks);
              return { ...d, blocks: newBlocks };
            },
            (d) => d,
            `Pegar ${blocks.length} bloque(s)`
          )
        );
        return;
      }

      // Solo texto plano: insertar en la selección del contentEditable
      if (text) {
        e.preventDefault();
        insertTextAtCursor(text, e);
      }
    },
    [executeCommand]
  );

  // Adjuntar listener al window (el evento paste burbujea desde los contentEditable)
  useEffect(() => {
    if (showPreview) return;

    const handler = (e: ClipboardEvent) => {
      // Solo procesar si el paste ocurre dentro del editor
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const editor = target.closest(".ee-editor");
      if (!editor) return;

      handlePaste(e);
    };

    window.document.addEventListener("paste", handler, true); // capture: true para interceptar antes
    return () => {
      window.document.removeEventListener("paste", handler, true);
    };
  }, [handlePaste, showPreview]);
}

// ─── Insertar texto plano en el cursor ───

function insertTextAtCursor(text: string, e: ClipboardEvent) {
  if (!text) return;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    // Dividir por líneas y crear <br> entre ellas
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) range.insertNode(window.document.createElement("br"));
      range.insertNode(window.document.createTextNode(line));
    });
    range.collapse(false);
    const target = e.target as HTMLElement;
    target?.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } else {
    const doc = useEditorStore.getState().document;
    const para = createParagraph(text);
    executeCommandFromStore(para, doc.blocks.length);
  }
}

function executeCommandFromStore(block: Block, index: number) {
  useEditorStore.getState().executeCommand(new InsertBlockCommand(block, index));
}

// ─── Limpieza de HTML ───

function cleanHtml(html: string): string {
  let cleaned = html;

  // Eliminar comentarios condicionales de Outlook
  cleaned = cleaned.replace(/<!--\[if[\s\S]*?endif\]-->/gi, "");
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Eliminar etiquetas <style>
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Eliminar namespaces de Office
  cleaned = cleaned.replace(/<\/?o:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?v:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?w:[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?m:[^>]*>/gi, "");

  // Eliminar clases de Word
  cleaned = cleaned.replace(/ class="Mso[^"]*"/gi, "");

  // Limpiar estilos inline: quitar mso-*
  cleaned = cleaned.replace(/ style="([^"]*)"/gi, (_match, style: string) => {
    const cleanedStyle = style
      .split(";")
      .filter((s: string) => {
        const prop = s.trim().toLowerCase();
        if (prop.startsWith("mso-")) return false;
        if (prop.startsWith("tab-interval")) return false;
        if (prop.startsWith("font-size-adjust")) return false;
        if (prop.startsWith("font-stretch")) return false;
        return true;
      })
      .join(";");
    if (cleanedStyle.trim()) {
      return ` style="${cleanedStyle}"`;
    }
    return "";
  });

  // Eliminar spans vacíos
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, "");

  // Eliminar &nbsp; innecesarios
  cleaned = cleaned.replace(/(&nbsp;){2,}/g, " ");

  return cleaned;
}

// ─── Conversión HTML → bloques ───

let pasteIdCounter = 0;
function nextPasteId(prefix: string): string {
  pasteIdCounter += 1;
  return `${prefix}_paste_${pasteIdCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

function htmlToBlocks(html: string): Block[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blocks: Block[] = [];
  collectBlocks(doc.body, blocks);

  // Filtrar bloques vacíos consecutivos
  const filtered: Block[] = [];
  for (const block of blocks) {
    if (isEmptyBlock(block) && filtered.length > 0 && isEmptyBlock(filtered[filtered.length - 1])) {
      continue;
    }
    filtered.push(block);
  }
  return filtered;
}

function isEmptyBlock(block: Block): boolean {
  if (block.type !== "paragraph") return false;
  const children = (block as { children?: InlineContent[] }).children;
  if (!children || children.length === 0) return true;
  return children.every((c) => c.type === "text" && c.text.trim() === "");
}

function collectBlocks(node: Node, blocks: Block[]): void {
  node.childNodes.forEach((child) => {
    const result = domNodeToBlock(child);
    if (result) {
      if (Array.isArray(result)) {
        blocks.push(...result);
      } else {
        blocks.push(result);
      }
    }
  });
}

function domNodeToBlock(node: Node): Block | Block[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";
    if (!text) return null;
    return {
      id: nextPasteId("blk"),
      type: "paragraph",
      children: [createTextNode(text)],
    } as Block;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Tabla de layout (role="presentation") → atravesar
  if (tag === "table" && el.getAttribute("role") === "presentation") {
    const inner: Block[] = [];
    const tds = el.querySelectorAll("td");
    tds.forEach((td) => {
      const hasInnerLayoutTable = td.querySelector('table[role="presentation"]');
      if (!hasInnerLayoutTable) {
        const tdBlocks: Block[] = [];
        collectBlocks(td, tdBlocks);
        inner.push(...tdBlocks);
      }
    });
    if (inner.length === 0) collectBlocks(el, inner);
    return inner.length > 0 ? inner : null;
  }

  // Párrafo
  if (tag === "p") {
    const children = parseInlineContent(el);
    if (children.length === 1 && children[0].type === "text" && children[0].text.trim() === "") {
      return null;
    }
    return {
      id: nextPasteId("blk"),
      type: "paragraph",
      children: children.length > 0 ? children : [createTextNode("")],
      alignment: getAlignment(el),
    } as Block;
  }

  // Títulos
  if (tag.match(/^h[1-6]$/)) {
    const level = parseInt(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    const children = parseInlineContent(el);
    return {
      id: nextPasteId("blk"),
      type: "heading",
      level,
      children: children.length > 0 ? children : [createTextNode("")],
      alignment: getAlignment(el),
    } as Block;
  }

  // Listas
  if (tag === "ul" || tag === "ol") {
    const items: { id: string; children: InlineContent[] }[] = [];
    const liList = Array.from(el.querySelectorAll(":scope > li")) as HTMLElement[];
    liList.forEach((li) => {
      items.push({
        id: nextPasteId("li"),
        children: parseInlineContent(li),
      });
    });
    if (items.length === 0) return null;
    return {
      id: nextPasteId("blk"),
      type: "list",
      ordered: tag === "ol",
      items,
    } as Block;
  }

  // Tabla de datos
  if (tag === "table") {
    return parseTable(el);
  }

  // Div genérico → recorrer hijos recursivamente
  if (tag === "div" || tag === "section" || tag === "article" || tag === "main") {
    const inner: Block[] = [];
    collectBlocks(el, inner);
    return inner.length > 0 ? inner : null;
  }

  // Span con texto directo → párrafo
  if (tag === "span") {
    const children = parseInlineContent(el);
    if (children.length > 0 && children.some((c) => c.type === "text" && c.text.trim())) {
      return {
        id: nextPasteId("blk"),
        type: "paragraph",
        children,
      } as Block;
    }
    return null;
  }

  // Br → ignorar
  if (tag === "br") return null;

  // Imagen
  if (tag === "img") {
    const src = el.getAttribute("src") ?? "";
    if (!src) return null;
    return {
      id: nextPasteId("blk"),
      type: "image",
      src,
      alt: el.getAttribute("alt") ?? "",
      alignment: "center",
    } as Block;
  }

  // HR → divisor
  if (tag === "hr") {
    return {
      id: nextPasteId("blk"),
      type: "divider",
    } as Block;
  }

  // Elementos inline sueltos (strong, em, a, font) → párrafo
  if (["strong", "b", "em", "i", "u", "s", "a", "font"].includes(tag)) {
    const children = parseInlineContent(el);
    if (children.length > 0 && children.some((c) => c.type === "text" && c.text.trim())) {
      return {
        id: nextPasteId("blk"),
        type: "paragraph",
        children,
      } as Block;
    }
  }

  // Cualquier otro elemento → recorrer hijos
  const inner: Block[] = [];
  collectBlocks(el, inner);
  return inner.length > 0 ? inner : null;
}

// ─── Helpers ───

function getAlignment(el: HTMLElement): "left" | "center" | "right" | "justify" {
  const style = el.getAttribute("style") ?? "";
  const alignMatch = style.match(/text-align:\s*(left|center|right|justify)/i);
  if (alignMatch) return alignMatch[1].toLowerCase() as "left" | "center" | "right" | "justify";
  const alignAttr = el.getAttribute("align");
  if (alignAttr) return alignAttr as "left" | "center" | "right" | "justify";
  return "left";
}

function parseInlineContent(el: Element): InlineContent[] {
  const result: InlineContent[] = [];
  el.childNodes.forEach((node) => {
    const parsed = parseInlineNode(node, []);
    if (parsed) result.push(...parsed);
  });
  return result.length > 0 ? result : [createTextNode("")];
}

function parseInlineNode(node: Node, inheritedMarks: TextMark[]): InlineContent[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text === "" || (!text.trim() && !text.includes("\n"))) return null;
    return [createTextNode(text, inheritedMarks.length > 0 ? inheritedMarks : undefined)];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const marks = [...inheritedMarks];
  const tag = el.tagName.toLowerCase();

  if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
  else if (tag === "em" || tag === "i") marks.push({ type: "italic" });
  else if (tag === "u") marks.push({ type: "underline" });
  else if (tag === "s" || tag === "strike" || tag === "del") marks.push({ type: "strike" });
  else if (tag === "sup") marks.push({ type: "sup" });
  else if (tag === "sub") marks.push({ type: "sub" });
  else if (tag === "a") {
    marks.push({ type: "link", href: el.getAttribute("href") ?? "#", target: el.getAttribute("target") ?? undefined });
  }

  // Detectar color y font-size desde estilos inline
  const style = el.getAttribute("style") ?? "";
  const colorMatch = style.match(/(?<![a-z-])color:\s*(#[0-9a-f]{3,6}|rgb\([^)]+\))/i);
  if (colorMatch) marks.push({ type: "color", color: colorMatch[1] });

  const bgMatch = style.match(/background-color:\s*(#[0-9a-f]{3,6}|rgb\([^)]+\))/i);
  if (bgMatch) marks.push({ type: "highlight", color: bgMatch[1] });

  const sizeMatch = style.match(/font-size:\s*(\d+px)/i);
  if (sizeMatch) marks.push({ type: "fontSize", size: sizeMatch[1] });

  // br dentro de inline → separar con \n
  if (tag === "br") {
    return [createTextNode("\n")];
  }

  const children: InlineContent[] = [];
  el.childNodes.forEach((child) => {
    const parsed = parseInlineNode(child, marks);
    if (parsed) children.push(...parsed);
  });
  return children.length > 0 ? children : null;
}

function parseTable(tableEl: HTMLElement): Block {
  const rows: { id: string; cells: { id: string; children: Block[]; header?: boolean }[]; header?: boolean }[] = [];
  const trList = Array.from(tableEl.querySelectorAll("tr")) as HTMLElement[];

  trList.forEach((tr, rowIndex) => {
    const cells: { id: string; children: Block[]; header?: boolean }[] = [];
    const cellEls = Array.from(tr.querySelectorAll("td, th")) as HTMLElement[];
    cellEls.forEach((cell) => {
      const isHeader = cell.tagName.toLowerCase() === "th";
      const cellBlocks: Block[] = [];
      collectBlocks(cell, cellBlocks);
      cells.push({
        id: nextPasteId("cell"),
        children: cellBlocks.length > 0 ? cellBlocks : [createParagraph()],
        header: isHeader,
      });
    });
    if (cells.length > 0) {
      rows.push({
        id: nextPasteId("row"),
        cells,
        header: rowIndex === 0,
      });
    }
  });

  return {
    id: nextPasteId("blk"),
    type: "table",
    rows,
    borderWidth: 1,
    borderColor: "#cccccc",
    cellPadding: 8,
    cellSpacing: 0,
    width: "100%",
  } as Block;
}
