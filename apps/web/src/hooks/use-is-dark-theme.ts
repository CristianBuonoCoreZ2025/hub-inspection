"use client";

import { useSyncExternalStore } from "react";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  UI_THEMES,
} from "@/lib/ui-style-client-store";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Devuelve true si el tema actual es oscuro.
 * Usa el snapshot del servidor durante SSR para evitar mismatch.
 */
export function useIsDarkTheme(): boolean {
  const themeId = useSyncExternalStore(
    subscribeUiTheme,
    getUiThemeSnapshot,
    getUiStyleServerSnapshot
  );
  const mounted = useMounted();
  if (!mounted) return false;
  return UI_THEMES[themeId]?.dark ?? false;
}
