"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { SidebarNavigation } from "@/components/layout/app-sidebar"

function getPageTitle(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const last = segments[segments.length - 1] ?? "Dashboard"
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    siniestros: "Siniestros",
    inspecciones: "Inspecciones",
    agenda: "Agenda",
    evidencias: "Evidencias",
    informes: "Informes",
    usuarios: "Usuarios",
    empresas: "Empresas",
    configuracion: "Configuración",
  }
  return map[last] ?? last.charAt(0).toUpperCase() + last.slice(1)
}

export function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const pageTitle = getPageTitle(pathname)

  return (
    <>
      <header
        className={cn(
          "flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md",
          "lg:px-6"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>

          {/* Desktop breadcrumbs / title */}
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <span>Hub Inspections</span>
            <ChevronRight className="size-4" />
            <span className="font-medium text-foreground">{pageTitle}</span>
          </div>

          {/* Mobile title */}
          <span className="text-sm font-medium lg:hidden">{pageTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
