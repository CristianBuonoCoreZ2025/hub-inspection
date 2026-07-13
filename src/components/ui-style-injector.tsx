"use client";

import { useEffect } from "react";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
  UI_STYLE_LABELS,
  type UiStyleSkin,
  getSidebarStyleSnapshot,
  getSidebarStyleServerSnapshot,
  subscribeSidebarStyle,
  SIDEBAR_STYLE_LABELS,
  type SidebarStyle,
} from "@/lib/ui-style-client-store";
import { useSyncExternalStore } from "react";

export function UiStyleInjector() {
  const skin = useSyncExternalStore(
    subscribeUiStyle,
    getUiStyleSnapshot,
    getUiStyleSnapshot
  );
  const sidebarStyle = useSyncExternalStore(
    subscribeSidebarStyle,
    getSidebarStyleSnapshot,
    getSidebarStyleServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-style", skin);
  }, [skin]);

  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar-style", sidebarStyle);
  }, [sidebarStyle]);

  return null;
}
