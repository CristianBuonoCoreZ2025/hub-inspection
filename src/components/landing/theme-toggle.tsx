"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  persistUiThemeChoice,
  UI_THEMES,
  type UiThemeId,
} from "@/lib/ui-style-client-store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const themeId = useSyncExternalStore(subscribeUiTheme, getUiThemeSnapshot, getUiStyleServerSnapshot);
  const isDark = UI_THEMES[themeId]?.dark ?? false;

  const toggle = () => {
    const next: UiThemeId = isDark ? "nordic-air-light" : "nordic-air-dark";
    persistUiThemeChoice(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Cambiar tema"
      className="shrink-0"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
