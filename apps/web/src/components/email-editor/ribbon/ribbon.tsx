/**
 * Ribbon — barra de herramientas estilo Simplified Outlook 365.
 *
 * Una sola fila, sin labels de grupo. Botones esenciales visibles,
 * botones poco usados en menú overflow (···).
 */

"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { usePrompt } from "@/components/ui/alert-context";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useEditorStore } from "../store/editor-store";
import { GenericCommand, InsertBlockCommand } from "../core/commands";
import {
  createParagraph,
  createHeading,
  createList,
  createTable,
  createImage,
  createDivider,
  createSpacer,
  createColumns,
  createQuote,
} from "../core/document-model";
import type { Block, Alignment, InlineContent } from "../core/types";
import {
  applyFormatToSelection,
  applyTextColor,
  applyHighlightColor,
  applyFontFamily,
  applyFontSize,
  insertLink,
  removeFormat,
  hasMarkInChildren,
} from "../utils/format-utils";
import {
  Bold, Italic, Underline, Strikethrough, Superscript, Subscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent,
  Table, Image, Link2, Minus, Square, Columns2,
  Heading1, Heading2, Heading3, Quote, Type,
  Undo2, Redo2, Plus, Palette, Highlighter, RemoveFormatting,
  Code,
} from "lucide-react";

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const FONT_SIZES = [
  { label: "10", value: "2", key: "fs-10" },
  { label: "12", value: "3", key: "fs-12" },
  { label: "14", value: "4", key: "fs-14" },
  { label: "16", value: "5", key: "fs-16" },
  { label: "18", value: "6", key: "fs-18" },
  { label: "20", value: "6", key: "fs-20" },
  { label: "24", value: "7", key: "fs-24" },
  { label: "28", value: "7", key: "fs-28" },
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ff0000", "#ff9900", "#ffcc00", "#ffff00", "#00ff00", "#00cc66",
  "#0099ff", "#0066cc", "#0000ff", "#6600ff", "#9900ff", "#ff00ff",
];

