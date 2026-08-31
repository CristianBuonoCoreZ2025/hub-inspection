/**
 * Canvas — área central de edición.
 *
 * Recorre los bloques del documento y los renderiza con BlockRenderer.
 * Maneja el clic en el área vacía para deseleccionar.
 * Muestra un botón "+" al final para agregar nuevos bloques.
 */

"use client";

import { useEditorStore } from "../store/editor-store";
import { BlockRenderer } from "./block-renderer";
import { createParagraph } from "../core/document-model";
import { InsertBlockCommand } from "../core/commands";
import { Plus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function Canvas() {
  const document = useEditorStore((s) => s.document);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const zoom = useEditorStore((s) => s.zoom);

  const handleAddBlock = () => {
    const newBlock = createParagraph();
    executeCommand(new InsertBlockCommand(newBlock, document.blocks.length));
    selectBlock(newBlock.id);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Solo deseleccionar si se hace clic en el fondo, no en un bloque
    if (e.target === e.currentTarget) {
      selectBlock(null);
    }
  };

  return (
    <div className="ee-canvas-container" onClick={handleBackgroundClick}>
      <div className="ee-canvas-paper" style={{ transform: `scale(${zoom / 100})` }}>
        {document.blocks.map((block, index) => (
          <BlockRenderer key={block.id} block={block} index={index} />
        ))}
        <Tooltip>
          <TooltipTrigger render={
            <button
              type="button"
              className="ee-canvas-add-block"
              onClick={handleAddBlock}
            />
          }>
            <Plus className="ee-canvas-add-icon" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Agregar bloque</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
