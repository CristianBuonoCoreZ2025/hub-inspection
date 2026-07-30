/**
 * BlockRenderer — renderiza cada tipo de bloque como un componente React.
 *
 * Cada bloque es un componente independiente.
 * El canvas recorre el array de bloques y renderiza cada uno con BlockRenderer.
 */

"use client";

import type { Block } from "../core/types";
import { useEditorStore } from "../store/editor-store";
import { InlineText } from "./inline-text";
import { GenericCommand } from "../core/commands";
import type { InlineContent } from "../core/types";

interface BlockRendererProps {
  block: Block;
  index: number;
}

export function BlockRenderer({ block, index }: BlockRendererProps) {
  const selection = useEditorStore((s) => s.selection);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const selectBlocks = useEditorStore((s) => s.selectBlocks);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const document = useEditorStore((s) => s.document);
  const isSelected = selection.selectedBlockIds.includes(block.id);

  const handleSelect = (e: React.MouseEvent) => {
    // Shift+click → selección múltiple (rango desde el bloque seleccionado hasta este)
    if (e.shiftKey && selection.blockId) {
      e.preventDefault(); // Evitar que el contentEditable seleccione texto
      const startIndex = document.blocks.findIndex((b) => b.id === selection.blockId);
      const endIndex = index;
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = document.blocks.slice(from, to + 1).map((b) => b.id);
      selectBlocks(rangeIds);
      return;
    }
    selectBlock(block.id);
  };

  // Detectar Shift+click en mousedown, antes de que el contentEditable lo intercepte
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey && selection.blockId) {
      e.preventDefault();
      const startIndex = document.blocks.findIndex((b) => b.id === selection.blockId);
      const endIndex = index;
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = document.blocks.slice(from, to + 1).map((b) => b.id);
      selectBlocks(rangeIds);
    }
  };

  const updateChildren = (children: InlineContent[]) => {
    executeCommand(
      new GenericCommand(
        (doc) => updateBlockInDoc(doc, block.id, { children }),
        (doc) => updateBlockInDoc(doc, block.id, { children: getBlockChildren(block) }),
        "Editar texto"
      )
    );
  };

  switch (block.type) {
    case "paragraph":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className={`ee-block-paragraph ee-align-${block.alignment ?? "left"}`} data-indent={block.indent ?? 0}>
            <InlineText blockId={block.id} content={block.children} onUpdate={updateChildren} placeholder="Escribe aquí..." />
          </div>
        </BlockWrapper>
      );

    case "heading":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className={`ee-block-heading ee-heading-${block.level} ee-align-${block.alignment ?? "left"}`}>
            <InlineText blockId={block.id} content={block.children} onUpdate={updateChildren} placeholder="Título..." />
          </div>
        </BlockWrapper>
      );

    case "list":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <ListBlockView block={block} onUpdate={updateChildren} />
        </BlockWrapper>
      );

    case "table":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <TableView block={block} />
        </BlockWrapper>
      );

    case "image":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className={`ee-block-image ee-align-${block.alignment ?? "center"}`}>
            {block.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagen dinámica de email, no optimizable
              <img src={block.src} alt={block.alt} className="ee-image" />
            ) : (
              <div className="ee-image-placeholder">Imagen sin fuente</div>
            )}
          </div>
        </BlockWrapper>
      );

    case "button":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className={`ee-block-button ee-align-${block.alignment ?? "center"}`}>
            <span className="ee-button-preview">{block.text}</span>
          </div>
        </BlockWrapper>
      );

    case "quote":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <blockquote className="ee-block-quote">
            <InlineText blockId={block.id} content={block.children} onUpdate={updateChildren} placeholder="Cita..." />
          </blockquote>
        </BlockWrapper>
      );

    case "divider":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <hr className="ee-block-divider" />
        </BlockWrapper>
      );

    case "spacer":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-spacer" />
        </BlockWrapper>
      );

    case "columns":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-columns">
            {block.columns.map((col) => (
              <div key={col.id} className="ee-column">
                {col.blocks.map((childBlock, i) => (
                  <BlockRenderer key={childBlock.id} block={childBlock} index={i} />
                ))}
              </div>
            ))}
          </div>
        </BlockWrapper>
      );

    case "container":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-container">
            {block.blocks.map((childBlock, i) => (
              <BlockRenderer key={childBlock.id} block={childBlock} index={i} />
            ))}
          </div>
        </BlockWrapper>
      );

    case "callout":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-callout">
            <InlineText blockId={block.id} content={block.children} onUpdate={updateChildren} placeholder="Nota destacada..." />
          </div>
        </BlockWrapper>
      );

    case "html":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-html" dangerouslySetInnerHTML={{ __html: block.html }} />
        </BlockWrapper>
      );

    case "signature":
      return (
        <BlockWrapper block={block} isSelected={isSelected} onSelect={handleSelect} onMouseDown={handleMouseDown}>
          <div className="ee-block-signature">
            {block.blocks.map((childBlock, i) => (
              <BlockRenderer key={childBlock.id} block={childBlock} index={i} />
            ))}
          </div>
        </BlockWrapper>
      );

    default:
      return null;
  }
}

