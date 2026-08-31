/**
 * EmailEditor — componente principal del editor de email.
 *
 * Modos:
 *   compose  — redactar un correo nuevo
 *   template — editar una plantilla (header/footer/firma bloqueados)
 *   reply    — responder un correo
 *   forward  — reenviar un correo
 *
 * Props:
 *   mode        — modo del editor
 *   template    — documento inicial (JSON o string)
 *   variables   — variables dinámicas disponibles
 *   onSave      — callback al guardar (recibe JSON + HTML)
 *   onCancel    — callback al cancelar
 *
 * Uso:
 *   <EmailEditor mode="compose" onSave={(json, html) => ...} />
 */

"use client";

import { useEffect } from "react";
import type { EditorMode, EditorLayout, VariableDefinition, EmailDocument } from "./core/types";
import { useEditorStore } from "./store/editor-store";
import { deserializeFromJson } from "./core/document-model";
import { renderDocumentToHtml, renderDocumentToPlainText } from "./renderer/html-renderer";
import { Ribbon } from "./ribbon/ribbon";
import { TableToolbar } from "./ribbon/table-toolbar";
import { Canvas } from "./canvas/canvas";
import { PreviewPanel } from "./canvas/preview-panel";
import { InspectorPanel } from "./inspector/inspector-panel";
import { VariablesPanel } from "./inspector/variables-panel";
import { usePasteHandler } from "./hooks/use-paste-handler";

export interface EmailEditorProps {
  mode?: EditorMode;
  layout?: EditorLayout;
  template?: EmailDocument | string;
  variables?: VariableDefinition[];
  onSave?: (json: string, html: string, text: string) => void;
  onCancel?: () => void;
}

export function EmailEditor({ mode = "compose", layout = "legacy", template, variables = [], onSave, onCancel }: EmailEditorProps) {
  const setMode = useEditorStore((s) => s.setMode);
  const setLayout = useEditorStore((s) => s.setLayout);
  const setVariables = useEditorStore((s) => s.setVariables);
  const setDocument = useEditorStore((s) => s.setDocument);
  const showPreview = useEditorStore((s) => s.showPreview);
  const document = useEditorStore((s) => s.document);
  const getJson = useEditorStore((s) => s.getJson);

  // Inicializar modo, layout y variables
  useEffect(() => {
    setMode(mode);
    setLayout(layout);
    setVariables(variables);
  }, [mode, layout, variables, setMode, setLayout, setVariables]);

  // Hook de pegado desde Word/Outlook
  usePasteHandler();

  // Cargar template inicial
  useEffect(() => {
    if (template) {
      if (typeof template === "string") {
        try {
          setDocument(deserializeFromJson(template));
        } catch {
          // JSON inválido, mantener documento vacío
        }
      } else {
        setDocument(template);
      }
    }
  }, [template, setDocument]);

  const handleSave = () => {
    const json = getJson();
    const varMap: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.value) varMap[v.key] = v.value;
    });
    const html = renderDocumentToHtml(document, varMap);
    const text = renderDocumentToPlainText(document, varMap);
    onSave?.(json, html, text);
  };

  return (
    <div className={`ee-editor ee-layout-${layout}`}>
      {/* Ribbon superior */}
      <Ribbon />

      {/* Toolbar contextual de tabla */}
      <TableToolbar />

      {/* Área principal */}
      <div className="ee-editor-body">
        {/* Panel de variables (izquierda) */}
        <VariablesPanel />

        {/* Canvas central */}
        <div className="ee-editor-canvas-area">
          {showPreview ? <PreviewPanel /> : <Canvas />}
        </div>

        {/* Inspector (derecha) */}
        <InspectorPanel />
      </div>

      {/* Footer con acciones */}
      <div className="ee-editor-footer">
        <button type="button" className="ee-footer-btn ee-footer-btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="ee-footer-btn ee-footer-btn-primary" onClick={handleSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}

