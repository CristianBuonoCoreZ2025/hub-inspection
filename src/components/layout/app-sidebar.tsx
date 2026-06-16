"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Calendar,
  Image,
  BarChart3,
  Users,
  Building2,
  Settings,
  ShieldCheck,
  LogOut,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UiStyleDevSelect } from "@/components/layout/UiStyleDevSelect"

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/siniestros", label: "Siniestros", icon: FileText },
  { href: "/dashboard/inspecciones", label: "Inspecciones", icon: ClipboardCheck },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { href: "/dashboard/evidencias", label: "Evidencias", icon: Image },
  { href: "/dashboard/informes", label: "Informes", icon: BarChart3 },
]

const adminLinks = [
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users },
  { href: "/dashboard/empresas", label: "Empresas", icon: Building2 },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

function getInitials(email?: string | null) {
  if (!email) return "U"
  const parts = email.split("@")[0].split(/[._-]/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, isLoading, signOut } = useAuth()

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <span className="font-heading text-base font-semibold tracking-tight">
          Hub Inspections
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mb-6 space-y-1">
          {mainLinks.map((link) => {
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Administración
        </div>
        <div className="space-y-1">
          {adminLinks.map((link) => {
            const isActive = pathname.startsWith(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <Separator />

      {/* Theme & UI Style */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Apariencia
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1">
          <ThemeToggle />
          <span className="text-xs text-muted-foreground">Tema</span>
        </div>
        <UiStyleDevSelect />
      </div>

      <Separator />

      {/* User */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-primary">
              {isLoading ? "..." : getInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {isLoading ? "Cargando..." : user?.email ?? "Usuario"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {isLoading ? "" : user?.email ?? ""}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex lg:w-[260px] lg:flex-col lg:border-r lg:bg-card">
      <SidebarNavigation />
    </aside>
  )
}
