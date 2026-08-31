"use client";

import { useSyncExternalStore } from "react";

function subscribeToMediaQuery(query: string, callback: () => void): () => void {
  const mediaQueryList = window.matchMedia(query);
  const handler = () => callback();
  mediaQueryList.addEventListener("change", handler);
  return () => mediaQueryList.removeEventListener("change", handler);
}

function getMediaQuerySnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getMediaQueryServerSnapshot(): boolean {
  return false;
}

function useMediaQueryValue(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribeToMediaQuery(query, callback),
    () => getMediaQuerySnapshot(query),
    getMediaQueryServerSnapshot
  );
}

/**
 * Hook para detectar si el dispositivo actual es móvil o tablet.
 * Usa MediaQueryList como store externo para evitar renders en cascada.
 *
 * @param maxWidth — breakpoint máximo en px (default: 1023 = móvil + tablet)
 * @returns { isMobile: boolean, isTablet: boolean, isDesktop: boolean }
 */
export function useMediaQuery(maxWidth = 1023): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const isMobile = useMediaQueryValue(`(max-width: ${maxWidth}px)`);
  const isTablet = useMediaQueryValue("(min-width: 768px) and (max-width: 1023px)");

  return { isMobile, isTablet, isDesktop: !isMobile };
}
