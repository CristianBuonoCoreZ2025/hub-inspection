"use client";

const UI_STYLE_KEY = "claimshub-ui-style";

export type UiStyleSkin =
  | "liquid-glass"
  | "glassmorphism"
  | "material-3-expressive"
  | "neumorphism";

export const UI_STYLE_LABELS: Record<UiStyleSkin, string> = {
  "liquid-glass": "Liquid Glass",
  "glassmorphism": "Glassmorphism",
  "material-3-expressive": "Material 3 Expressive",
  "neumorphism": "Neumorphism",
};

export const UI_STYLE_ICONS: Record<UiStyleSkin, string> = {
  "liquid-glass": "💧",
  "glassmorphism": "🪟",
  "material-3-expressive": "🎨",
  "neumorphism": "⬜",
};

export function getUiStyleSnapshot(): UiStyleSkin {
  if (typeof window === "undefined") return "liquid-glass";
  try {
    const stored = localStorage.getItem(UI_STYLE_KEY) as UiStyleSkin | null;
    if (stored && UI_STYLE_LABELS[stored]) return stored;
  } catch {
    // ignore
  }
  return "liquid-glass";
}

export function getUiStyleServerSnapshot(): UiStyleSkin {
  return "liquid-glass";
}

export function subscribeUiStyle(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === UI_STYLE_KEY) callback();
  };
  window.addEventListener("storage", handler);

  // Custom event para cambios dentro de la misma pestaña
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
    // Disparar evento custom para que los suscriptores en la misma pestaña reaccionen
    window.dispatchEvent(new Event("ui-style-change"));
  } catch {
    // ignore
  }
}
