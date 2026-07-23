"use client";

import { useState, useMemo } from "react";
import { Search, Copy, Check, Code2, Info, FileText } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DOCUMENT_FIELDS, FIELD_GROUPS } from "@/lib/document-fields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal con el catálogo de campos disponibles para plantillas Word.
 * Permite al usuario referenciar los campos <campo> sin salirse de la
 * pantalla de creación/edición de gestión.
 */
export function CamposPlantillaModal({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FIELD_GROUPS;
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

  const fieldsForGroup = (group: string) => {
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
    <Dialog open={open} onOpenChange={onOpenChange} dismissible>
      <DialogContent className="modal-lg" showCloseButton>
        {/* Header */}
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
              <Code2 className="h-4 w-4" />
            </div>
            Campos de Plantillas
          </DialogTitle>
          <p className="modal-subtitle">
            Catálogo de campos disponibles para usar en plantillas Word (.docx). Escribe la sintaxis
            <code className="app-inline-code mx-1">{"<campo>"}</code>
            en el documento y se rellenará automáticamente con los datos del siniestro.
          </p>
        </div>

        {/* Body */}
        <div className="modal-body space-y-3">
          {/* Aviso */}
          <div className="info-box flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <strong>Cómo usar:</strong> Escribe el placeholder entre signos de menor y mayor,
              por ejemplo <code className="app-inline-code mx-1">{"<claim_number>"}</code>
              para el número de siniestro. Click en cualquier campo para copiarlo.
            </div>
          </div>

          {/* Buscador + copiar todos */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar campo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
                autoFocus
              />
            </div>
            <button type="button" onClick={handleCopyAll} className="pg-btn-platinum shrink-0">
              Copiar
            </button>
          </div>

          {/* Resumen */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {DOCUMENT_FIELDS.length} campos en {FIELD_GROUPS.length} grupos
          </div>

          {/* Grupos */}
          <div className="space-y-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-[11px] border border-dashed border-border rounded-lg">
                No se encontraron campos para &ldquo;{search}&rdquo;.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const fields = fieldsForGroup(group);
                return (
                  <div key={group} className="rounded-lg border border-border/60 overflow-hidden">
                    {/* Header del grupo */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-b border-border/60">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                      <span className="text-[11px] font-semibold text-foreground">{group}</span>
                      <span className="text-[10px] text-muted-foreground">({fields.length})</span>
                    </div>
                    {/* Campos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
                      {fields.map((field) => {
                        const isCopied = copied === field.key;
                        return (
                          <button
                            key={field.key}
                            type="button"
                            onClick={() => handleCopy(field.key)}
                            className="group flex items-center gap-2 rounded-md border border-border/40 px-2.5 py-1.5 hover:border-primary/40 hover:bg-muted/30 transition-colors text-left"
                            title="Click para copiar"
                          >
                            <code className="text-[11px] font-mono text-primary shrink-0">
                              {"<" + field.key + ">"}
                            </code>
                            <span className="text-[11px] text-muted-foreground truncate flex-1">
                              {field.label}
                            </span>
                            <span className="shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors">
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
