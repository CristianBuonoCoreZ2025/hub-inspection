"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { useMounted } from "@/hooks/use-mounted"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, resolvedTheme, theme } = useTheme()
  const mounted = useMounted()

  const currentIcon =
    mounted && resolvedTheme === "dark" ? (
      <Moon className="size-4 shrink-0" />
    ) : (
      <Sun className="size-4 shrink-0" />
    )

  const currentValue = mounted ? theme ?? "system" : "system"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="sidebar-item w-full cursor-pointer">
            {currentIcon}
            <span className="text-[12px] font-medium flex-1 text-left">Tema</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" side="right" className="w-48">
        <DropdownMenuRadioGroup value={currentValue} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="text-xs">
            <Sun className="mr-2 size-4" />
            <span>Claro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-xs">
            <Moon className="mr-2 size-4" />
            <span>Oscuro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-xs">
            <Monitor className="mr-2 size-4" />
            <span>Sistema</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
