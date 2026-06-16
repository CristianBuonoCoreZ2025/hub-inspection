"use client";

import { useEffect } from "react";
import { getUiStyleSnapshot } from "@/lib/ui-style-client-store";

export function UiStyleInjector() {
  useEffect(() => {
    const skin = getUiStyleSnapshot();
    document.documentElement.setAttribute("data-ui-style", skin);
  }, []);

  return null;
}
