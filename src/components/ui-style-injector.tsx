"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  UI_THEMES,
  type UiThemeId,
} from "@/lib/ui-style-client-store";

export function UiStyleInjector() {
  const themeId = useSyncExternalStore(
    subscribeUiTheme,
    getUiThemeSnapshot,
    getUiStyleServerSnapshot
  );

  useEffect(() => {
    const theme = UI_THEMES[themeId as UiThemeId] ?? UI_THEMES["nordic-air-light"];
    // data-ui-style apunta al skin, no al themeId. El skin se combina con .dark para light/dark.
    document.documentElement.setAttribute("data-ui-style", theme.skin);
    // Sincronizar clase .dark para compatibilidad con CSS existente
    if (theme.dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, [themeId]);

  return null;
}
