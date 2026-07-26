"use client";

import { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DOCUMENT_FIELDS, FIELD_GROUPS } from "@/lib/document-fields";

interface Props {
  /** Llave del campo destino que tiene el foco actualmente: "subject" o "body". */
  activeTarget: "subject" | "body" | null;
  /** Placeholder a insertar cuando el usuario hace click. */
  onInsert: (placeholder: string, target: "subject" | "body") => void;
  /** Placeholders ya detectados en subject+body (para mostrar mapeo). */
  detectedPlaceholders?: string[];
  className?: string;
}

/**
 * Panel lateral con los campos disponibles para insertar en una plantilla de e-mail.
 * Permite:
 *  - Buscar campos por key o label.
 *  - Filtrar por grupo.
 *  - Click en campo → inserta placeholder `<key>` en el campo activo (subject o body).
 *  - Drag-and-drop: el campo es arrastrable y se suelta en el body (textarea/editor).
 *
 * El placeholder se inserta en formato `<key>` (docxtemplater style) porque es el
 * más compatible con el renderizador. El usuario puede cambiarlo a [KEY] si quiere.
 */
export function FieldInsertor({ activeTarget, onInsert, className }: Props) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCUMENT_FIELDS.filter((f) => {
      if (activeGroup && f.group !== activeGroup) return false;
      if (!q) return true;
      return (
        f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
      );
    });
  }, [query, activeGroup]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof DOCUMENT_FIELDS>();
    for (const f of filtered) {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group)!.push(f);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <aside
      className={`flex flex-col rounded-lg border border-border bg-card overflow-hidden ${className || ""}`}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="app-field-label text-[11px] font-semibold mb-1.5">
          Campos disponibles
        </p>
        <div className="app-grid-search-wrap w-full">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar campo..."
            className="liquid-search w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!activeTarget && (
          <p className="text-[10px] text-amber-600 mt-1.5">
            Hacé clic en Asunto o Cuerpo para insertar campos.
          </p>
        )}
        {activeTarget && (
          <p className="text-[10px] text-emerald-600 mt-1.5">
            Insertando en: {activeTarget === "subject" ? "Asunto" : "Cuerpo"}
          </p>
        )}
      </div>

      {/* Chips de grupo */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveGroup(null)}
          className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
            activeGroup === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Todos
        </button>
        {FIELD_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveGroup(g)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              activeGroup === g
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Lista de campos */}
      <div className="flex-1 overflow-auto max-h-[420px]">
        {grouped.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Sin resultados.
          </p>
        ) : (
          grouped.map(([group, fields]) => (
            <div key={group} className="border-b border-border/60 last:border-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 px-3 pt-2 pb-1">
                {group}
              </p>
              <ul className="pb-2">
                {fields.map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `<${f.key}>`);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => {
                        if (activeTarget) {
                          onInsert(`<${f.key}>`, activeTarget);
                        }
                      }}
                      disabled={!activeTarget}
                      className="group w-full flex items-center gap-2 px-3 py-1 text-left text-[11px] hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={`Insertar <${f.key}>`}
                    >
                      <Plus className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="flex-1 min-w-0 truncate text-foreground">
                        {f.label}
                      </span>
                      <code className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                        {f.key}
                      </code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
