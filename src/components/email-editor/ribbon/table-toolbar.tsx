/**
 * TableToolbar — toolbar contextual para tablas.
 *
 * Aparece cuando una tabla está seleccionada.
 * Permite agregar/eliminar filas y columnas.
 */

"use client";

import { useEditorStore } from "../store/editor-store";
import { GenericCommand } from "../core/commands";
import { addTableRow, addTableColumn, removeTableRow, removeTableColumn } from "../core/document-model";
import type { TableBlock, Block } from "../core/types";
import { Plus, Trash2, Rows3, Columns3 } from "lucide-react";

export function TableToolbar() {
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const executeCommand = useEditorStore((s) => s.executeCommand);

  const block = document.blocks.find((b) => b.id === selection.blockId);
  if (!block || block.type !== "table") return null;

  const table = block as TableBlock;
  const rowCount = table.rows.length;
  const colCount = table.rows[0]?.cells.length ?? 0;

  const updateTable = (newTable: TableBlock, oldTable: TableBlock, description: string) => {
    executeCommand(
      new GenericCommand(
        (doc) => updateBlockInDoc(doc, table.id, newTable as unknown as Partial<Block>),
        (doc) => updateBlockInDoc(doc, table.id, oldTable as unknown as Partial<Block>),
        description
      )
    );
  };

  const handleAddRow = () => {
    const newTable = addTableRow(table);
    updateTable(newTable, table, "Agregar fila");
  };

  const handleAddColumn = () => {
    const newTable = addTableColumn(table);
    updateTable(newTable, table, "Agregar columna");
  };

  const handleRemoveRow = () => {
    if (rowCount <= 1) return;
    const newTable = removeTableRow(table, rowCount - 1);
    updateTable(newTable, table, "Eliminar fila");
  };

  const handleRemoveColumn = () => {
    if (colCount <= 1) return;
    const newTable = removeTableColumn(table, colCount - 1);
    updateTable(newTable, table, "Eliminar columna");
  };

  return (
    <div className="ee-table-toolbar">
      <span className="ee-table-toolbar-label">Tabla {rowCount}×{colCount}</span>
      <button type="button" className="ee-table-toolbar-btn" title="Agregar fila" onMouseDown={(e) => e.preventDefault()} onClick={handleAddRow}>
        <Rows3 className="ee-table-toolbar-icon" />
        <Plus className="ee-table-toolbar-plus" />
      </button>
      <button type="button" className="ee-table-toolbar-btn" title="Agregar columna" onMouseDown={(e) => e.preventDefault()} onClick={handleAddColumn}>
        <Columns3 className="ee-table-toolbar-icon" />
        <Plus className="ee-table-toolbar-plus" />
      </button>
      <button type="button" className="ee-table-toolbar-btn ee-table-toolbar-danger" title="Eliminar fila" onMouseDown={(e) => e.preventDefault()} onClick={handleRemoveRow} disabled={rowCount <= 1}>
        <Rows3 className="ee-table-toolbar-icon" />
        <Trash2 className="ee-table-toolbar-minus" />
      </button>
      <button type="button" className="ee-table-toolbar-btn ee-table-toolbar-danger" title="Eliminar columna" onMouseDown={(e) => e.preventDefault()} onClick={handleRemoveColumn} disabled={colCount <= 1}>
        <Columns3 className="ee-table-toolbar-icon" />
        <Trash2 className="ee-table-toolbar-minus" />
      </button>
    </div>
  );
}

function updateBlockInDoc(
  doc: import("../core/types").EmailDocument,
  blockId: string,
  patch: Partial<Block>
): import("../core/types").EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id === blockId) return { ...b, ...patch } as Block;
      return b;
    }),
  };
}
