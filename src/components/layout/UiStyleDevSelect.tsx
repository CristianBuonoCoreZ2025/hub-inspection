"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  persistUiThemeChoice,
  UI_THEME_LIST,
  UI_THEMES,
  type UiThemeId,
} from "@/lib/ui-style-client-store";
import { Palette } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";

export function UiStyleDevSelect() {
  const themeId = useSyncExternalStore(
    subscribeUiTheme,
    getUiThemeSnapshot,
    getUiStyleServerSnapshot
  );
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  const handleSelect = (value: UiThemeId) => {
    persistUiThemeChoice(value);
  };

  const currentTheme = UI_THEMES[themeId];

  return (
    <div className="ui-style-dev-select relative px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{mounted ? (currentTheme?.label ?? "Tema") : "Tema"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-3 right-3 z-50 mt-1 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
          {UI_THEME_LIST.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                handleSelect(theme.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                themeId === theme.id
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span
                className="size-2.5 rounded-full border border-white/20 shadow-sm"
                style={{ backgroundColor: theme.swatch }}
              />
              {theme.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
