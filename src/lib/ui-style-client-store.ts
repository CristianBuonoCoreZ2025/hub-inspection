"use client";

const UI_STYLE_KEY = "claimshub-ui-style";

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
  } catch {
    // ignore
  }
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
  return () => window.removeEventListener("storage", handler);
}

export function persistUiStyleChoice(skin: UiStyleSkin) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_STYLE_KEY, skin);
  } catch {
    // ignore
  }
}
