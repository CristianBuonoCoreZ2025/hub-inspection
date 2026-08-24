/**
 * InlineText — componente para editar texto inline dentro de un bloque.
 *
 * Usa contentEditable para la edición nativa del navegador.
 * Sincroniza el texto con el modelo JSON del documento.
 *
 * Las marcas (bold, italic, etc.) se aplican via comandos, no via document.execCommand.
 * El contentEditable solo maneja el texto plano + el renderizado visual de marcas.
 */

"use client";

import { useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import type { InlineContent, TextMark } from "../core/types";
import { useEditorStore } from "../store/editor-store";
import { createTextNode } from "../core/document-model";

interface InlineTextProps {
  blockId: string;
  content: InlineContent[];
  onUpdate: (children: InlineContent[]) => void;
  placeholder?: string;
}

export function InlineText({ blockId, content, onUpdate, placeholder }: InlineTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const variables = useEditorStore((s) => s.variables);

  // Mapa de key → label para mostrar nombres legibles
  const varLabelMap = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    variables.forEach((v) => map.set(v.key, v.label));
    varLabelMap.current = map;
  }, [variables]);

  // Sincronizar el contenido del DOM con el modelo JSON
  // Solo cuando el modelo cambia externamente (no mientras se edita)
  // Inicializamos con "" para que el primer render SIEMPRE pinte el contenido
  const lastChildrenRef = useRef<string>("");

  useEffect(() => {
    const current = JSON.stringify(content);
    if (current !== lastChildrenRef.current && ref.current) {
      lastChildrenRef.current = current;
      // Re-renderizar el contenido desde el modelo
      const html = content.map((node) => renderToHtmlString(node, varLabelMap.current)).join("");
      ref.current.innerHTML = html;
    }
  }, [content, varLabelMap]);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    // Convertir el HTML del contentEditable de vuelta a InlineContent[]
    const newChildren = parseContentEditable(ref.current);
    lastChildrenRef.current = JSON.stringify(newChildren);
    onUpdate(newChildren);
  }, [onUpdate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Atajos de teclado compatibles con Outlook
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "b") {
          e.preventDefault();
          document.execCommand("bold");
          handleInput();
        } else if (key === "i") {
          e.preventDefault();
          document.execCommand("italic");
          handleInput();
        } else if (key === "u") {
          e.preventDefault();
          document.execCommand("underline");
          handleInput();
        } else if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          useEditorStore.getState().undo();
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          useEditorStore.getState().redo();
        } else if (key === "a") {
          // Ctrl+A → seleccionar todos los bloques del documento (estilo Word)
          e.preventDefault();
          useEditorStore.getState().selectAllBlocks();
        }
      }
    },
    [handleInput]
  );

  const handleFocus = () => {
    selectBlock(blockId);
  };

  const isEmpty = content.length === 0 || (content.length === 1 && content[0].type === "text" && content[0].text === "");

  return (
    <div
      ref={ref}
      className="ee-inline-text"
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      data-block-id={blockId}
      data-placeholder={isEmpty ? (placeholder ?? "Escribe aquí...") : undefined}
    />
  );
}

// ─── Helpers ───

/**
 * Convierte el contenido de un contentEditable de vuelta a InlineContent[].
 * Recorre los nodos del DOM y reconstruye el modelo JSON.
 */
export function parseContentEditable(element: HTMLElement): InlineContent[] {
  const result: InlineContent[] = [];
  element.childNodes.forEach((node) => {
    const parsed = parseDomNode(node, []);
    if (parsed) result.push(...parsed);
  });
  return result.length > 0 ? result : [createTextNode("")];
}

function parseDomNode(node: Node, inheritedMarks: TextMark[]): InlineContent[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text === "") return null;
    return [createTextNode(text, inheritedMarks.length > 0 ? inheritedMarks : undefined)];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const marks = [...inheritedMarks];
  const tag = el.tagName.toLowerCase();

  // Detectar marcas por tag
  if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
  else if (tag === "em" || tag === "i") marks.push({ type: "italic" });
  else if (tag === "u") marks.push({ type: "underline" });
  else if (tag === "s" || tag === "strike" || tag === "del") marks.push({ type: "strike" });
  else if (tag === "sup") marks.push({ type: "sup" });
  else if (tag === "sub") marks.push({ type: "sub" });
  else if (tag === "a") {
    const href = el.getAttribute("href") ?? "#";
    marks.push({ type: "link", href, target: el.getAttribute("target") ?? undefined });
  } else if (el.classList.contains("ee-mark-color")) {
    marks.push({ type: "color", color: el.dataset.color ?? "#000000" });
  } else if (el.classList.contains("ee-mark-highlight")) {
    marks.push({ type: "highlight", color: el.dataset.highlight ?? "#ffff00" });
  } else if (el.classList.contains("ee-mark-fontsize")) {
    marks.push({ type: "fontSize", size: el.dataset.size ?? "14px" });
  } else if (el.classList.contains("ee-mark-fontfamily")) {
    marks.push({ type: "fontFamily", family: el.dataset.family ?? "Arial" });
  } else if (el.classList.contains("ee-variable-chip")) {
    const variable = el.dataset.variable ?? "";
    return [{ type: "variable", variable }];
  }

  // Recorrer hijos
  const children: InlineContent[] = [];
  el.childNodes.forEach((child) => {
    const parsed = parseDomNode(child, marks);
    if (parsed) children.push(...parsed);
  });
  return children.length > 0 ? children : null;
}

/**
 * Convierte un InlineContent a string HTML para inyectar en el contentEditable.
 * Las variables se muestran con su label legible: «Cliente» en vez de {{cliente}}.
 */
function renderToHtmlString(node: InlineContent, varLabels?: Map<string, string>): string {
  if (node.type === "variable") {
    const label = varLabels?.get(node.variable) ?? node.variable;
    const display = normalizeLabel(label);
    return `<span class="ee-variable-chip" contenteditable="false" data-variable="${node.variable}">«${escapeHtml(display)}»</span>`;
  }

  let html = escapeHtml(node.text);
  const marks = node.marks ?? [];

  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i];
    html = markToHtml(mark, html);
  }

  return html;
}

function markToHtml(mark: TextMark, content: string): string {
  switch (mark.type) {
    case "bold": return `<strong>${content}</strong>`;
    case "italic": return `<em>${content}</em>`;
    case "underline": return `<u>${content}</u>`;
    case "strike": return `<s>${content}</s>`;
    case "link": return `<a href="${mark.href}" target="${mark.target ?? "_blank"}">${content}</a>`;
    case "color": return `<span class="ee-mark-color" data-color="${mark.color}">${content}</span>`;
    case "highlight": return `<span class="ee-mark-highlight" data-highlight="${mark.color}">${content}</span>`;
    case "fontSize": return `<span class="ee-mark-fontsize" data-size="${mark.size}">${content}</span>`;
    case "fontFamily": return `<span class="ee-mark-fontfamily" data-family="${mark.family}">${content}</span>`;
    case "sup": return `<sup>${content}</sup>`;
    case "sub": return `<sub>${content}</sub>`;
    default: return content;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Normaliza el label de una variable:
 * - Capitaliza la primera letra de cada palabra
 * - Elimina espacios extra
 * - Elimina guiones bajos (cliente_nombre → Cliente Nombre)
 */
function normalizeLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