export function Ribbon() {
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const layout = useEditorStore((s) => s.layout);
  const prompt = usePrompt();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  const selectedBlock = document.blocks.find((b) => b.id === selection.blockId);
  const selectedIndex = document.blocks.findIndex((b) => b.id === selection.blockId);

  // Bloques seleccionados (soporta selección múltiple) — memoizado para
  // evitar re-renders innecesarios y warnings de exhaustive-deps.
  const selectedBlocks = useMemo(
    () =>
      selection.selectedBlockIds.length > 0
        ? selection.selectedBlockIds
            .map((id) => document.blocks.find((b) => b.id === id))
            .filter((b): b is Block => b !== undefined)
        : selectedBlock ? [selectedBlock] : [],
    [selection.selectedBlockIds, document.blocks, selectedBlock]
  );

  // Estado activo de formato para selección múltiple — calculado con useMemo
  // (no se puede usar queryCommandState porque no hay selección nativa).
  const multiBlockActiveFormat = useMemo(() => {
    if (selection.selectedBlockIds.length <= 1) return null;
    const blocksWithChildren = selectedBlocks.filter(
      (b): b is Block & { children: InlineContent[] } => "children" in b
    ) as Array<Block & { children: InlineContent[] }>;
    if (blocksWithChildren.length === 0) return null;
    return {
      bold: blocksWithChildren.every((b) => hasMarkInChildren(b.children, "bold")),
      italic: blocksWithChildren.every((b) => hasMarkInChildren(b.children, "italic")),
      underline: blocksWithChildren.every((b) => hasMarkInChildren(b.children, "underline")),
      strike: blocksWithChildren.every((b) => hasMarkInChildren(b.children, "strike")),
    };
  }, [selection.selectedBlockIds, selectedBlocks]);

  // Para selección simple, suscribirse a selectionchange del navegador
  // usando useSyncExternalStore (patrón React recomendado).
  const nativeFormatJson = useSyncExternalStore(
    subscribeToSelectionChange,
    getNativeFormatSnapshot,
    getNativeFormatServerSnapshot
  );
  const nativeActiveFormat = JSON.parse(nativeFormatJson) as {
    bold: boolean; italic: boolean; underline: boolean; strike: boolean;
  };

  // Estado final: multi-bloque tiene prioridad, si no, selección nativa
  const activeFormat = multiBlockActiveFormat ?? nativeActiveFormat;

  const currentAlignment = selectedBlock && "alignment" in selectedBlock
    ? (selectedBlock as { alignment?: Alignment }).alignment ?? "left"
    : "left";

  const isOffice = layout === "office365";

  const insertAfterSelected = (block: Block) => {
    const index = selectedIndex >= 0 ? selectedIndex + 1 : document.blocks.length;
    executeCommand(new InsertBlockCommand(block, index));
  };

  const setAlignment = (alignment: Alignment) => {
    if (selectedBlocks.length === 0) return;
    // Guardar alineaciones anteriores para undo
    const oldAlignments = selectedBlocks.map((b) => ({
      id: b.id,
      alignment: ("alignment" in b ? (b as { alignment?: Alignment }).alignment : "left") as Alignment | undefined,
    }));
    executeCommand(
      new GenericCommand(
        (doc) => {
          let newDoc = doc;
          selectedBlocks.forEach((b) => {
            if ("alignment" in b) {
              newDoc = updateBlockProp(newDoc, b.id, { alignment });
            }
          });
          return newDoc;
        },
        (doc) => {
          let newDoc = doc;
          oldAlignments.forEach(({ id, alignment: old }) => {
            newDoc = updateBlockProp(newDoc, id, { alignment: old });
          });
          return newDoc;
        },
        `Alinear ${alignment}`
      )
    );
  };

  const setIndent = (delta: number) => {
    if (selectedBlocks.length === 0) return;
    // Guardar sangrías anteriores para undo
    const oldIndents = selectedBlocks.map((b) => ({
      id: b.id,
      indent: ("indent" in b ? (b as { indent?: number }).indent : 0) ?? 0,
    }));
    executeCommand(
      new GenericCommand(
        (doc) => {
          let newDoc = doc;
          selectedBlocks.forEach((b) => {
            if ("indent" in b) {
              const currentIndent = (b as { indent?: number }).indent ?? 0;
              const newIndent = Math.max(0, currentIndent + delta);
              newDoc = updateBlockProp(newDoc, b.id, { indent: newIndent });
            }
          });
          return newDoc;
        },
        (doc) => {
          let newDoc = doc;
          oldIndents.forEach(({ id, indent: old }) => {
            newDoc = updateBlockProp(newDoc, id, { indent: old });
          });
          return newDoc;
        },
        `${delta > 0 ? "Aumentar sangría" : "Disminuir sangría"}`
      )
    );
  };

  return (
    <div className="ee-ribbon">
      {/* Deshacer / Rehacer */}
      <RibbonBtn icon={Undo2} title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
      <RibbonBtn icon={Redo2} title="Rehacer (Ctrl+Y)" onClick={redo} disabled={!canRedo} />

      <RibbonDivider />

      {/* Fuente */}
      <select
        className="ee-ribbon-select ee-font-family-select"
        onChange={(e) => { applyFontFamily(e.target.value); e.target.selectedIndex = 0; }}
        defaultValue=""
        aria-label="Fuente"
      >
        <option value="" disabled>Fuente</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        className="ee-ribbon-select ee-font-size-select"
        onChange={(e) => { applyFontSize(e.target.value); e.target.selectedIndex = 0; }}
        defaultValue=""
        aria-label="Tamaño"
      >
        <option value="" disabled>12</option>
        {FONT_SIZES.map((s) => (
          <option key={s.key} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Color de texto */}
      <div className="ee-color-picker-wrapper">
        <RibbonBtn
          icon={Palette}
          title="Color de texto"
          onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
        />
        {showColorPicker && (
          <>
            <div className="ee-color-picker-overlay" onClick={() => setShowColorPicker(false)} />
            <div className="ee-color-picker-popover">
              <div className="ee-color-picker-grid">
                {TEXT_COLORS.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger className="inline-flex">
                      <button
                        type="button"
                        className="ee-color-swatch"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { applyTextColor(c); setShowColorPicker(false); }}
                      >
                        <span className="ee-color-swatch-inner" style={{ backgroundColor: c }} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{c}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Resaltar */}
      <div className="ee-color-picker-wrapper">
        <RibbonBtn
          icon={Highlighter}
          title="Color de fondo"
          onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
        />
        {showHighlightPicker && (
          <>
            <div className="ee-color-picker-overlay" onClick={() => setShowHighlightPicker(false)} />
            <div className="ee-color-picker-popover">
              <div className="ee-color-picker-grid">
                {TEXT_COLORS.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger className="inline-flex">
                      <button
                        type="button"
                        className="ee-color-swatch"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { applyHighlightColor(c); setShowHighlightPicker(false); }}
                      >
                        <span className="ee-color-swatch-inner" style={{ backgroundColor: c }} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{c}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <RibbonDivider />

      {/* Formato */}
      <RibbonBtn icon={Bold} title="Negrita (Ctrl+B)" onClick={() => applyFormatToSelection("bold")} active={activeFormat.bold} />
      <RibbonBtn icon={Italic} title="Cursiva (Ctrl+I)" onClick={() => applyFormatToSelection("italic")} active={activeFormat.italic} />
      <RibbonBtn icon={Underline} title="Subrayado (Ctrl+U)" onClick={() => applyFormatToSelection("underline")} active={activeFormat.underline} />
      <RibbonBtn icon={Strikethrough} title="Tachado" onClick={() => applyFormatToSelection("strikeThrough")} active={activeFormat.strike} />
      <RibbonBtn icon={Superscript} title="Superíndice" onClick={() => applyFormatToSelection("superscript")} />
      <RibbonBtn icon={Subscript} title="Subíndice" onClick={() => applyFormatToSelection("subscript")} />
      <RibbonBtn icon={RemoveFormatting} title="Quitar formato" onClick={removeFormat} />

      <RibbonDivider />

      {/* Listas + Alineación + Sangría */}
      <RibbonBtn icon={List} title="Lista con viñetas" onClick={() => insertAfterSelected(createList(false))} />
      <RibbonBtn icon={ListOrdered} title="Lista numerada" onClick={() => insertAfterSelected(createList(true))} />
      <RibbonBtn icon={AlignLeft} title="Alinear izquierda" onClick={() => setAlignment("left")} active={currentAlignment === "left"} />
      <RibbonBtn icon={AlignCenter} title="Centrar" onClick={() => setAlignment("center")} active={currentAlignment === "center"} />
      <RibbonBtn icon={AlignRight} title="Alinear derecha" onClick={() => setAlignment("right")} active={currentAlignment === "right"} />
      <RibbonBtn icon={AlignJustify} title="Justificar" onClick={() => setAlignment("justify")} active={currentAlignment === "justify"} />
      <RibbonBtn icon={Indent} title="Aumentar sangría" onClick={() => setIndent(1)} />
      <RibbonBtn icon={Outdent} title="Disminuir sangría" onClick={() => setIndent(-1)} />

      <RibbonDivider />

      {/* Insertar (esenciales) */}
      <RibbonBtn icon={Link2} title="Insertar enlace" onClick={async () => {
        const url = await prompt({
          title: "Insertar enlace",
          description: "URL del enlace:",
          confirmLabel: "Aceptar",
          placeholder: "https://",
          defaultValue: "https://",
        });
        if (url) insertLink(url);
      }} />
      <RibbonBtn icon={Table} title="Insertar tabla" onClick={() => insertAfterSelected(createTable(3, 3))} />
      <RibbonBtn icon={Image} title="Insertar imagen" onClick={async () => {
        const url = await prompt({
          title: "Insertar imagen",
          description: "URL de la imagen:",
          confirmLabel: "Aceptar",
          placeholder: "https://",
          defaultValue: "https://",
        });
        if (url) insertAfterSelected(createImage(url, ""));
      }} />
      <RibbonBtn icon={Quote} title="Cita" onClick={() => insertAfterSelected(createQuote())} />
      <RibbonBtn icon={Minus} title="Divisor" onClick={() => insertAfterSelected(createDivider())} />
      <RibbonBtn icon={Square} title="Espaciador" onClick={() => insertAfterSelected(createSpacer(20))} />
      <RibbonBtn icon={Columns2} title="Columnas" onClick={() => insertAfterSelected(createColumns(2))} />

      <RibbonDivider />

      {/* Estilos (esenciales) */}
      <RibbonBtn icon={Type} title="Párrafo" onClick={() => insertAfterSelected(createParagraph())} />
      <RibbonBtn icon={Heading1} title="Título 1" onClick={() => insertAfterSelected(createHeading(1))} />
      <RibbonBtn icon={Heading2} title="Título 2" onClick={() => insertAfterSelected(createHeading(2))} />
      <RibbonBtn icon={Heading3} title="Título 3" onClick={() => insertAfterSelected(createHeading(3))} />

      <RibbonDivider />

      {/* Ver JSON — debug */}
      <RibbonBtn icon={Code} title="Ver JSON del documento" onClick={async () => {
        const json = useEditorStore.getState().getJson();
        // Copiar al portapapeles
        navigator.clipboard?.writeText(json).catch(() => {});
        // Mostrar en un alert para que se pueda copiar fácilmente
        const formatted = JSON.stringify(JSON.parse(json), null, 2);
        await prompt({
          title: "JSON del documento",
          description: "JSON del documento (Ctrl+C para copiar):",
          confirmLabel: "Aceptar",
          defaultValue: formatted.slice(0, 5000),
        });
      }} />

      <RibbonDivider />

      {/* Zoom */}
      {isOffice ? (
        <div className="ee-zoom-dropdown-wrapper">
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                className="ee-ribbon-zoom-btn"
                onClick={() => setZoom(zoom - 10)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Minus className="ee-ribbon-btn-icon" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Alejar</p></TooltipContent>
          </Tooltip>
          <button
            type="button"
            className="ee-ribbon-zoom-value"
            onClick={() => setShowZoomMenu(!showZoomMenu)}
            onMouseDown={(e) => e.preventDefault()}
          >
            {zoom}%
          </button>
          {showZoomMenu && (
            <>
              <div className="ee-color-picker-overlay" onClick={() => setShowZoomMenu(false)} />
              <div className="ee-zoom-menu">
                {[80, 100, 125, 150].map((z) => (
                  <button
                    key={z}
                    type="button"
                    className={`ee-zoom-menu-item ${zoom === z ? "ee-zoom-menu-item-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setZoom(z); setShowZoomMenu(false); }}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </>
          )}
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                className="ee-ribbon-zoom-btn"
                onClick={() => setZoom(zoom + 10)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Plus className="ee-ribbon-btn-icon" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Acercar</p></TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button type="button" className="ee-ribbon-zoom-btn" onClick={() => setZoom(zoom - 10)}>-</button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Alejar</p></TooltipContent>
          </Tooltip>
          <span className="ee-ribbon-zoom-value">{zoom}%</span>
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button type="button" className="ee-ribbon-zoom-btn" onClick={() => setZoom(zoom + 10)}>+</button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Acercar</p></TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ───

function RibbonDivider() {
  return <div className="ee-ribbon-divider" />;
}

function RibbonBtn({ icon: Icon, title, onClick, disabled, active }: {
  icon: typeof Bold;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <button
          type="button"
          className={`ee-ribbon-btn ${active ? "ee-btn-active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
        >
          <Icon className="ee-ribbon-btn-icon" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Helpers ───

function updateBlockProp(
  doc: import("../core/types").EmailDocument,
  blockId: string,
  patch: Record<string, unknown>
): import("../core/types").EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id === blockId) return { ...b, ...patch } as Block;
      return b;
    }),
  };
}

// ─── useSyncExternalStore: suscripción a selectionchange del navegador ───

const NATIVE_FORMAT_DEFAULT = '{"bold":false,"italic":false,"underline":false,"strike":false}';

function subscribeToSelectionChange(callback: () => void): () => void {
  document.addEventListener("selectionchange", callback);
  return () => document.removeEventListener("selectionchange", callback);
}

function getNativeFormatSnapshot(): string {
  try {
    return JSON.stringify({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
    });
  } catch {
    return NATIVE_FORMAT_DEFAULT;
  }
}

function getNativeFormatServerSnapshot(): string {
  return NATIVE_FORMAT_DEFAULT;
}
