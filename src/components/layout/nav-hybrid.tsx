"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNavLinks } from "@/hooks/use-nav-links";
import type { NavLink, NavGroup } from "@/components/layout/nav-data";

// ═══════════════════════════════════════════════════════════════
// Grupo con submenu integrado como extension del sidebar
// El submenu se superpone al contenido sin mover la pantalla
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
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {/* Item del grupo — fondo card cuando esta expandido para fundirse con el panel */}
      <div className={cn(
        "sidebar-item cursor-pointer",
        isGroupActive && !open && "sidebar-item-active",
        open && "rounded-r-none !bg-card text-primary"
      )}>
        <Icon className="size-[18px] shrink-0" />
        <span className="text-[12px] font-medium truncate flex-1">{group.title}</span>
        <span className={cn(
          "size-1.5 rounded-full shrink-0 transition-colors",
          isGroupActive ? "bg-primary" : "bg-muted-foreground/40"
        )} />
      </div>

      {/* Submenu integrado — superpuesto al contenido, sin mover la pantalla */}
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 z-50 w-64 rounded-[20px] bg-card">
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
