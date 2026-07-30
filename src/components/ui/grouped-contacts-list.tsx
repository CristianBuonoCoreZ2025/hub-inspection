"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

/**
 * GroupedContactsList — ScrollSpy + Fixed Header Stack.
 *
 * Patrón: PanelBar vertical controlado por scroll.
 * NO es sticky headers. Los headers viven FUERA del contenedor scroll
 * en una capa fija (flex item arriba), y se acumulan a medida que el
 * ScrollSpy detecta que cada sección scrollea pasado el borde superior.
 *
 * Arquitectura:
 *  ┌─────────────────────────────────────┐
 *  │ container (flex col)                │
 *  │  ┌───────────────────────────────┐  │
 *  │  │ header-stack (flex item)       │  │  ← crece con cada header
 *  │  │  Participantes                 │  │     acumulado, NUNCA dentro
 *  │  │  Equipo                         │  │     del scroll
 *  │  │  Organización                   │  │
 *  │  └───────────────────────────────┘  │
 *  │  ┌───────────────────────────────┐  │
 *  │  │ scroll-area (flex:1, overflow) │  │  ← SOLO items, sin headers
 *  │  │  section Participantes         │  │     sin spacers
 *  │  │  section Equipo                │  │
 *  │  │  section Organización          │  │
 *  │  └───────────────────────────────┘  │
 *  └─────────────────────────────────────┘
 *
 * Por qué NO hay spacers:
 *  Los headers están fuera del scroll (flex item arriba). El scroll area
 *  empieza debajo del header-stack. No hay overlap. Los items nunca
 *  quedan ocultos detrás de un header.
 *
 * Por qué NO hay scroll adjustment:
 *  Cuando el header-stack crece, el scroll area se encoge. El contenido
 *  que se corta es el de abajo (no el de arriba), que el usuario ya está
 *  dejando atrás al scrollear hacia abajo. Al subir, el scroll area crece
 *  y aparece contenido nuevo abajo. El efecto es natural y sin saltos.
 *
 * ScrollSpy:
 *  Una sección N se considera "consumida" cuando su offsetTop <= scrollTop.
 *  Es decir, su borde superior ya pasó el borde superior del scroll area.
 *  En ese momento, su header aparece en la pila.
 *  Al subir, si offsetTop > scrollTop, la sección ya no está consumida
 *  y su header desaparece de la pila.
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
  // Índice de la última sección consumida. Empieza en 0 (Participantes siempre visible).
  const [lastVisibleSection, setLastVisibleSection] = useState(0);
  // Flag para suprimir recompute durante scroll programático (click en header).
  const isProgrammaticScroll = useRef(false);

  const hasContent = groups.some((g) => g.items.length > 0);

  // ─── ScrollSpy ───
  useEffect(() => {
    if (!hasContent) return;
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const recompute = () => {
      // Durante scroll programático (click en header), no recalculamos.
      // El flag se limpia con un timeout tras el smooth scroll.
      if (isProgrammaticScroll.current) return;

      const scrollTop = scrollContainer.scrollTop;
      let highest = 0;
      for (let i = 1; i < sectionRefs.current.length; i++) {
        const section = sectionRefs.current[i];
        if (!section) continue;
        // Sección consumida cuando su borde superior pasó el borde superior
        // del scroll area. +1 de tolerancia para floating point.
        if (section.offsetTop <= scrollTop + 1) {
          highest = i;
        } else {
          break; // secciones en orden: si esta no pasó, las siguientes tampoco
        }
      }
      setLastVisibleSection(highest);
    };

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recompute);
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    recompute();

    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [groups, hasContent]);

  // ─── Click en header → scroll suave a la sección ───
  const scrollToSection = useCallback(
    (idx: number) => {
      const section = sectionRefs.current[idx];
      const scrollContainer = scrollRef.current;
      if (!section || !scrollContainer) return;

      // Suprimir recompute durante el smooth scroll para evitar
      // que los headers parpadeen mientras la animación transcurre.
      isProgrammaticScroll.current = true;

      // Scroll a la posición donde la sección idx queda al borde superior
      // del scroll area. Después del scroll, el header de idx (y todos los
      // anteriores) deben estar visibles en la pila.
      scrollContainer.scrollTo({ top: section.offsetTop, behavior: "smooth" });

      // Limpiar flag tras la animación. 400ms es suficiente para smooth scroll.
      window.setTimeout(() => {
        isProgrammaticScroll.current = false;
        // Recalcular una vez terminada la animación para sincronizar headers.
        const scrollTop = scrollContainer.scrollTop;
        let highest = 0;
        for (let i = 1; i < sectionRefs.current.length; i++) {
          const s = sectionRefs.current[i];
          if (!s) continue;
          if (s.offsetTop <= scrollTop + 1) {
            highest = i;
          } else {
            break;
          }
        }
        setLastVisibleSection(highest);
      }, 450);
    },
    []
  );

  if (!hasContent && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  // Headers acumulados: desde 0 hasta lastVisibleSection (inclusive).
  const visibleHeaders = groups.slice(0, lastVisibleSection + 1);

  return (
    <div className={`grouped-contacts-container ${className ?? ""}`}>
      {/* Capa fija de headers acumulados — flex item, fuera del scroll */}
      <div className="grouped-contacts-header-stack">
        {visibleHeaders.map((group, idx) => (
          <button
            key={group.title}
            type="button"
            className="grouped-contacts-header"
            onClick={() => scrollToSection(idx)}
            title={`Ir a ${group.title}`}
          >
            <span className="grouped-contacts-header-label">
              {group.title} ({group.items.length})
            </span>
          </button>
        ))}
      </div>

      {/* Área de scroll — SOLO items, sin headers, sin spacers */}
      <div ref={scrollRef} className="grouped-contacts-scroll">
        {groups.map((group, idx) => (
          <section
            key={group.title}
            data-section-index={idx}
            ref={(el) => {
              sectionRefs.current[idx] = el;
            }}
            className="grouped-contacts-section"
          >
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
    </div>
  );
}
