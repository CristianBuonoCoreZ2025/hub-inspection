"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getUiStyleSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiStyle,
  persistUiStyleChoice,
  UI_STYLE_LABELS,
  type UiStyleSkin,
} from "@/lib/ui-style-client-store";
import { Palette } from "lucide-react";

export function UiStyleDevSelect() {
  const skin = useSyncExternalStore(
    subscribeUiStyle,
    getUiStyleSnapshot,
    getUiStyleServerSnapshot
  );
  const [open, setOpen] = useState(false);

  const handleSelect = (value: UiStyleSkin) => {
    persistUiStyleChoice(value);
    // Force reload to apply CSS variables from html[data-ui-style]
    window.location.reload();
  };

  return (
    <div className="relative px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{UI_STYLE_LABELS[skin]}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
          {(
            Object.keys(UI_STYLE_LABELS) as UiStyleSkin[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                handleSelect(key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                skin === key
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {UI_STYLE_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
