"use client";

import { useState, useEffect } from "react";
import { EmailEditor } from "@/components/email-editor";
import type { VariableDefinition } from "@/components/email-editor/core/types";
import { htmlToDocument } from "@/components/email-editor/utils/html-to-document";
import { useEditorStore } from "@/components/email-editor/store/editor-store";
import { getEmailTemplates, type EmailTemplate } from "@/services/email-templates";
import "@/components/email-editor/email-editor.css";
import "@/components/email-editor/email-editor-office365.css";
import { Loader2, FileText } from "lucide-react";

const SAMPLE_VARIABLES: VariableDefinition[] = [
  { key: "cliente", label: "Cliente", value: "Juan Pérez", group: "Datos del caso" },
  { key: "numeroCaso", label: "Número de caso", value: "L-000000141", group: "Datos del caso" },
  { key: "liquidador", label: "Liquidador", value: "María González", group: "Datos del caso" },
  { key: "fecha", label: "Fecha", value: "29/07/2026", group: "Datos del caso" },
  { key: "empresa", label: "Empresa", value: "Claims Hub", group: "Empresa" },
  { key: "direccion", label: "Dirección", value: "Av. Providencia 1234, Santiago", group: "Empresa" },
  { key: "telefono", label: "Teléfono", value: "+56 2 1234 5678", group: "Empresa" },
  { key: "correo", label: "Correo", value: "contacto@hub.cl", group: "Empresa" },
  { key: "vehiculo", label: "Vehículo", value: "Toyota Corolla 2023", group: "Vehículo" },
  { key: "poliza", label: "Póliza", value: "P-123456789", group: "Vehículo" },
];

export default function EmailEditorV2Page() {
  const [savedData, setSavedData] = useState<{ json: string; html: string; text: string } | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const setDocument = useEditorStore((s) => s.setDocument);

  // Cargar plantillas de la base de datos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getEmailTemplates({ includeInactive: false });
        if (!cancelled) {
          setTemplates(result);
          setTemplatesLoading(false);
        }
      } catch (err) {
        console.error("Error al cargar plantillas:", err);
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cargar plantilla seleccionada en el editor
  const loadTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);

    // "Documento vacío" → resetear a un documento con un párrafo vacío
    if (!templateId) {
      setDocument({
        version: 1,
        blocks: [{ id: "blk_initial", type: "paragraph", children: [] }],
        metadata: {
          backgroundColor: "#ffffff",
          maxWidth: "600px",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          textColor: "#333333",
          linkColor: "#0066cc",
        },
      });
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const body = template.body ?? "";
    if (!body.trim()) return;

    // Si es texto plano, crear párrafos directamente
    if (template.body_format === "plain" || !body.includes("<")) {
      const lines = body.split("\n").filter((l) => l.trim());
      const blocks = lines.map((line) => ({
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: "paragraph" as const,
        children: [{ type: "text" as const, text: line }],
      }));
      setDocument({
        version: 1,
        blocks: blocks.length > 0 ? blocks : [{ id: "blk_initial", type: "paragraph" as const, children: [] }],
        metadata: {
          backgroundColor: "#ffffff",
          maxWidth: "600px",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          textColor: "#333333",
          linkColor: "#0066cc",
        },
      });
      return;
    }

    // Convertir HTML de la plantilla a documento JSON
    try {
      const doc = htmlToDocument(body);
      setDocument(doc);
    } catch (err) {
      console.error("[email-editor-v2] Error al convertir HTML:", err);
    }
  };

  const handleSave = (json: string, html: string, text: string) => {
    setSavedData({ json, html, text });
    setShowSaved(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Editor de Email — Outlook 365</h1>

        {/* Selector de plantillas */}
        <div className="flex items-center gap-2">
          {templatesLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : templates.length > 0 ? (
            <select
              className="app-input h-7 text-[11px]"
              value={selectedTemplateId}
              onChange={(e) => loadTemplate(e.target.value)}
            >
              <option value="">Documento vacío</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Sin plantillas
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border email-editor-page">
        <EmailEditor
          mode="compose"
          layout="office365"
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
