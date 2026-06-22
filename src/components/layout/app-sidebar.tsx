"use client"

import { useState } from "react"
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
  AlertTriangle,
  Landmark,
  Briefcase,
  Tag,
  Box,
  ChevronDown,
  ChevronRight,
  Upload,
  MapPin,
  FileWarning,
  Shield,
  Home,
  Warehouse,
  CalendarDays,
  Heart,
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
  { href: "/dashboard/claims", label: "Siniestros", icon: FileText },
  { href: "/dashboard/inspecciones", label: "Inspecciones", icon: ClipboardCheck },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { href: "/dashboard/evidencias", label: "Evidencias", icon: Image },
  { href: "/dashboard/informes", label: "Informes", icon: BarChart3 },
]

const catalogLinks = [
  { href: "/dashboard/catalogos/ubicaciones", label: "Ubicaciones", icon: MapPin },
  { href: "/dashboard/catalogos/causas", label: "Causas Siniestro", icon: AlertTriangle },
  { href: "/dashboard/catalogos/tipos-siniestros", label: "Tipos Siniestro", icon: FileWarning },
  { href: "/dashboard/catalogos/companias", label: "Compañias Seguros", icon: Landmark },
  { href: "/dashboard/catalogos/corredores", label: "Corredores", icon: Briefcase },
  { href: "/dashboard/catalogos/asesores", label: "Asesores", icon: Users },
  { href: "/dashboard/catalogos/lineas-negocio", label: "Lineas de Negocio", icon: Tag },
  { href: "/dashboard/catalogos/productos", label: "Ramos/Productos", icon: Box },
  { href: "/dashboard/catalogos/clasificacion-bien", label: "Clasificacion Bien", icon: Home },
  { href: "/dashboard/catalogos/clasificacion-danos", label: "Clasificacion Danos", icon: FileWarning },
  { href: "/dashboard/catalogos/tipos-polizas", label: "Tipos Polizas", icon: Shield },
  { href: "/dashboard/catalogos/destinos-vivienda", label: "Destinos Vivienda", icon: Warehouse },
  { href: "/dashboard/catalogos/antiguedades", label: "Antiguedad Inmueble", icon: CalendarDays },
  { href: "/dashboard/catalogos/parentescos", label: "Parentescos", icon: Heart },
]

const adminLinks = [
  { href: "/dashboard/users", label: "Usuarios", icon: Users },
  { href: "/dashboard/companies", label: "Empresas", icon: Building2 },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
]

const operationLinks = [
  { href: "/dashboard/operaciones/carga-siniestros", label: "Carga Siniestros", icon: Upload },
  { href: "/dashboard/operaciones/carga-catalogos", label: "Carga Catálogos", icon: Upload },
]

function getInitials(email?: string | null) {
  if (!email) return "U"
  const parts = email.split("@")[0].split(/[._-]/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function NavSection({ title, links, pathname, onNavigate, open, onToggle }: { title: string; links: typeof catalogLinks; pathname: string; onNavigate?: () => void; open: boolean; onToggle: () => void }) {
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 pl-1">
          {links.map((link) => {
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
      )}
    </div>
  )
}

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, isLoading, signOut } = useAuth()

  const isCatalogActive = catalogLinks.some((l) => pathname.startsWith(l.href))
  const isAdminActive = adminLinks.some((l) => pathname.startsWith(l.href))
  const isOperationActive = operationLinks.some((l) => pathname.startsWith(l.href))
  const [activeSection, setActiveSection] = useState<"catalogs" | "admin" | "operations" | null>(
    isCatalogActive ? "catalogs" : isAdminActive ? "admin" : isOperationActive ? "operations" : null
  )

  const toggle = (section: "catalogs" | "admin" | "operations") => {
    setActiveSection((prev) => (prev === section ? null : section))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <span className="font-heading text-base font-semibold tracking-tight">
          Claims Hub
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

        <NavSection
          title="Catálogos"
          links={catalogLinks}
          pathname={pathname}
          onNavigate={onNavigate}
          open={activeSection === "catalogs"}
          onToggle={() => toggle("catalogs")}
        />
        <NavSection
          title="Operaciones"
          links={operationLinks}
          pathname={pathname}
          onNavigate={onNavigate}
          open={activeSection === "operations"}
          onToggle={() => toggle("operations")}
        />
        <NavSection
          title="Administración"
          links={adminLinks}
          pathname={pathname}
          onNavigate={onNavigate}
          open={activeSection === "admin"}
          onToggle={() => toggle("admin")}
        />
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
