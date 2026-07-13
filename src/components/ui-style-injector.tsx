"use client";

import { useEffect } from "react";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
  UI_STYLE_LABELS,
  type UiStyleSkin,
} from "@/lib/ui-style-client-store";
import { useSyncExternalStore } from "react";

export function UiStyleInjector() {
  const skin = useSyncExternalStore(
    subscribeUiStyle,
    getUiStyleSnapshot,
    getUiStyleSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-style", skin);
  }, [skin]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "claimshub-ui-style" && e.newValue && e.newValue in UI_STYLE_LABELS) {
        document.documentElement.setAttribute("data-ui-style", e.newValue as UiStyleSkin);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return null;
}
