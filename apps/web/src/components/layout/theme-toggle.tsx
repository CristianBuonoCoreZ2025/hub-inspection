"use client"

import { useSyncExternalStore } from "react"
import { Sun, Moon } from "lucide-react"
import { useMounted } from "@/hooks/use-mounted"
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  persistUiThemeChoice,
  UI_THEMES,
  type UiThemeId,
} from "@/lib/ui-style-client-store"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const themeId = useSyncExternalStore(subscribeUiTheme, getUiThemeSnapshot, getUiStyleServerSnapshot)
  const mounted = useMounted()
  const isDark = UI_THEMES[themeId]?.dark ?? false

  const currentIcon = mounted && isDark ? (
    <Moon className="size-4 shrink-0" />
  ) : (
    <Sun className="size-4 shrink-0" />
  )

  const handleSelect = (value: UiThemeId) => {
    persistUiThemeChoice(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="sidebar-item w-full cursor-pointer">
            {currentIcon}
            <span className="text-[11px] font-medium flex-1 text-left">Tema</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" side="right" className="w-48">
        <DropdownMenuRadioGroup value={themeId} onValueChange={(v) => handleSelect(v as UiThemeId)}>
          <DropdownMenuRadioItem value="nordic-air-light" className="text-xs">
            <Sun className="mr-2 size-4" />
            <span>Play Skin</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="nordic-air-dark" className="text-xs">
            <Moon className="mr-2 size-4" />
            <span>Tron Skin</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="fluid-aurora" className="text-xs">
            <Moon className="mr-2 size-4" />
            <span>Neon Skin</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
