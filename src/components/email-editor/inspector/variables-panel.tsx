/**
 * VariablesPanel — panel izquierdo con variables dinámicas disponibles.
 *
 * Muestra las variables agrupadas con su label legible y valor de preview.
 * Al hacer clic en una variable, la inserta como campo en el documento.
 * Estilo: Explorador de Visual Studio con árbol expandible.
 */

"use client";

import { useEditorStore } from "../store/editor-store";
import { GenericCommand, InsertBlockCommand } from "../core/commands";
import { createParagraph, createVariableNode } from "../core/document-model";
import type { InlineContent, Block } from "../core/types";
import { ChevronRight, Search, Star } from "lucide-react";
import { useState, useMemo } from "react";

export function VariablesPanel() {
  const variables = useEditorStore((s) => s.variables);
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const executeCommand = useEditorStore((s) => s.executeCommand);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (key: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const insertVariable = (key: string) => {
    const selectedBlock = document.blocks.find((b) => b.id === selection.blockId);
    if (!selectedBlock || !("children" in selectedBlock)) {
      const para = createParagraph();
      const newBlock = { ...para, children: [createVariableNode(key)] } as Block;
      executeCommand(new InsertBlockCommand(newBlock, document.blocks.length));
      return;
    }
    const currentChildren = (selectedBlock as { children: InlineContent[] }).children;
    const newChildren = [...currentChildren, createVariableNode(key)];
    executeCommand(
      new GenericCommand(
        (doc) => updateBlockChildren(doc, selectedBlock.id, newChildren),
        (doc) => updateBlockChildren(doc, selectedBlock.id, currentChildren),
        `Insertar variable «${key}»`
      )
    );
  };

  // Filtrar por búsqueda
  const filteredVariables = useMemo(() => {
    if (!search.trim()) return variables;
    const q = search.toLowerCase();
    return variables.filter(
      (v) => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)
    );
  }, [variables, search]);

  // Agrupar variables
  const groups = useMemo(() => {
    const map = new Map<string, typeof variables>();
    filteredVariables.forEach((v) => {
      const group = v.group ?? "General";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(v);
    });
    return map;
  }, [filteredVariables]);

  // Variables favoritas
  const favVars = useMemo(() => variables.filter((v) => favorites.has(v.key)), [variables, favorites]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  if (variables.length === 0) return null;

  return (
    <div className="ee-variables-panel">
      <div className="ee-variables-header">
        <span className="ee-variables-title">Campos</span>
      </div>

      {/* Buscador */}
      <div className="ee-variables-search-wrap">
        <Search className="ee-variables-search-icon" />
        <input
          type="text"
          className="ee-variables-search"
          placeholder="Buscar campo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="ee-variables-body">
        {/* Favoritos */}
        {favVars.length > 0 && (
          <div className="ee-variables-group">
            <button
              type="button"
              className="ee-variables-group-header"
              onClick={() => toggleGroup("__favorites__")}
            >
              <ChevronRight
                className={`ee-variables-chevron ${expandedGroups.has("__favorites__") ? "ee-variables-chevron-open" : ""}`}
              />
              <Star className="ee-variables-fav-icon" />
              <span>Favoritos</span>
            </button>
            {expandedGroups.has("__favorites__") && (
              <div className="ee-variables-list">
                {favVars.map((v) => (
                  <VariableItem
                    key={v.key}
                    variable={v}
                    isFavorite={true}
                    onInsert={() => insertVariable(v.key)}
                    onToggleFav={() => toggleFavorite(v.key)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grupos */}
        {Array.from(groups.entries()).map(([group, vars]) => (
          <div key={group} className="ee-variables-group">
            <button
              type="button"
              className="ee-variables-group-header"
              onClick={() => toggleGroup(group)}
            >
              <ChevronRight
                className={`ee-variables-chevron ${expandedGroups.has(group) ? "ee-variables-chevron-open" : ""}`}
              />
              <span>{group}</span>
            </button>
            {expandedGroups.has(group) && (
              <div className="ee-variables-list">
                {vars.map((v) => (
                  <VariableItem
                    key={v.key}
                    variable={v}
                    isFavorite={favorites.has(v.key)}
                    onInsert={() => insertVariable(v.key)}
                    onToggleFav={() => toggleFavorite(v.key)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredVariables.length === 0 && (
          <div className="ee-variables-empty">Sin resultados</div>
        )}
      </div>
    </div>
  );
}

// ─── Item de variable ───

function VariableItem({
  variable,
  isFavorite,
  onInsert,
  onToggleFav,
}: {
  variable: import("../core/types").VariableDefinition;
  isFavorite: boolean;
  onInsert: () => void;
  onToggleFav: () => void;
}) {
  return (
    <div className="ee-variables-item">
      <button
        type="button"
        className="ee-variables-item-btn"
        onClick={onInsert}
        title={`Insertar «${normalizeLabel(variable.label)}»`}
      >
        <span className="ee-variables-item-label">{normalizeLabel(variable.label)}</span>
        {variable.value && (
          <span className="ee-variables-item-value">{variable.value}</span>
        )}
      </button>
      <button
        type="button"
        className={`ee-variables-item-fav ${isFavorite ? "ee-variables-item-fav-active" : ""}`}
        onClick={onToggleFav}
        title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      >
        <Star className="ee-variables-fav-star" />
      </button>
    </div>
  );
}

// ─── Normalización de labels ───

function normalizeLabel(label: string): string {
  return label
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function updateBlockChildren(
  doc: import("../core/types").EmailDocument,
  blockId: string,
  children: InlineContent[]
): import("../core/types").EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => {
      if (b.id === blockId && "children" in b) {
        return { ...b, children } as Block;
      }
      return b;
    }),
  };
}
