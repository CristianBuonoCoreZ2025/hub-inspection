"use client";

import { useEffect } from "react";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
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

  return null;
}
