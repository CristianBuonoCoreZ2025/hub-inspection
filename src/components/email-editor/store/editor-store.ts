/**
 * Store principal del editor de email — Zustand con slices.
 *
 * Slices:
 *   document  — el documento JSON (fuente de verdad)
 *   selection — bloque seleccionado, celda seleccionada, cursor
 *   history   — undo/redo via Command + HistoryManager
 *   clipboard — copiar/pegar bloques
 *   ui        — modo (compose/template/reply/forward), zoom, preview, panels
 *
 * Cada acción pasa por el HistoryManager (excepto selección y UI).
 * El documento JSON es la única fuente de verdad.
 */

import { create } from "zustand";
import type { EmailDocument, Block, EditorMode, EditorLayout, VariableDefinition } from "../core/types";
import { createEmptyDocument, serializeToJson, deserializeFromJson } from "../core/document-model";
import { HistoryManager } from "../core/history";
import { Command, InsertBlockCommand } from "../core/commands";

// ─── Tipos de selección ───

export interface SelectionState {
  blockId: string | null;
  cellId: string | null; // celda de tabla seleccionada
  selectedBlockIds: string[]; // selección múltiple (Shift+click)
  // TODO: selección de texto inline (offsets) en etapa 2 avanzada
}

// ─── Estado del store ───

interface EditorStore {
  // ─── Document slice ───
  document: EmailDocument;
  setDocument: (doc: EmailDocument) => void;
  executeCommand: (command: Command) => void;

  // ─── History slice ───
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undo: () => void;
  redo: () => void;

  // ─── Selection slice ───
  selection: SelectionState;
  selectBlock: (blockId: string | null) => void;
  selectBlocks: (blockIds: string[]) => void;
  selectAllBlocks: () => void;
  selectCell: (cellId: string | null) => void;

  // ─── Clipboard slice ───
  clipboard: Block | null;
  copyBlock: (blockId: string) => void;
  pasteBlock: (index: number) => void;
  hasClipboard: boolean;

  // ─── UI slice ───
  mode: EditorMode;
  layout: EditorLayout;
  zoom: number;
  showPreview: boolean;
  showInspector: boolean;
  showStructure: boolean;
  variables: VariableDefinition[];
  setMode: (mode: EditorMode) => void;
  setLayout: (layout: EditorLayout) => void;
  setZoom: (zoom: number) => void;
  togglePreview: () => void;
  toggleInspector: () => void;
  toggleStructure: () => void;
  setVariables: (variables: VariableDefinition[]) => void;

  // ─── Export ───
  getJson: () => string;
  loadJson: (json: string) => void;
}

// ─── Instancia del historial (fuera del estado para no serializar) ───

const history = new HistoryManager(100);

// ─── Store ───

export const useEditorStore = create<EditorStore>((set, get) => ({
  // ─── Document slice ───
  document: createEmptyDocument(),

  setDocument: (doc) => {
    console.log("[store] setDocument, blocks:", doc.blocks.length, "ids:", doc.blocks.map((b) => b.id).slice(0, 3));
    history.clear();
    set({ document: doc, canUndo: false, canRedo: false });
  },

  executeCommand: (command) => {
    const doc = get().document;
    const newDoc = history.execute(doc, command);
    set({
      document: newDoc,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      undoDescription: history.undoDescription(),
      redoDescription: history.redoDescription(),
    });
  },

  // ─── History slice ───
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,

  undo: () => {
    const doc = get().document;
    const newDoc = history.undo(doc);
    set({
      document: newDoc,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      undoDescription: history.undoDescription(),
      redoDescription: history.redoDescription(),
    });
  },

  redo: () => {
    const doc = get().document;
    const newDoc = history.redo(doc);
    set({
      document: newDoc,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      undoDescription: history.undoDescription(),
      redoDescription: history.redoDescription(),
    });
  },

  // ─── Selection slice ───
  selection: { blockId: null, cellId: null, selectedBlockIds: [] },

  selectBlock: (blockId) => {
    set({ selection: { blockId, cellId: null, selectedBlockIds: blockId ? [blockId] : [] } });
  },

  selectBlocks: (blockIds) => {
    set({ selection: { blockId: blockIds[0] ?? null, cellId: null, selectedBlockIds: blockIds } });
  },

  selectAllBlocks: () => {
    const { document: doc } = get();
    const allIds = doc.blocks.map((b) => b.id);
    set({ selection: { blockId: allIds[0] ?? null, cellId: null, selectedBlockIds: allIds } });
  },

  selectCell: (cellId) => {
    set((state) => ({ selection: { ...state.selection, cellId } }));
  },

  // ─── Clipboard slice ───
  clipboard: null,
  hasClipboard: false,

  copyBlock: (blockId) => {
    const doc = get().document;
    const block = doc.blocks.find((b) => b.id === blockId);
    if (block) {
      // Deep clone para que el pegado sea independiente
      set({ clipboard: JSON.parse(JSON.stringify(block)), hasClipboard: true });
    }
  },

  pasteBlock: (index) => {
    const { clipboard, executeCommand } = get();
    if (!clipboard) return;
    // Generar nuevo ID para el bloque pegado
    const newBlock = JSON.parse(JSON.stringify(clipboard)) as Block;
    newBlock.id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    executeCommand(new InsertBlockCommand(newBlock, index));
  },

  // ─── UI slice ───
  mode: "compose" as EditorMode,
  layout: "legacy" as EditorLayout,
  zoom: 100,
  showPreview: false,
  showInspector: true,
  showStructure: false,
  variables: [],

  setMode: (mode) => set({ mode }),
  setLayout: (layout) => set({ layout }),
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),
  togglePreview: () => set((s) => ({ showPreview: !s.showPreview })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
  toggleStructure: () => set((s) => ({ showStructure: !s.showStructure })),
  setVariables: (variables) => set({ variables }),

  // ─── Export ───
  getJson: () => serializeToJson(get().document),

  loadJson: (json) => {
    try {
      const doc = deserializeFromJson(json);
      get().setDocument(doc);
    } catch (e) {
      console.error("Error al cargar JSON:", e);
    }
  },
}));
