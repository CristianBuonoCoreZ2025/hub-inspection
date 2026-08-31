"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseDockMagnificationOptions {
  /** Escala pico en la posición del cursor (1.4 = 40% de crecimiento). */
  maxScale?: number;
  /** Dispersión (sigma) en px — qué tan lejos llega la magnificación.
   *  Debe ser ~1.2x el ancho del icono para que SOLO el icono bajo el
   *  cursor y su vecino inmediato crezcan, no todo el bloque. */
  spread?: number;
  /** Selector de los items magnificables dentro del contenedor. */
  itemSelector?: string;
}

interface ItemCache {
  el: HTMLElement;
  /** Centro X de reposo (scale=1) en coordenadas de viewport. */
  restCenterX: number;
}

/**
 * Magnificación "Liquid Glass Dock" estilo Apple.
 *
 * Trackea la posición X del cursor sobre `containerRef` y escala cada item
 * que coincide con `itemSelector` usando una caída Gaussiana, de modo que
 * SOLO el icono bajo el cursor (y sus vecinos inmediatos) crezcan — como
 * si una gota de vidrio líquido pasara sobre la barra.
 *
 * Las posiciones de reposo se cachean al entrar el cursor (antes de escalar)
 * para evitar realimentación visual y garantizar que el cálculo use siempre
 * las posiciones originales, no las escaladas.
 *
 * Setea en cada item la variable CSS `--dock-scale` (usada por el transform)
 * y en el contenedor `--dock-x` / `--dock-active` (usadas por el lente
 * líquido que barre la barra).
 *
 * Se deshabilita automáticamente en dispositivos touch / sin hover y cuando
 * el usuario prefiere movimiento reducido (accesibilidad).
 */
export function useDockMagnification<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  {
    maxScale = 1.4,
    spread = 52,
    itemSelector = ".dock-item",
  }: UseDockMagnificationOptions = {},
) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = containerRef.current;
    if (!el) return;

    // Sin magnificación en touch / sin hover o movimiento reducido.
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cache: ItemCache[] = [];

    const buildCache = () => {
      // Reset a scale=1 antes de medir, para obtener posiciones de reposo.
      for (const it of el.querySelectorAll<HTMLElement>(itemSelector)) {
        it.style.setProperty("--dock-scale", "1");
      }
      cache = Array.from(
        el.querySelectorAll<HTMLElement>(itemSelector),
      ).map((it) => {
        const ir = it.getBoundingClientRect();
        return { el: it, restCenterX: ir.left + ir.width / 2 };
      });
    };

    const reset = () => {
      el.style.setProperty("--dock-active", "0");
      el.style.setProperty("--dock-x", "-9999px");
      for (const { el: it } of cache) {
        it.style.setProperty("--dock-scale", "1");
      }
    };

    const onEnter = () => {
      el.classList.add("dock-tracking");
      buildCache();
    };

    const onMove = (e: MouseEvent) => {
      const mx = e.clientX;
      if (!el.classList.contains("dock-tracking")) {
        el.classList.add("dock-tracking");
        buildCache();
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--dock-x", `${mx - rect.left}px`);
        el.style.setProperty("--dock-active", "1");

        const twoSigmaSq = 2 * spread * spread;
        const boost = maxScale - 1;
        for (const { el: it, restCenterX } of cache) {
          const d = mx - restCenterX;
          // Caída Gaussiana: pico en el cursor, decae rápido con la distancia.
          const scale = 1 + boost * Math.exp(-(d * d) / twoSigmaSq);
          it.style.setProperty("--dock-scale", scale.toFixed(3));
        }
      });
    };

    const onLeave = () => {
      el.classList.remove("dock-tracking");
      reset();
    };

    const onScrollOrResize = () => {
      if (el.classList.contains("dock-tracking")) buildCache();
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    reset();

    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      el.classList.remove("dock-tracking");
      reset();
    };
  }, [containerRef, maxScale, spread, itemSelector]);
}
