"use client";

/**
 * Biblioteca de entidades — panel izquierdo del editor.
 *
 * Arquitectura definitiva con:
 *  - Favoritos: elementos más utilizados (sección superior automática).
 *  - Buscador: filtra entidades por nombre sin abrir acordeones.
 *  - Acordeones: 5 categorías, solo una abierta a la vez.
 *  - Reorden por tipo de bien: la categoría más relevante aparece primera.
 *
 * En desktop (>=640px) muestra la lista lateral arrastrable. En móvil
 * (<640px) colapsa a un <select> porque no hay drag con mouse.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 7 (Favoritos), § 8 (Buscador), § 15 (Tipo de bien).
 */

import { createElement, useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Search, Star, ChevronDown } from "lucide-react";
import {
  getAllEntities, getEntitiesByCategory, searchEntities,
} from "./entity-renderer";
import {
  CATEGORY_ORDER, CATEGORY_ORDER_BY_BIEN,
} from "./entity-types";
import type { BienType, EntityCategory, EntityDefinition } from "./entity-types";

/** IDs de entidades favoritas iniciales (conjunto razonable). */
const DEFAULT_FAVORITES = [
  "muro", "puerta", "ventana", "dormitorio", "bano", "comentario",
];

interface SketchLibraryProps {
  /** Se llama cuando el usuario elige una entidad desde el select móvil. */
  onSelectEntity: (entityId: string) => void;
  /** Tipo de bien para reordenar categorías (opcional). */
  bienType?: BienType;
}

/** Resuelve un icono de lucide por nombre. */
function getIcon(name: string): LucideIcons.LucideIcon {
  // lucide-react exporta iconos en PascalCase; el catálogo usa kebab-case.
  const pascal = name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  return (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[pascal] ?? LucideIcons.Square;
}

/** Wrapper de icono que usa createElement para evitar la regla static-components. */
function EntityIcon({ name, className }: { name: string; className?: string }) {
  return createElement(getIcon(name), { className });
}

/** Item arrastrable de la biblioteca. */
function EntityItem({ entity }: { entity: EntityDefinition }) {
  return (
    <div
      className="sketch-block-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/sketch-entity", entity.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span
        className="sketch-block-swatch"
        // Excepción REGLA #2: color dinámico del catálogo.
        style={{ backgroundColor: entity.fill === "transparent" ? "transparent" : entity.fill, borderColor: entity.stroke }}
      />
      <EntityIcon name={entity.icon} className="size-3.5 text-muted-foreground" />
      <span className="sketch-block-label">{entity.label}</span>
    </div>
  );
}

/** Acordeón de categoría. */
function CategoryAccordion({
  category,
  label,
  icon,
  isOpen,
  onToggle,
}: {
  category: EntityCategory;
  label: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const entities = getEntitiesByCategory(category);
  if (!entities || entities.length === 0) return null;

  return (
    <div className="sketch-palette-category">
      <button
        type="button"
        className="sketch-palette-title"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <EntityIcon name={icon} className="size-3.5 text-muted-foreground" />
        <span>{label}</span>
        <ChevronDown className={`size-3 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="sketch-palette-items">
          {entities.map((entity) => (
            <EntityItem key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SketchLibrary({ onSelectEntity, bienType }: SketchLibraryProps) {
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<EntityCategory | null>(
    bienType ? CATEGORY_ORDER_BY_BIEN[bienType][0] : "spaces"
  );

  /** Orden de categorías según tipo de bien. */
  const categoryOrder = useMemo(() => {
    if (!bienType) return CATEGORY_ORDER;
    const order = CATEGORY_ORDER_BY_BIEN[bienType];
    return order.map((id) => CATEGORY_ORDER.find((c) => c.id === id)!).filter(Boolean);
  }, [bienType]);

  /** Resultados de búsqueda (si hay query). */
  const searchResults = useMemo(() => {
    return search ? searchEntities(search) : [];
  }, [search]);

  /** Entidades favoritas. */
  const favorites = useMemo(() => {
    return DEFAULT_FAVORITES
      .map((id) => getAllEntities().find((e) => e.id === id))
      .filter(Boolean) as EntityDefinition[];
  }, []);

  const showSearch = search.length > 0;

  return (
    <>
      {/* Biblioteca lateral (desktop >=640px) */}
      <aside className="sketch-palette">
        {/* Buscador */}
        <div className="sketch-search">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            type="text"
            className="sketch-search-input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar entidad"
          />
        </div>

        {/* Resultados de búsqueda */}
        {showSearch ? (
          <div className="sketch-palette-category">
            <p className="sketch-palette-title">Resultados ({searchResults.length})</p>
            <div className="sketch-palette-items">
              {searchResults.length > 0 ? (
                searchResults.map((entity) => (
                  <EntityItem key={entity.id} entity={entity} />
                ))
              ) : (
                <p className="sketch-palette-empty">Sin resultados</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Favoritos */}
            <div className="sketch-palette-category">
              <p className="sketch-palette-title sketch-palette-title--favorites">
                <Star className="size-3.5 text-amber-500" />
                <span>Favoritos</span>
              </p>
              <div className="sketch-palette-items">
                {favorites.map((entity) => (
                  <EntityItem key={entity.id} entity={entity} />
                ))}
              </div>
            </div>

            {/* Categorías con acordeones */}
            {categoryOrder.map((cat) => (
              <CategoryAccordion
                key={cat.id}
                category={cat.id}
                label={cat.label}
                icon={cat.icon}
                isOpen={openCategory === cat.id}
                onToggle={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
              />
            ))}
          </>
        )}
      </aside>

      {/* Select colapsado (móvil <640px) */}
      <div className="sketch-palette-mobile">
        <select
          className="app-input"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) onSelectEntity(id);
            e.target.value = "";
          }}
          aria-label="Agregar entidad"
        >
          <option value="" disabled>
            Agregar entidad...
          </option>
          <optgroup label="Favoritos">
            {favorites.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </optgroup>
          {categoryOrder.map((cat) => {
            const entities = getEntitiesByCategory(cat.id);
            if (!entities || entities.length === 0) return null;
            return (
              <optgroup key={cat.id} label={cat.label}>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
    </>
  );
}
