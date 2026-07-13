"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LogOut,
  Loader2,
  Palette,
  X,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNavLinks } from "@/hooks/use-nav-links";
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

function MobileGroupAccordion({
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

  return (
    <div className="mobile-nav-group">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "mobile-nav-group-header",
          isGroupActive && "mobile-nav-group-active"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="text-[13px] font-medium flex-1 text-left">{group.title}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mobile-nav-group-links">
          {group.visibleLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const LinkIcon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => { onNavigate?.(); setOpen(false); }}
                className={cn(
                  "mobile-nav-link",
                  isActive && "mobile-nav-link-active"
                )}
              >
                <LinkIcon className="size-3.5 shrink-0" />
                <span className="flex-1 truncate">{link.label}</span>
                {isActive && <span className="h-3 w-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileSkinToggle() {
  const skin = useSyncExternalStore(subscribeUiStyle, getUiStyleSnapshot, getUiStyleSnapshot);

  const handleSelect = (value: UiStyleSkin) => {
    persistUiStyleChoice(value);
    document.documentElement.setAttribute("data-ui-style", value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="mobile-nav-action">
            <Palette className="size-4 shrink-0" />
            <span className="text-[13px] font-medium flex-1 text-left">Color</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
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

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const { visibleMainLinks, visibleGroups } = useNavLinks();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Cerrar al cambiar de ruta
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="mobile-nav-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn("mobile-nav-drawer", open && "mobile-nav-drawer-open")}
        aria-hidden={!open}
      >
        <div className="mobile-nav-drawer-inner">
          {/* Header del drawer */}
          <div className="mobile-nav-header">
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-[14px] bg-primary/10 text-primary shrink-0"
            >
              <div className="flex size-9 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold leading-tight">Claims Hub</span>
                <span className="text-[10px] text-primary/70 leading-tight">Dashboard</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mobile-nav-close"
              aria-label="Cerrar menú"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Usuario */}
          <div className="mobile-nav-user">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/20 text-primary text-xs border border-primary/20">
                {isLoading ? "..." : getInitials(user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-medium truncate">
                {isLoading ? "Cargando..." : user?.email ?? "Usuario"}
              </span>
              <span className="text-[10px] text-muted-foreground">Mi cuenta</span>
            </div>
          </div>

          {/* Links principales */}
          <div className="mobile-nav-section">
            <span className="mobile-nav-section-label">Principal</span>
            <div className="flex flex-col gap-1">
              {visibleMainLinks.map((link) => {
                const isActive = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className={cn("mobile-nav-link", isActive && "mobile-nav-link-active")}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-[13px] font-medium flex-1">{link.label}</span>
                    {isActive && <span className="h-3 w-0.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Grupos (catálogos, operaciones, admin) */}
          <div className="mobile-nav-section">
            <span className="mobile-nav-section-label">Módulos</span>
            <div className="flex flex-col gap-1">
              {visibleGroups.map((group) => (
                <MobileGroupAccordion
                  key={group.title}
                  group={group}
                  pathname={pathname}
                  onNavigate={onClose}
                />
              ))}
            </div>
          </div>

          {/* Acciones inferiores */}
          <div className="mobile-nav-footer">
            <MobileSkinToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => signOut()}
              disabled={isLoading}
              className="mobile-nav-action mobile-nav-action-logout"
            >
              {isLoading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <LogOut className="size-4 shrink-0" />}
              <span className="text-[13px] font-medium flex-1 text-left">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
