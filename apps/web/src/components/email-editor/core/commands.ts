/**
 * Command Engine — patrón Command para todas las operaciones del editor.
 *
 * Cada acción del editor es un comando con execute() y undo().
 * El historial se construye sobre comandos, no sobre copias del estado.
 *
 * Flujo:
 *   Click en toolbar
 *     → crea un Command
 *     → command.execute(doc) → nuevo doc
 *     → history.push(command)
 *     → React re-renderiza
 *
 * Undo:
 *   → history.pop()
 *   → command.undo(doc) → doc anterior
 *
 * Redo:
 *   → history.redo()
 *   → command.execute(doc) → doc siguiente
 */

import type { EmailDocument, Block } from "./types";

export interface Command {
  /** Ejecuta el comando y retorna el nuevo documento */
  execute(doc: EmailDocument): EmailDocument;
  /** Deshace el comando y retorna el documento anterior */
  undo(doc: EmailDocument): EmailDocument;
  /** Descripción legible para el historial */
  description: string;
}

// ─── Comandos básicos ───

import {
  insertBlock,
  removeBlock,
  updateBlock,
  moveBlock,
} from "./document-model";

/**
 * Comando para insertar un bloque.
 */
export class InsertBlockCommand implements Command {
  description: string;
  private block: Block;
  private index: number;

  constructor(block: Block, index: number) {
    this.block = block;
    this.index = index;
    this.description = `Insertar ${block.type}`;
  }

  execute(doc: EmailDocument): EmailDocument {
    return insertBlock(doc, this.block, this.index);
  }

  undo(doc: EmailDocument): EmailDocument {
    return removeBlock(doc, this.block.id);
  }
}

/**
 * Comando para eliminar un bloque.
 */
export class RemoveBlockCommand implements Command {
  description: string;
  private blockId: string;
  private savedBlock: Block | null = null;
  private savedIndex: number = 0;

  constructor(blockId: string) {
    this.blockId = blockId;
    this.description = "Eliminar bloque";
  }

  execute(doc: EmailDocument): EmailDocument {
    const block = doc.blocks.find((b) => b.id === this.blockId);
    if (block) {
      this.savedBlock = block;
      this.savedIndex = doc.blocks.indexOf(block);
    }
    return removeBlock(doc, this.blockId);
  }

  undo(doc: EmailDocument): EmailDocument {
    if (!this.savedBlock) return doc;
    return insertBlock(doc, this.savedBlock, this.savedIndex);
  }
}

/**
 * Comando para actualizar un bloque (patch parcial).
 */
export class UpdateBlockCommand implements Command {
  description: string;
  private blockId: string;
  private patch: Partial<Block>;
  private oldBlock: Block | null = null;

  constructor(blockId: string, patch: Partial<Block>, description = "Actualizar bloque") {
    this.blockId = blockId;
    this.patch = patch;
    this.description = description;
  }

  execute(doc: EmailDocument): EmailDocument {
    const block = doc.blocks.find((b) => b.id === this.blockId);
    if (block) this.oldBlock = { ...block };
    return updateBlock(doc, this.blockId, this.patch);
  }

  undo(doc: EmailDocument): EmailDocument {
    if (!this.oldBlock) return doc;
    return updateBlock(doc, this.blockId, this.oldBlock);
  }
}

/**
 * Comando para mover un bloque.
 */
export class MoveBlockCommand implements Command {
  description = "Mover bloque";
  private fromIndex: number;
  private toIndex: number;

  constructor(fromIndex: number, toIndex: number) {
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  execute(doc: EmailDocument): EmailDocument {
    return moveBlock(doc, this.fromIndex, this.toIndex);
  }

  undo(doc: EmailDocument): EmailDocument {
    return moveBlock(doc, this.toIndex, this.fromIndex);
  }
}

/**
 * Comando genérico que recibe funciones execute y undo.
 * Útil para operaciones complejas que no encajan en un comando específico.
 */
export class GenericCommand implements Command {
  description: string;
  private execFn: (doc: EmailDocument) => EmailDocument;
  private undoFn: (doc: EmailDocument) => EmailDocument;

  constructor(
    execFn: (doc: EmailDocument) => EmailDocument,
    undoFn: (doc: EmailDocument) => EmailDocument,
    description = "Operación"
  ) {
    this.execFn = execFn;
    this.undoFn = undoFn;
    this.description = description;
  }

  execute(doc: EmailDocument): EmailDocument {
    return this.execFn(doc);
  }

  undo(doc: EmailDocument): EmailDocument {
    return this.undoFn(doc);
  }
}
