"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LogOut,
  Loader2,
  Palette,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNavLinks } from "@/hooks/use-nav-links";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
  persistUiStyleChoice,
  UI_STYLE_LABELS,
  type UiStyleSkin,
  getSidebarStyleSnapshot,
  getSidebarStyleServerSnapshot,
  subscribeSidebarStyle,
  persistSidebarStyleChoice,
  SIDEBAR_STYLE_LABELS,
  type SidebarStyle,
} from "@/lib/ui-style-client-store";
import { useSyncExternalStore } from "react";
import { LayoutPanelLeft } from "lucide-react";
import type { NavLink, NavGroup } from "@/components/layout/nav-data";

function getInitials(email?: string | null) {
  if (!email) return "U";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════
// Flyout mejorado para grupos con sub-niveles
// Panel más amplio, header con icono, indicador activo
// ═══════════════════════════════════════════════════════════════
function HybridFlyout({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup & { visibleLinks: NavLink[] };
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isGroupActive = group.visibleLinks.some(l => pathname.startsWith(l.href));
  const Icon = group.icon;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 200);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Grupo del sidebar con icono + label */}
      <div
        className={cn(
          "sidebar-item cursor-pointer",
          (isGroupActive || open) && "sidebar-item-active"
        )}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="text-[12px] font-medium truncate flex-1">{group.title}</span>
        <span className={cn(
          "size-1.5 rounded-full shrink-0 transition-colors",
          isGroupActive ? "bg-primary" : "bg-muted-foreground/40"
        )} />
      </div>

      {/* Flyout panel */}
      {open && (
        <>
          {/* Bridge invisible para evitar gap entre icono y panel */}
          <div className="absolute left-full top-0 h-full w-2 z-40" />

          <div className="hybrid-flyout-panel absolute left-full top-0 ml-2 z-50 w-64 rounded-2xl border border-white/15 dark:border-white/8 overflow-hidden
                          bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]
                          backdrop-blur-2xl saturate-150
                          shadow-[0_8px_40px_rgba(0,0,0,0.12)]
                          dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]
                          dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            {/* Glass shine */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,transparent_40%)]" />
            {/* Header del flyout */}
            <div className="relative flex items-center gap-2 border-b border-white/10 dark:border-white/5 px-3 py-2.5">
              <div className={cn(
                "flex size-6 items-center justify-center rounded-lg shrink-0",
                isGroupActive ? "bg-primary/20 text-primary" : "bg-white/8 text-muted-foreground"
              )}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{group.title}</p>
                <p className="text-[9px] text-muted-foreground">{group.visibleLinks.length} páginas</p>
              </div>
            </div>

            {/* Lista de sub-páginas */}
            <div className="relative p-1 max-h-[520px] overflow-y-auto">
              {group.visibleLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => { onNavigate?.(); setOpen(false); }}
                    className={cn(
                      "group/item flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary font-medium shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                        : "text-muted-foreground hover:bg-white/8 hover:text-foreground font-normal"
                    )}
                  >
                    <LinkIcon className={cn(
                      "size-3.5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60 group-hover/item:text-foreground"
                    )} />
                    <span className="flex-1 truncate">{link.label}</span>
                    {/* Indicador activo: barra lateral */}
                    {isActive && (
                      <span className="h-3 w-0.5 rounded-full bg-primary shadow-[0_0_6px_rgba(139,92,246,0.6)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Selector de skin base — colores y tipografia de toda la app
// ═══════════════════════════════════════════════════════════════
function SkinToggle() {
  const skin = useSyncExternalStore(subscribeUiStyle, getUiStyleSnapshot, getUiStyleSnapshot);

  const handleSelect = (value: UiStyleSkin) => {
    persistUiStyleChoice(value);
    document.documentElement.setAttribute("data-ui-style", value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Color de interfaz">
            <Palette className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="right">
        <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Color</p>
        {(Object.keys(UI_STYLE_LABELS) as UiStyleSkin[]).map((key) => (
          <DropdownMenuItem key={key} onClick={() => handleSelect(key)}>
            <span className={cn("mr-2 size-2 rounded-full", skin === key ? "bg-primary" : "bg-transparent border border-border")} />
            <span>{UI_STYLE_LABELS[key]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ═══════════════════════════════════════════════════════════════
// Selector de estilo del sidebar — estructura y forma
// NO cambia colores, solo bordes, selecciones, submenu
// ═══════════════════════════════════════════════════════════════
function SidebarStyleToggle() {
  const style = useSyncExternalStore(subscribeSidebarStyle, getSidebarStyleSnapshot, getSidebarStyleServerSnapshot);

  const handleSelect = (value: SidebarStyle) => {
    persistSidebarStyleChoice(value);
    document.documentElement.setAttribute("data-sidebar-style", value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Estilo del menu">
            <LayoutPanelLeft className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="right">
        <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Menu</p>
        {(Object.keys(SIDEBAR_STYLE_LABELS) as SidebarStyle[]).map((key) => (
          <DropdownMenuItem key={key} onClick={() => handleSelect(key)}>
            <span className={cn("mr-2 size-2 rounded-full", style === key ? "bg-primary" : "bg-transparent border border-border")} />
            <span>{SIDEBAR_STYLE_LABELS[key]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ═══════════════════════════════════════════════════════════════
// Icono de link principal con tooltip
// ═══════════════════════════════════════════════════════════════
function MainLinkIcon({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn("sidebar-item", isActive && "sidebar-item-active")}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="text-[12px] font-medium truncate">{link.label}</span>
    </Link>
  );
}

export function HybridNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const { visibleMainLinks, visibleGroups } = useNavLinks();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      {/* Sidebar (left) — premium floating labeled glass panel */}
      <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:w-[220px] lg:shrink-0 lg:py-4">
        <aside className="sidebar-glass flex flex-col w-[200px] py-4 gap-3">
          {/* Contenido */}
          <div className="relative z-10 flex flex-col w-full h-full gap-3 px-3">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-[14px] bg-primary/10 text-primary shrink-0 transition-all duration-200 hover:bg-primary/15"
            >
              <div className="flex size-10 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shrink-0 transition-all duration-200 hover:scale-105 shadow-[0_0_20px_rgba(139,92,246,0.35)]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold leading-tight">Claims Hub</span>
                <span className="text-[10px] text-primary/70 leading-tight">Dashboard</span>
              </div>
            </Link>

            <div className="sidebar-divider" />

            {/* Main links */}
            <div className="flex flex-col gap-1 w-full">
              {visibleMainLinks
                .filter(l => l.href !== "/dashboard") // dashboard ya está en el logo
                .map((link) => (
                  <MainLinkIcon
                    key={link.href}
                    link={link}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
            </div>

            <div className="sidebar-divider" />

            {/* Group links with flyout */}
            <div className="flex flex-col gap-1 w-full">
              {visibleGroups.map((group) => (
                <HybridFlyout
                  key={group.title}
                  group={group}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>

            {/* User + theme + skin at bottom */}
            <div className="mt-auto flex flex-col gap-1 w-full pt-2">
              <div className="sidebar-item">
                <SkinToggle />
                <span className="text-[12px] font-medium">Color</span>
              </div>

              <div className="sidebar-item">
                <SidebarStyleToggle />
                <span className="text-[12px] font-medium">Menu</span>
              </div>

              <div className="sidebar-item">
                <ThemeToggle />
                <span className="text-[12px] font-medium">Tema</span>
              </div>

              <div ref={userRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="sidebar-item w-full"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs border border-primary/20">
                      {isLoading ? "..." : getInitials(user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-[12px] font-medium truncate">{isLoading ? "Cargando..." : user?.email ?? "Usuario"}</span>
                    <span className="text-[10px] text-muted-foreground">Mi cuenta</span>
                  </div>
                </button>

                {userMenuOpen && (
                  <>
                    {/* Bridge */}
                    <div className="absolute left-full bottom-0 h-full w-2 z-40" />
                    <div className="hybrid-flyout-panel absolute left-full bottom-0 ml-2 z-50 w-56 rounded-2xl border border-white/15 dark:border-white/8 overflow-hidden
                                    bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]
                                    backdrop-blur-2xl saturate-150
                                    shadow-[0_8px_40px_rgba(0,0,0,0.12)]
                                    dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]
                                    dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,transparent_40%)]" />
                      <div className="relative flex items-center gap-2.5 border-b border-white/10 dark:border-white/5 px-4 py-3">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs border border-primary/20">
                            {isLoading ? "..." : getInitials(user?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{isLoading ? "Cargando..." : user?.email ?? "Usuario"}</p>
                        </div>
                      </div>
                      <div className="relative p-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-white/10"
                          onClick={() => signOut()}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogOut className="mr-2 size-4" />}
                          Cerrar Sesión
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
