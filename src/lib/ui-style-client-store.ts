"use client";

const UI_THEME_KEY = "claimshub-ui-theme";

/**
 * Tema unificado — combina skin + modo (claro/oscuro).
 * Cada tema define un skin y un modo dark/light.
 * Neon Skin es siempre oscuro (no tiene variante clara).
 */
export type UiThemeId = "nordic-air-light" | "nordic-air-dark" | "fluid-aurora";

export interface UiTheme {
  id: UiThemeId;
  label: string;
  skin: string;
  dark: boolean;
  swatch: string;
}

export const UI_THEMES: Record<UiThemeId, UiTheme> = {
  "nordic-air-light": {
    id: "nordic-air-light",
    label: "Play Skin",
    skin: "nordic-air",
    dark: false,
    swatch: "#7aaec7",
  },
  "nordic-air-dark": {
    id: "nordic-air-dark",
    label: "Tron Skin",
    skin: "nordic-air",
    dark: true,
    swatch: "#2D5078",
  },
  "fluid-aurora": {
    id: "fluid-aurora",
    label: "Neon Skin",
    skin: "fluid-aurora",
    dark: true,
    swatch: "#89ceff",
  },
};

export const UI_THEME_LIST = Object.values(UI_THEMES);

/** Alias para compatibilidad con código existente */
export type UiStyleSkin = UiThemeId;

export const UI_STYLE_LABELS: Record<UiThemeId, string> = {
  "nordic-air-light": "Play Skin",
  "nordic-air-dark": "Tron Skin",
  "fluid-aurora": "Neon Skin",
};

export const UI_STYLE_SWATCHES: Record<UiThemeId, string> = {
  "nordic-air-light": "#7aaec7",
  "nordic-air-dark": "#2D5078",
  "fluid-aurora": "#89ceff",
};

export function getUiThemeSnapshot(): UiThemeId {
  if (typeof window === "undefined") return "nordic-air-light";
  try {
    const stored = localStorage.getItem(UI_THEME_KEY) as UiThemeId | null;
    if (stored && UI_THEMES[stored]) return stored;
    // Migración: si existe la key vieja, inferir tema
    const oldSkin = localStorage.getItem("claimshub-ui-style") as string | null;
    if (oldSkin === "fluid-aurora") return "fluid-aurora";
    if (oldSkin === "nordic-air") {
      const isDark = document.documentElement.classList.contains("dark");
      return isDark ? "nordic-air-dark" : "nordic-air-light";
    }
  } catch {}
  return "nordic-air-light";
}

/** Alias para compatibilidad */
export function getUiStyleSnapshot(): UiThemeId {
  return getUiThemeSnapshot();
}

export function getUiStyleServerSnapshot(): UiThemeId {
  return "nordic-air-light";
}

export function subscribeUiTheme(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === UI_THEME_KEY) callback();
  };
  window.addEventListener("storage", handler);
  const customHandler = () => callback();
  window.addEventListener("ui-theme-change", customHandler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("ui-theme-change", customHandler);
  };
}

/** Alias para compatibilidad */
export function subscribeUiStyle(callback: () => void): () => void {
  return subscribeUiTheme(callback);
}

export function persistUiThemeChoice(theme: UiThemeId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_THEME_KEY, theme);
    // Limpiar key vieja
    localStorage.removeItem("claimshub-ui-style");
    window.dispatchEvent(new Event("ui-theme-change"));
  } catch {}
}

/** Alias para compatibilidad */
export function persistUiStyleChoice(theme: UiThemeId) {
  persistUiThemeChoice(theme);
}
