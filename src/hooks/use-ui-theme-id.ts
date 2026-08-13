"use client";

import { useSyncExternalStore } from "react";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  type UiThemeId,
} from "@/lib/ui-style-client-store";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Devuelve el ID del tema actual.
 * Usa el snapshot del servidor durante SSR para evitar mismatch.
 */
export function useUiThemeId(): UiThemeId {
  const themeId = useSyncExternalStore(
    subscribeUiTheme,
    getUiThemeSnapshot,
    getUiStyleServerSnapshot
  );
  const mounted = useMounted();
  if (!mounted) return "nordic-air-light";
  return themeId;
}
