/**
 * InspectorPanel — panel derecho con propiedades del bloque seleccionado.
 *
 * Muestra y permite editar las propiedades del bloque actualmente seleccionado.
 * Cambia según el tipo de bloque (párrafo, tabla, imagen, botón, etc.)
 */

"use client";

import { useEditorStore } from "../store/editor-store";
import { GenericCommand } from "../core/commands";
import type { Block, Alignment } from "../core/types";

export function InspectorPanel() {
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const showInspector = useEditorStore((s) => s.showInspector);

  if (!showInspector) return null;

  const block = document.blocks.find((b) => b.id === selection.blockId);

  if (!block) {
    return (
      <div className="ee-inspector">
        <div className="ee-inspector-header">
          <span className="ee-inspector-title">Propiedades</span>
        </div>
        <div className="ee-inspector-empty">
          Selecciona un bloque para ver sus propiedades.
        </div>
      </div>
    );
  }

  const updateProp = (patch: Partial<Block>, description = "Actualizar propiedad") => {
    executeCommand(
      new GenericCommand(
        (doc) => updateBlockInDoc(doc, block.id, patch),
        (doc) => updateBlockInDoc(doc, block.id, getOldProps(block, patch)),
        description
      )
    );
  };

  return (
    <div className="ee-inspector">
      <div className="ee-inspector-header">
        <span className="ee-inspector-title">Propiedades</span>
        <span className="ee-inspector-type">{block.type}</span>
      </div>
      <div className="ee-inspector-body">
        {renderInspectorForBlock(block, updateProp)}
      </div>
    </div>
  );
}

