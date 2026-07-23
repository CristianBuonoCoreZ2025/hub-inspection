"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNavLinks } from "@/hooks/use-nav-links";
import type { NavLink, VisibleNavGroup, VisibleNavSubgroup } from "@/components/layout/nav-data";

// ═══════════════════════════════════════════════════════════════
// Subgrupo dentro de un flyout — al hover abre otro flyout al lado.
// Posicionamiento inteligente: detecta el espacio disponible en
// el viewport y alinea el sub-flyout para que no se corte.
// ═══════════════════════════════════════════════════════════════
function HybridSubFlyout({
  subgroup,
  pathname,
  onNavigate,
}: {
  subgroup: VisibleNavSubgroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isGroupActive = subgroup.visibleLinks.some(l => pathname.startsWith(l.href));
  const Icon = subgroup.icon;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number }>({ top: 0 });

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 150);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 100);
  };

  // Calcular posición del sub-flyout cuando se abre.
  // Estrategia:
  //   - Medir el item (trigger) y el sub-flyout
  //   - Calcular cuánto espacio hay abajo y arriba del item en el viewport
  //   - Si el sub-flyout cabe abajo → top: 0 (alineado al item)
  //   - Si no cabe abajo pero cabe arriba → bottom: 0 (alineado al borde inferior del item)
  //   - Si no cabe ni arriba ni abajo → alineado al borde del viewport más cercano
  useLayoutEffect(() => {
    if (!open || !itemRef.current || !flyoutRef.current) return;
    const itemRect = itemRef.current.getBoundingClientRect();
    const flyoutRect = flyoutRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const MARGIN = 8;

    // Espacio disponible abajo y arriba del item (en coords del viewport)
    const spaceBelow = viewportH - itemRect.top - MARGIN;
    const spaceAbove = itemRect.bottom - MARGIN;

    const flyoutH = flyoutRect.height;

    if (flyoutH <= spaceBelow) {
      // Cabe hacia abajo: alinear al top del item
      setPosition({ top: 0 });
    } else if (flyoutH <= spaceAbove) {
      // No cabe abajo pero cabe arriba: alinear al bottom del item
      setPosition({ bottom: 0 });
    } else {
      // No cabe ni arriba ni abajo: elegir el lado con más espacio
      // y alinear al borde del viewport más cercano
      if (spaceBelow >= spaceAbove) {
        // Más espacio abajo: alinear top al borde superior del viewport
        // (en coords relativas al item: -itemRect.top + MARGIN)
        setPosition({ top: -itemRect.top + MARGIN });
      } else {
        // Más espacio arriba: alinear bottom al borde inferior del viewport
        // (en coords relativas al item: -(viewportH - itemRect.bottom) + MARGIN)
        setPosition({ bottom: -(viewportH - itemRect.bottom) + MARGIN });
      }
    }
  }, [open]);

  // Recalcular en resize/scroll por si cambió el contexto
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      if (!itemRef.current || !flyoutRef.current) return;
      const itemRect = itemRef.current.getBoundingClientRect();
      const flyoutRect = flyoutRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const MARGIN = 8;
      const spaceBelow = viewportH - itemRect.top - MARGIN;
      const spaceAbove = itemRect.bottom - MARGIN;
      const flyoutH = flyoutRect.height;
      if (flyoutH <= spaceBelow) setPosition({ top: 0 });
      else if (flyoutH <= spaceAbove) setPosition({ bottom: 0 });
      else if (spaceBelow >= spaceAbove) setPosition({ top: -itemRect.top + MARGIN });
      else setPosition({ bottom: -(viewportH - itemRect.bottom) + MARGIN });
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {/* Item del subgrupo dentro del flyout */}
      <div
        ref={itemRef}
        className={cn(
          "group/sub flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150 cursor-pointer",
          isGroupActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground font-normal"
        )}
      >
        <Icon className={cn(
          "size-3.5 shrink-0 transition-colors",
          isGroupActive ? "text-primary" : "text-muted-foreground/60 group-hover/sub:text-foreground"
        )} />
        <span className="flex-1 truncate">{subgroup.title}</span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
      </div>

      {/* Sub-flyout — se abre al lado del item del subgrupo.
          z-[60] para que esté encima del flyout principal (z-50).
          Posicionamiento vertical inteligente via useLayoutEffect. */}
      {open && (
        <div
          ref={flyoutRef}
          className="absolute left-full z-[60] w-56 rounded-[16px] bg-card shadow-xl border border-border/50"
          style={{ top: position.top, bottom: position.bottom }}
        >
          <div className="relative p-1">
            {subgroup.visibleLinks.map((link) => {
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
// Grupo con submenu integrado como extension del sidebar
// El submenu se superpone al contenido sin mover la pantalla
// Soporta subgrupos anidados (flyout dentro de flyout)
// ═══════════════════════════════════════════════════════════════
function HybridFlyout({
  group,
  pathname,
  onNavigate,
}: {
  group: VisibleNavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isGroupActive = group.children.some(c =>
    c.kind === "link"
      ? pathname.startsWith(c.link.href)
      : c.subgroup.visibleLinks.some(l => pathname.startsWith(l.href))
  );
  const Icon = group.icon;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number }>({ top: 0 });

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 200);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Posicionamiento inteligente del flyout principal (igual que sub-flyout)
  useLayoutEffect(() => {
    if (!open || !itemRef.current || !flyoutRef.current) return;
    const itemRect = itemRef.current.getBoundingClientRect();
    const flyoutRect = flyoutRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const MARGIN = 8;
    const spaceBelow = viewportH - itemRect.top - MARGIN;
    const spaceAbove = itemRect.bottom - MARGIN;
    const flyoutH = flyoutRect.height;
    if (flyoutH <= spaceBelow) {
      setPosition({ top: 0 });
    } else if (flyoutH <= spaceAbove) {
      setPosition({ bottom: 0 });
    } else if (spaceBelow >= spaceAbove) {
      setPosition({ top: -itemRect.top + MARGIN });
    } else {
      setPosition({ bottom: -(viewportH - itemRect.bottom) + MARGIN });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => {
      if (!itemRef.current || !flyoutRef.current) return;
      const itemRect = itemRef.current.getBoundingClientRect();
      const flyoutRect = flyoutRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const MARGIN = 8;
      const spaceBelow = viewportH - itemRect.top - MARGIN;
      const spaceAbove = itemRect.bottom - MARGIN;
      const flyoutH = flyoutRect.height;
      if (flyoutH <= spaceBelow) setPosition({ top: 0 });
      else if (flyoutH <= spaceAbove) setPosition({ bottom: 0 });
      else if (spaceBelow >= spaceAbove) setPosition({ top: -itemRect.top + MARGIN });
      else setPosition({ bottom: -(viewportH - itemRect.bottom) + MARGIN });
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {/* Item del grupo — fondo card cuando esta expandido para fundirse con el panel */}
      <div
        ref={itemRef}
        className={cn(
          "sidebar-item cursor-pointer",
          isGroupActive && !open && "sidebar-item-active",
          open && "rounded-r-none !bg-card text-primary"
        )}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="text-[11px] font-medium truncate flex-1">{group.title}</span>
        <span className={cn(
          "size-1.5 rounded-full shrink-0 transition-colors",
          isGroupActive ? "bg-primary" : "bg-muted-foreground/40"
        )} />
      </div>

      {/* Submenu integrado — superpuesto al contenido, sin mover la pantalla.
          Posicionamiento vertical inteligente via useLayoutEffect. */}
      {open && (
        <div
          ref={flyoutRef}
          className="absolute left-full z-50 w-64 rounded-[20px] bg-card"
          style={{ top: position.top, bottom: position.bottom }}
        >
          {/* IMPORTANTE: el contenedor NO tiene overflow para que los subgrupos
              (que abren un sub-flyout a la derecha con absolute left-full)
              puedan escapar y verse correctamente. */}
          <div className="relative p-1">
            {/* Children en orden interleaved: links y subgrupos
                tal como están en la config del menú */}
            {group.children.map((child) => {
              if (child.kind === "link") {
                const link = child.link;
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
                    {isActive && (
                      <span className="h-3 w-0.5 rounded-full bg-primary shadow-[0_0_6px_rgba(139,92,246,0.6)]" />
                    )}
                  </Link>
                );
              }
              // Subgrupo
              return (
                <HybridSubFlyout
                  key={child.subgroup.section}
                  subgroup={child.subgroup}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
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
      <span className="text-[11px] font-medium truncate">{link.label}</span>
    </Link>
  );
}

export function HybridNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { visibleMainLinks, visibleGroups } = useNavLinks();

  return (
    <>
      {/* Sidebar (left) — premium floating labeled glass panel */}
      <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-start lg:w-[220px] lg:shrink-0 lg:pt-2 lg:pb-2">
        <aside className="sidebar-glass flex flex-col w-[200px] flex-1 py-4 gap-3">
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

            {/* User, theme, skin y logout están en la TopBar superior */}
          </div>
        </aside>
      </div>
    </>
  );
}