// ─── Wrapper con selección ───

function BlockWrapper({ block, isSelected, onSelect, onMouseDown, children }: {
  block: Block;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`ee-block-wrapper ${isSelected ? "ee-block-selected" : ""} ${block.locked ? "ee-block-locked" : ""}`}
      onMouseDown={onMouseDown}
      onClick={onSelect}
      data-block-type={block.type}
      data-block-id={block.id}
    >
      {children}
    </div>
  );
}

// ─── Vista de lista ───

function ListBlockView({ block, onUpdate }: { block: import("../core/types").ListBlock; onUpdate: (children: InlineContent[]) => void }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag className="ee-block-list">
      {block.items.map((item) => (
        <li key={item.id}>
          <InlineText blockId={item.id} content={item.children} onUpdate={onUpdate} placeholder="Elemento de lista..." />
        </li>
      ))}
    </Tag>
  );
}

// ─── Vista de tabla ───

function TableView({ block }: { block: import("../core/types").TableBlock }) {
  return (
    <table className="ee-block-table">
      <tbody>
        {block.rows.map((row) => (
          <tr key={row.id} className={row.header ? "ee-table-header-row" : ""}>
            {row.cells.map((cell) => (
              <td
                key={cell.id}
                className="ee-table-cell"
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
              >
                {cell.children.map((childBlock, i) => (
                  <BlockRenderer key={childBlock.id} block={childBlock} index={i} />
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Helper ───

function updateBlockInDoc(
  doc: import("../core/types").EmailDocument,
  blockId: string,
  patch: Record<string, unknown>
): import("../core/types").EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id === blockId) {
        return { ...b, ...patch } as Block;
      }
      // Buscar en bloques anidados (columns, container, signature, table cells)
      if ("blocks" in b && Array.isArray(b.blocks)) {
        return { ...b, blocks: b.blocks.map(updateNested(blockId, patch)) } as Block;
      }
      if ("columns" in b) {
        return {
          ...b,
          columns: b.columns.map((col) => ({
            ...col,
            blocks: col.blocks.map(updateNested(blockId, patch)),
          })),
        } as Block;
      }
      if ("rows" in b) {
        return {
          ...b,
          rows: b.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({
              ...cell,
              children: cell.children.map(updateNested(blockId, patch)),
            })),
          })),
        } as Block;
      }
      return b;
    }),
  };
}

function updateNested(blockId: string, patch: Record<string, unknown>) {
  return (b: Block): Block => {
    if (b.id === blockId) return { ...b, ...patch } as Block;
    return b;
  };
}

function getBlockChildren(block: Block): InlineContent[] {
  if ("children" in block && Array.isArray(block.children)) {
    return block.children as InlineContent[];
  }
  return [];
}