function renderInspectorForBlock(
  block: Block,
  updateProp: (patch: Partial<Block>, description?: string) => void
): React.ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <>
          <InspectorField label="Alineación">
            <select
              className="ee-inspector-select"
              value={(block as { alignment?: Alignment }).alignment ?? "left"}
              onChange={(e) => updateProp({ alignment: e.target.value as Alignment }, "Cambiar alineación")}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
              <option value="justify">Justificar</option>
            </select>
          </InspectorField>
          <InspectorField label="Sangría">
            <input
              type="number"
              className="ee-inspector-input"
              value={(block as { indent?: number }).indent ?? 0}
              min={0}
              max={10}
              onChange={(e) => updateProp({ indent: parseInt(e.target.value) || 0 }, "Cambiar sangría")}
            />
          </InspectorField>
          <InspectorField label="Interlineado">
            <select
              className="ee-inspector-select"
              value={(block as { lineHeight?: number }).lineHeight ?? 1.5}
              onChange={(e) => updateProp({ lineHeight: parseFloat(e.target.value) }, "Cambiar interlineado")}
            >
              <option value={1}>Simple</option>
              <option value={1.15}>1.15</option>
              <option value={1.5}>1.5</option>
              <option value={2}>Doble</option>
            </select>
          </InspectorField>
        </>
      );

    case "heading":
      return (
        <>
          <InspectorField label="Nivel">
            <select
              className="ee-inspector-select"
              value={block.level}
              onChange={(e) => updateProp({ level: parseInt(e.target.value) as 1|2|3|4|5|6 }, "Cambiar nivel")}
            >
              <option value={1}>Título 1</option>
              <option value={2}>Título 2</option>
              <option value={3}>Título 3</option>
              <option value={4}>Título 4</option>
              <option value={5}>Título 5</option>
              <option value={6}>Título 6</option>
            </select>
          </InspectorField>
          <InspectorField label="Alineación">
            <select
              className="ee-inspector-select"
              value={block.alignment ?? "left"}
              onChange={(e) => updateProp({ alignment: e.target.value as Alignment }, "Cambiar alineación")}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
              <option value="justify">Justificar</option>
            </select>
          </InspectorField>
        </>
      );

    case "image":
      return (
        <>
          <InspectorField label="URL">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.src}
              onChange={(e) => updateProp({ src: e.target.value }, "Cambiar URL")}
            />
          </InspectorField>
          <InspectorField label="Texto alternativo">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.alt}
              onChange={(e) => updateProp({ alt: e.target.value }, "Cambiar alt")}
            />
          </InspectorField>
          <InspectorField label="Ancho">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.width ?? "auto"}
              onChange={(e) => updateProp({ width: e.target.value }, "Cambiar ancho")}
            />
          </InspectorField>
          <InspectorField label="Alineación">
            <select
              className="ee-inspector-select"
              value={block.alignment ?? "center"}
              onChange={(e) => updateProp({ alignment: e.target.value as Alignment }, "Cambiar alineación")}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </InspectorField>
          <InspectorField label="Enlace al hacer clic">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.link ?? ""}
              onChange={(e) => updateProp({ link: e.target.value }, "Cambiar enlace")}
            />
          </InspectorField>
        </>
      );

    case "button":
      return (
        <>
          <InspectorField label="Texto">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.text}
              onChange={(e) => updateProp({ text: e.target.value }, "Cambiar texto")}
            />
          </InspectorField>
          <InspectorField label="URL">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.href}
              onChange={(e) => updateProp({ href: e.target.value }, "Cambiar URL")}
            />
          </InspectorField>
          <InspectorField label="Color de fondo">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.backgroundColor ?? "#0066cc"}
              onChange={(e) => updateProp({ backgroundColor: e.target.value }, "Cambiar color de fondo")}
            />
          </InspectorField>
          <InspectorField label="Color de texto">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.textColor ?? "#ffffff"}
              onChange={(e) => updateProp({ textColor: e.target.value }, "Cambiar color de texto")}
            />
          </InspectorField>
          <InspectorField label="Tamaño de fuente">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.fontSize ?? "16px"}
              onChange={(e) => updateProp({ fontSize: e.target.value }, "Cambiar tamaño")}
            />
          </InspectorField>
          <InspectorField label="Padding">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.padding ?? "12px 24px"}
              onChange={(e) => updateProp({ padding: e.target.value }, "Cambiar padding")}
            />
          </InspectorField>
          <InspectorField label="Radio de borde">
            <input
              type="number"
              className="ee-inspector-input"
              value={block.borderRadius ?? 6}
              onChange={(e) => updateProp({ borderRadius: parseInt(e.target.value) || 0 }, "Cambiar radio")}
            />
          </InspectorField>
          <InspectorField label="Alineación">
            <select
              className="ee-inspector-select"
              value={block.alignment ?? "center"}
              onChange={(e) => updateProp({ alignment: e.target.value as Alignment }, "Cambiar alineación")}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </InspectorField>
        </>
      );

    case "table":
      return (
        <>
          <InspectorField label="Ancho">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.width ?? "100%"}
              onChange={(e) => updateProp({ width: e.target.value }, "Cambiar ancho")}
            />
          </InspectorField>
          <InspectorField label="Borde (px)">
            <input
              type="number"
              className="ee-inspector-input"
              value={block.borderWidth ?? 1}
              onChange={(e) => updateProp({ borderWidth: parseInt(e.target.value) || 0 }, "Cambiar borde")}
            />
          </InspectorField>
          <InspectorField label="Color de borde">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.borderColor ?? "#cccccc"}
              onChange={(e) => updateProp({ borderColor: e.target.value }, "Cambiar color de borde")}
            />
          </InspectorField>
          <InspectorField label="Padding de celda">
            <input
              type="number"
              className="ee-inspector-input"
              value={block.cellPadding ?? 8}
              onChange={(e) => updateProp({ cellPadding: parseInt(e.target.value) || 0 }, "Cambiar padding")}
            />
          </InspectorField>
        </>
      );

    case "divider":
      return (
        <>
          <InspectorField label="Color">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.color ?? "#cccccc"}
              onChange={(e) => updateProp({ color: e.target.value }, "Cambiar color")}
            />
          </InspectorField>
          <InspectorField label="Grosor (px)">
            <input
              type="number"
              className="ee-inspector-input"
              value={block.thickness ?? 1}
              onChange={(e) => updateProp({ thickness: parseInt(e.target.value) || 1 }, "Cambiar grosor")}
            />
          </InspectorField>
          <InspectorField label="Ancho">
            <input
              type="text"
              className="ee-inspector-input"
              value={block.width ?? "100%"}
              onChange={(e) => updateProp({ width: e.target.value }, "Cambiar ancho")}
            />
          </InspectorField>
        </>
      );

    case "spacer":
      return (
        <InspectorField label="Altura (px)">
          <input
            type="number"
            className="ee-inspector-input"
            value={block.height}
            onChange={(e) => updateProp({ height: parseInt(e.target.value) || 20 }, "Cambiar altura")}
          />
        </InspectorField>
      );

    case "quote":
      return (
        <>
          <InspectorField label="Color de borde">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.borderColor ?? "#cccccc"}
              onChange={(e) => updateProp({ borderColor: e.target.value }, "Cambiar color de borde")}
            />
          </InspectorField>
          <InspectorField label="Color de fondo">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.backgroundColor ?? "#f9f9f9"}
              onChange={(e) => updateProp({ backgroundColor: e.target.value }, "Cambiar color de fondo")}
            />
          </InspectorField>
        </>
      );

    case "callout":
      return (
        <>
          <InspectorField label="Color de fondo">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.backgroundColor ?? "#fef3cd"}
              onChange={(e) => updateProp({ backgroundColor: e.target.value }, "Cambiar color de fondo")}
            />
          </InspectorField>
          <InspectorField label="Color de borde">
            <input
              type="color"
              className="ee-inspector-color"
              value={block.borderColor ?? "#ffc107"}
              onChange={(e) => updateProp({ borderColor: e.target.value }, "Cambiar color de borde")}
            />
          </InspectorField>
        </>
      );

    default:
      return <div className="ee-inspector-empty">No hay propiedades editables para este tipo de bloque.</div>;
  }
}

// ─── Sub-componentes ───

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ee-inspector-field">
      <label className="ee-inspector-label">{label}</label>
      {children}
    </div>
  );
}

// ─── Helpers ───

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

function getOldProps(block: Block, patch: Partial<Block>): Partial<Block> {
  const old: Record<string, unknown> = {};
  const blockRecord = block as unknown as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    old[key] = blockRecord[key];
  }
  return old as Partial<Block>;
}
