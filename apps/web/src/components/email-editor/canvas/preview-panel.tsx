/**
 * PreviewPanel — muestra el HTML final que se enviará por SMTP.
 *
 * Renderiza el HTML en un iframe para aislar los estilos.
 * Es el HTML exacto que se enviará, no una aproximación.
 */

"use client";

import { useMemo } from "react";
import { useEditorStore } from "../store/editor-store";
import { renderDocumentToHtml } from "../renderer/html-renderer";

export function PreviewPanel() {
  const document = useEditorStore((s) => s.document);
  const variables = useEditorStore((s) => s.variables);

  const html = useMemo(() => {
    const varMap: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.value) varMap[v.key] = v.value;
    });
    return renderDocumentToHtml(document, varMap);
  }, [document, variables]);

  return (
    <div className="ee-preview-panel">
      <div className="ee-preview-header">
        <span className="ee-preview-title">Vista previa (HTML final)</span>
      </div>
      <iframe
        title="Email preview"
        srcDoc={html}
        className="ee-preview-iframe"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
