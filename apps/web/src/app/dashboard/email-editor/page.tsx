"use client";

import { useState } from "react";
import { EmailEditor } from "@/components/email-editor";
import type { VariableDefinition } from "@/components/email-editor/core/types";
import "@/components/email-editor/email-editor.css";

const SAMPLE_VARIABLES: VariableDefinition[] = [
  { key: "cliente", label: "Cliente", value: "Juan Pérez", group: "Datos del siniestro" },
  { key: "numeroCaso", label: "Número de caso", value: "L-000000141", group: "Datos del siniestro" },
  { key: "liquidador", label: "Liquidador", value: "María González", group: "Datos del siniestro" },
  { key: "fecha", label: "Fecha", value: "29/07/2026", group: "Datos del siniestro" },
  { key: "empresa", label: "Empresa", value: "Claims Hub", group: "Empresa" },
  { key: "direccion", label: "Dirección", value: "Av. Providencia 1234, Santiago", group: "Empresa" },
  { key: "telefono", label: "Teléfono", value: "+56 2 1234 5678", group: "Empresa" },
  { key: "correo", label: "Correo", value: "contacto@hub.cl", group: "Empresa" },
];

export default function EmailEditorPage() {
  const [savedData, setSavedData] = useState<{ json: string; html: string; text: string } | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = (json: string, html: string, text: string) => {
    setSavedData({ json, html, text });
    setShowSaved(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Editor de Email — Estilo Outlook 365</h1>

      <div className="rounded-xl overflow-hidden border border-border email-editor-page">
        <EmailEditor
          mode="compose"
          variables={SAMPLE_VARIABLES}
          onSave={handleSave}
          onCancel={() => setShowSaved(false)}
        />
      </div>

      {showSaved && savedData && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Documento guardado</h2>
            <button
              type="button"
              className="pg-btn-platinum"
              onClick={() => setShowSaved(false)}
            >
              Cerrar
            </button>
          </div>

          <details className="border border-border rounded-lg p-3">
            <summary className="text-xs font-semibold cursor-pointer">JSON del documento</summary>
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all mt-2 max-h-60 overflow-auto">
              {savedData.json}
            </pre>
          </details>

          <details className="border border-border rounded-lg p-3">
            <summary className="text-xs font-semibold cursor-pointer">HTML para SMTP</summary>
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all mt-2 max-h-60 overflow-auto">
              {savedData.html}
            </pre>
          </details>

          <details className="border border-border rounded-lg p-3">
            <summary className="text-xs font-semibold cursor-pointer">Texto plano</summary>
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all mt-2 max-h-60 overflow-auto">
              {savedData.text}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
