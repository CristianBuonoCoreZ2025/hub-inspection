"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LogOut,
  Loader2,
  Palette,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
  persistUiStyleChoice,
  UI_STYLE_LABELS,
  UI_STYLE_SWATCHES,
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
          (isGroupActive || open) && "sidebar-item-active",
          open && "rounded-r-none !bg-card overflow-hidden"
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
        <div className="hybrid-flyout-panel absolute left-full top-0 z-50 w-64 rounded-r-[20px] rounded-l-none border border-l-0 bg-card overflow-hidden
                        shadow-[0_16px_64px_rgba(0,0,0,0.12)]
                        dark:shadow-[0_16px_64px_rgba(0,0,0,0.5)]"
             style={{
               borderColor: "color-mix(in srgb, var(--foreground) 12%, transparent)",
             }}>
          {/* Header del flyout */}
          <div className="relative flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
            <div className={cn(
              "flex size-6 items-center justify-center rounded-lg shrink-0",
              isGroupActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{group.title}</p>
              <p className="text-[10px] text-muted-foreground">{group.visibleLinks.length} páginas</p>
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
                    "group/item flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-medium shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground font-normal"
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
          <button type="button" className="sidebar-item w-full cursor-pointer">
            <Palette className="size-4 shrink-0" />
            <span className="text-[12px] font-medium flex-1 text-left">Color</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" side="right" className="w-48">
        <DropdownMenuRadioGroup value={skin} onValueChange={(value) => handleSelect(value as UiStyleSkin)}>
          {(Object.keys(UI_STYLE_LABELS) as UiStyleSkin[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key} className="text-xs">
              <span
                className="mr-2 size-2.5 rounded-full border border-white/20 shadow-sm"
                style={{ backgroundColor: UI_STYLE_SWATCHES[key] }}
              />
              <span>{UI_STYLE_LABELS[key]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
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
              <SkinToggle />
              <ThemeToggle />

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
                    <div className="hybrid-flyout-panel absolute left-full bottom-0 ml-2 z-50 w-56 rounded-[20px] border overflow-hidden
                                    backdrop-blur-[40px] saturate-[200%]
                                    shadow-[0_16px_64px_rgba(0,0,0,0.08)]
                                    dark:shadow-[0_16px_64px_rgba(0,0,0,0.4)]"
                         style={{
                           borderColor: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                           background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
                         }}>
                      <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,transparent_40%)]" />
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
