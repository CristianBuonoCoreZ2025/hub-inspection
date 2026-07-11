"use client";

import { useState, useMemo } from "react";
import { Search, Copy, Check, Code2, FileText, Info } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { DOCUMENT_FIELDS, FIELD_GROUPS } from "@/lib/document-fields";

export default function CamposPlantillaPage() {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Filtrado por búsqueda (coincide en key, label o group)
  const filteredByGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FIELD_GROUPS;
    // Devolver solo grupos que tengan al menos un match
    return FIELD_GROUPS.filter((g) =>
      DOCUMENT_FIELDS.some(
        (f) =>
          f.group === g &&
          (f.key.toLowerCase().includes(q) ||
            f.label.toLowerCase().includes(q) ||
            f.group.toLowerCase().includes(q))
      )
    );
  }, [search]);

  const filteredFields = (group: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return DOCUMENT_FIELDS.filter((f) => f.group === group);
    return DOCUMENT_FIELDS.filter(
      (f) =>
        f.group === group &&
        (f.key.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          f.group.toLowerCase().includes(q))
    );
  };

  const handleCopy = async (key: string) => {
    const text = `<${key}>`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(`Copiado: ${text}`);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleCopyGroup = async (group: string) => {
    const fields = filteredFields(group);
    const text = fields.map((f) => `<${f.key}>`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copiados ${fields.length} campos de "${group}"`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleCopyAll = async () => {
    const text = DOCUMENT_FIELDS.map((f) => `<${f.key}>`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copiados ${DOCUMENT_FIELDS.length} campos`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title flex items-center gap-2">
          <Code2 className="h-5 w-5 text-[#0095DA]" />
          Campos de Plantillas
        </h1>
        <p className="app-page-lead">
          Catálogo de campos disponibles para usar en plantillas Word (.docx). Escribe la sintaxis
          <code className="app-inline-code mx-1">{"<campo>"}</code>
          en el documento y se rellenará automáticamente con los datos del siniestro al generar el informe.
        </p>
      </header>

      {/* Aviso informativo */}
      <div className="app-alert-warn flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="text-[12px]">
          <strong>Cómo usar:</strong> En tu documento Word, escribe el placeholder entre signos de menor y mayor,
          por ejemplo <code className="app-inline-code mx-1">{"<claim_number>"}</code>
          para el número de siniestro. Al subir la plantilla, el sistema detecta automáticamente los campos
          y los mapea. Si usas un nombre propio (ej. <code className="app-inline-code mx-1">{"<N_Siniestro>"}</code>),
          podrás mapearlo manualmente al campo correspondiente.
        </div>
      </div>

      {/* Toolbar: buscador + copiar todos */}
      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <button type="button" onClick={handleCopyAll} className="btn-save">
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>

      {/* Resumen */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        {DOCUMENT_FIELDS.length} campos disponibles en {FIELD_GROUPS.length} grupos
      </div>
      {/* Grupos de campos */}
      <div className="space-y-3">
        {filteredByGroup.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-[12px] border border-dashed border-border rounded-lg">
            No se encontraron campos para &ldquo;{search}&rdquo;.
          </div>
        ) : (
          filteredByGroup.map((group) => {
            const fields = filteredFields(group);
            return (
              <section key={group} className="app-panel">
                {/* Header del grupo */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="app-section-title">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    {group}
                    <span className="text-muted-foreground/70 font-normal">({fields.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopyGroup(group)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar grupo
                  </button>
                </div>

                {/* Grid de campos */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {fields.map((field) => {
                    const isCopied = copied === field.key;
                    return (
                      <div
                        key={field.key}
                        className="group flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                      >
                        {/* Placeholder copiable */}
                        <button
                          type="button"
                          onClick={() => handleCopy(field.key)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          title="Click para copiar"
                        >
                          <code className="text-[11px] font-mono text-primary shrink-0">
                            {"<" + field.key + ">"}
                          </code>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {field.label}
                          </span>
                        </button>
                        {/* Ícono de copiar / check */}
                        <span className="shrink-0 text-muted-foreground/60 group-hover:text-foreground transition-colors">
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Ejemplo de uso */}
      <section className="app-panel">
        <h3 className="app-section-title">
          <FileText className="h-3.5 w-3.5" />
          Ejemplo de uso en Word
        </h3>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
{`INFORME DE LIQUIDACIÓN DE SINIESTRO

N° Siniestro: <claim_number>
N° Interno:   <internal_number>
N° Liquid.:   <liquidation_number>
Fecha:        <claim_date>
Estado:       <status_name>

Compañía:     <insurance_company>
Corredor:     <broker>
Línea:        <business_line>
Producto:     <insurance_product>
Causal:       <claim_cause>
Evento:       <event>

ASEGURADO:
  Nombre:     <insured_name>
  RUT:        <insured_rut>
  Dirección:  <insured_address>
  Comuna:     <insured_commune>
  Ciudad:     <insured_city>
  Teléfono:   <insured_cellphone>
  Email:      <insured_email>

CONTRATISTA:
  Nombre:     <contractor_name>
  RUT:        <contractor_rut>
  Teléfono:   <contractor_phone>

BENEFICIARIO:
  Nombre:     <beneficiary_name>
  RUT:        <beneficiary_rut>

PÓLIZA N°:    <policy_number>
Vigencia:     <policy_start_date> — <policy_end_date>
Monto Aseg.:  <policy_amount>

Liquidador:   <adjuster_name>
Inspector:    <inspector_name>

Resumen:
<summary>`}
          </pre>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Al generar el informe, cada <code className="app-inline-code">{"<campo>"}</code> se reemplaza
          automáticamente por el valor del siniestro. Los campos vacíos quedan en blanco.
        </p>
      </section>
    </div>
  );
}
