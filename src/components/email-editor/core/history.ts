/**
 * History Manager — undo/redo basado en comandos.
 *
 * Mantiene dos pilas: una de comandos ejecutados (undo) y otra de
 * comandos deshechos (redo). Cada comando sabe cómo deshacerse a sí mismo.
 *
 * Límite configurable para no consumir memoria infinita.
 */

import type { Command } from "./commands";
import type { EmailDocument } from "./types";

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Ejecuta un comando y lo agrega al historial.
   * Limpia la pila de redo porque las acciones nuevas invalidan el redo.
   */
  execute(doc: EmailDocument, command: Command): EmailDocument {
    const newDoc = command.execute(doc);
    this.undoStack.push(command);
    this.redoStack = [];
    // Mantener el límite
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    return newDoc;
  }

  /**
   * Deshace el último comando ejecutado.
   */
  undo(doc: EmailDocument): EmailDocument {
    const command = this.undoStack.pop();
    if (!command) return doc;
    const newDoc = command.undo(doc);
    this.redoStack.push(command);
    return newDoc;
  }

  /**
   * Rehace el último comando deshecho.
   */
  redo(doc: EmailDocument): EmailDocument {
    const command = this.redoStack.pop();
    if (!command) return doc;
    const newDoc = command.execute(doc);
    this.undoStack.push(command);
    return newDoc;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Devuelve la descripción del último comando (para mostrar en UI).
   */
  undoDescription(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.description ?? null;
  }

  redoDescription(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.description ?? null;
  }

  /**
   * Limpia todo el historial.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
