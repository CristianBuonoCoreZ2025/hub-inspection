"use client";

import { useRef, useCallback, type ReactNode } from "react";

/**
 * GroupedContactsList — iOS Stacking Sticky Headers.
 *
 * Patrón: listas agrupadas nativas de iOS (Contactos, Apple Music).
 * Los headers son `position: sticky` dentro del scroll y se apilan:
 *  - Participantes: sticky top:0, z-index más alto
 *  - Equipo: sticky top:H, z-index medio
 *  - Organización: sticky top:2H, z-index más bajo
 *
 * Por qué funciona (y las versiones anteriores no):
 *
 *  El bug raíz era `isolation: isolate` en cada <section>. Eso creaba un
 *  stacking context POR sección, haciendo que la sección 2 se pintara
 *  ENTERA por encima de la sección 1 (orden del DOM). Los items de Equipo
 *  tapaban al header sticky de Participantes.
 *
 *  Solución:
 *  1. UN solo stacking context: `isolation: isolate` en el contenedor scroll.
 *  2. NUNCA isolation en las secciones — todos los headers e items comparten
 *     el mismo contexto de z-index.
 *  3. z-index DECRECIENTE en headers: Participantes (N) > Equipo (N-1) > Org (N-2).
 *  4. Items a z-index: 0 — siempre debajo de cualquier header.
 *  5. Fondo SÓLIDO en headers (no translúcido) para que los items no se vean.
 *
 *  Con esto, el header de Participantes (z:N) pinta encima de TODO,
 *  el header de Equipo (z:N-1) pinta encima de los items pero debajo
 *  de Participantes, y así sucesivamente. Los items (z:0) siempre
 *  quedan debajo de todos los headers.
 *
 * Click en header → scroll suave a la sección.
 */

export interface GroupedContactsGroup<T> {
  title: string;
  items: T[];
}

export interface GroupedContactsListProps<T> {
  groups: GroupedContactsGroup<T>[];
  renderItem: (item: T, groupIndex: number) => ReactNode;
  getItemKey: (item: T) => string;
  emptyState?: ReactNode;
  /** Altura de cada header en px (default 24). Debe coincidir con el CSS. */
  headerHeight?: number;
  className?: string;
}

export function GroupedContactsList<T>({
  groups,
  renderItem,
  getItemKey,
  emptyState,
  headerHeight = 24,
  className,
}: GroupedContactsListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const hasContent = groups.some((g) => g.items.length > 0);

  const scrollToSection = useCallback(
    (idx: number) => {
      const section = sectionRefs.current[idx];
      const scrollContainer = scrollRef.current;
      if (!section || !scrollContainer) return;
      // Scroll para que la sección idx quede al borde superior del scroll area.
      // Restamos idx * headerHeight para compensar los headers acumulados arriba.
      const targetTop = section.offsetTop - idx * headerHeight;
      scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    },
    [headerHeight]
  );

  if (!hasContent && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div ref={scrollRef} className={`grouped-contacts-scroll ${className ?? ""}`}>
      {groups.map((group, idx) => (
        <section
          key={group.title}
          ref={(el) => {
            sectionRefs.current[idx] = el;
          }}
          className="grouped-contacts-section"
        >
          <header
            className="grouped-contacts-header"
            style={
              {
                top: idx * headerHeight,
                zIndex: groups.length - idx,
              } as React.CSSProperties
            }
            onClick={() => scrollToSection(idx)}
            role="button"
            tabIndex={0}
            aria-label={`Ir a ${group.title}`}
          >
            <span className="grouped-contacts-header-label">
              {group.title} ({group.items.length})
            </span>
          </header>
          <ul className="grouped-contacts-list">
            {group.items.map((item) => (
              <li key={getItemKey(item)} className="grouped-contacts-item">
                {renderItem(item, idx)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
