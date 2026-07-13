"use client";

const UI_STYLE_KEY = "claimshub-ui-style";
const SIDEBAR_STYLE_KEY = "claimshub-sidebar-style";

// ═══════════════════════════════════════════════════════════════
// SKIN BASE — controla colores, tipografia de toda la app
// ═══════════════════════════════════════════════════════════════
export type UiStyleSkin =
  | "nordic-air"
  | "pastel-dream"
  | "bubble-play"
  | "kinetic-pop"
  | "neo-playful";

export const UI_STYLE_LABELS: Record<UiStyleSkin, string> = {
  "nordic-air": "Aire Nórdico",
  "pastel-dream": "Pastel Dream",
  "bubble-play": "Bubble Play",
  "kinetic-pop": "Kinetic Pop",
  "neo-playful": "Neo Playful",
};

export function getUiStyleSnapshot(): UiStyleSkin {
  if (typeof window === "undefined") return "nordic-air";
  try {
    const stored = localStorage.getItem(UI_STYLE_KEY) as UiStyleSkin | null;
    if (stored && UI_STYLE_LABELS[stored]) return stored;
  } catch {}
  return "nordic-air";
}

export function getUiStyleServerSnapshot(): UiStyleSkin {
  return "nordic-air";
}

export function subscribeUiStyle(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === UI_STYLE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  const customHandler = () => callback();
  window.addEventListener("ui-style-change", customHandler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("ui-style-change", customHandler);
  };
}

export function persistUiStyleChoice(skin: UiStyleSkin) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_STYLE_KEY, skin);
    window.dispatchEvent(new Event("ui-style-change"));
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// ESTILO DEL SIDEBAR — controla estructura, bordes, selecciones
// NO cambia colores, solo forma
// ═══════════════════════════════════════════════════════════════
export type SidebarStyle = "default" | "liquid-glass" | "glassmorphism";

export const SIDEBAR_STYLE_LABELS: Record<SidebarStyle, string> = {
  "default": "Default",
  "liquid-glass": "Liquid Glass",
  "glassmorphism": "Glassmorphism",
};

export function getSidebarStyleSnapshot(): SidebarStyle {
  if (typeof window === "undefined") return "default";
  try {
    const stored = localStorage.getItem(SIDEBAR_STYLE_KEY) as SidebarStyle | null;
    if (stored && SIDEBAR_STYLE_LABELS[stored]) return stored;
  } catch {}
  return "default";
}

export function getSidebarStyleServerSnapshot(): SidebarStyle {
  return "default";
}

export function subscribeSidebarStyle(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === SIDEBAR_STYLE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  const customHandler = () => callback();
  window.addEventListener("sidebar-style-change", customHandler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("sidebar-style-change", customHandler);
  };
}

export function persistSidebarStyleChoice(style: SidebarStyle) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_STYLE_KEY, style);
    window.dispatchEvent(new Event("sidebar-style-change"));
  } catch {}
}
