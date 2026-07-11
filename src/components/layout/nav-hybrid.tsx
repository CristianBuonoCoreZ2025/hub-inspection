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
} from "@/lib/ui-style-client-store";
import { useSyncExternalStore } from "react";
import type { NavLink, NavGroup } from "@/components/layout/nav-data";

function getInitials(email?: string | null) {
  if (!email) return "U";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════
// Tooltip custom (reemplaza el title nativo)
// Aparece al hover con un delay corto y animación suave
// ═══════════════════════════════════════════════════════════════
function IconTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 300);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <div className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg backdrop-blur-sm">
          {label}
          {/* Flecha */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
        </div>
      )}
    </div>
  );
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
      {/* Icono del grupo — sin tooltip (el flyout ya muestra el título) */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg py-2.5 transition-colors cursor-pointer",
          isGroupActive || open
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-5 shrink-0" />
        {/* Indicador de sub-niveles: punto en la esquina */}
        <span className={cn(
          "absolute right-1.5 top-1.5 size-1.5 rounded-full transition-colors",
          isGroupActive ? "bg-primary" : "bg-muted-foreground/40"
        )} />
      </div>

      {/* Flyout panel */}
      {open && (
        <>
          {/* Bridge invisible para evitar gap entre icono y panel */}
          <div className="absolute left-full top-0 h-full w-2 z-40" />

          <div className="absolute left-full top-0 ml-2 z-50 w-64 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Header del flyout */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-muted/40">
              <div className={cn(
                "flex size-6 items-center justify-center rounded-md shrink-0",
                isGroupActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{group.title}</p>
                <p className="text-[9px] text-muted-foreground">{group.visibleLinks.length} páginas</p>
              </div>
            </div>

            {/* Lista de sub-páginas */}
            <div className="p-1 max-h-[520px] overflow-y-auto">
              {group.visibleLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => { onNavigate?.(); setOpen(false); }}
                    className={cn(
                      "group/item flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] transition-all",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground font-normal"
                    )}
                  >
                    <LinkIcon className={cn(
                      "size-3.5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/60 group-hover/item:text-foreground"
                    )} />
                    <span className="flex-1 truncate">{link.label}</span>
                    {/* Indicador activo: barra lateral */}
                    {isActive && (
                      <span className="h-3 w-0.5 rounded-full bg-primary" />
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
// Selector de skin — simple como el ThemeToggle
// ═══════════════════════════════════════════════════════════════
function SkinToggle() {
  const skin = useSyncExternalStore(subscribeUiStyle, getUiStyleSnapshot, getUiStyleSnapshot);

  const handleSelect = (value: UiStyleSkin) => {
    persistUiStyleChoice(value);
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Estilo de interfaz">
            <Palette className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="right">
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
    <IconTooltip label={link.label}>
      <Link
        href={link.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-center rounded-lg py-2.5 transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-5 shrink-0" />
      </Link>
    </IconTooltip>
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
      {/* Icon rail (left) — premium glass + gradient */}
      <aside className="hidden lg:flex lg:w-[56px] lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar items-center py-3 gap-1 relative">
        {/* Gradient overlay sutil */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-primary/[0.02]" />
        {/* Contenido */}
        <div className="relative z-10 flex flex-col items-center w-full h-full gap-1">
        {/* Logo */}
        <IconTooltip label="Dashboard">
          <Link
            href="/dashboard"
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 mb-3 transition-transform hover:scale-105"
          >
            <ShieldCheck className="size-5" />
          </Link>
        </IconTooltip>

        {/* Main links as icons */}
        <div className="flex flex-col gap-1 w-full px-1.5">
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

        <div className="my-2 w-8 border-t border-border" />

        {/* Group icons with flyout */}
        <div className="flex flex-col gap-1 w-full px-1.5">
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
        <div className="mt-auto flex flex-col items-center gap-1 w-full px-1.5">
          <div className="flex items-center justify-center rounded-lg py-1.5 transition-colors hover:bg-muted">
            <SkinToggle />
          </div>

          <div className="flex items-center justify-center rounded-lg py-1.5 transition-colors hover:bg-muted">
            <ThemeToggle />
          </div>

          <IconTooltip label={isLoading ? "Cargando..." : (user?.email ?? "Usuario")}>
            <div ref={userRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-muted"
              >
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {isLoading ? "..." : getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
              </button>

              {userMenuOpen && (
                <>
                  {/* Bridge */}
                  <div className="absolute left-full bottom-0 h-full w-2 z-40" />
                  <div className="absolute left-full bottom-0 ml-2 z-50 w-56 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden backdrop-blur-xl">
                    <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 bg-muted/40">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {isLoading ? "..." : getInitials(user?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{isLoading ? "Cargando..." : user?.email ?? "Usuario"}</p>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
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
          </IconTooltip>
        </div>
        </div>
      </aside>
    </>
  );
}
