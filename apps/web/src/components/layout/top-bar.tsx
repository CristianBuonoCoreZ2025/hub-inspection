"use client";

import { useState, useRef, useCallback, type SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Menu,
  X,
  FileCheck2,
  ScanSearch,
  Send,
  ShieldCheck,
  History,
  Palette,
  LogOut,
} from "lucide-react";
import {
  LiquidacionIcon,
  InspeccionIcon,
  DespachoIcon,
  AuditoriaIcon,
  RecientesIcon,
  SkinIcon,
  LogoutIcon,
} from "@/components/icons/topbar-icons";
import { TopbarIcon } from "@/components/icons/topbar-icon";
import { useSyncExternalStore } from "react";

import { useAuth } from "@/hooks/use-auth";
import { getTopbarStats } from "@/services/topbar-stats";
import { userTypeLabels } from "@/services/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUiThemeSnapshot,
  getUiStyleServerSnapshot,
  subscribeUiTheme,
  persistUiThemeChoice,
  UI_THEME_LIST,
  type UiThemeId,
} from "@/lib/ui-style-client-store";
import { getClaimTypeIcon } from "@/lib/claim-type-icons";
import { useRecentClaims } from "@/hooks/use-recent-claims";
import { useDockMagnification } from "@/hooks/use-dock-magnification";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HelpButton } from "@/components/layout/help-panel";
import { MyProfileModal } from "@/components/layout/my-profile-modal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HubiMascot } from "@/components/hubi/hubi-mascot";

function getInitials(email?: string | null) {
  if (!email) return "U";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface StatChipProps {
  lightIcon: React.ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  darkIcon: React.ComponentType<{ className?: string; size?: number | string }>;
  count: number;
  label: string;
  href: string;
  variant?: "default";
  iconClassName?: string;
}

function StatChip({ lightIcon, darkIcon, count, label, href, variant = "default", iconClassName }: StatChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={
          <Link
            href={href}
            className={`topbar-chip topbar-chip-${variant} dock-item`}
          />
        }
      >
        <span className="topbar-chip-icon">
          <TopbarIcon lightIcon={lightIcon} darkIcon={darkIcon} size={18} className={iconClassName} />
        </span>
        {count > 0 && <span className="topbar-chip-count">{count}</span>}
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{`${label}: ${count}`}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ThemeSelectorCompact() {
  const themeId = useSyncExternalStore(subscribeUiTheme, getUiThemeSnapshot, getUiStyleServerSnapshot);

  const handleSelect = (value: UiThemeId) => {
    persistUiThemeChoice(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="topbar-action dock-item" aria-label="Tema">
            <TopbarIcon lightIcon={SkinIcon} darkIcon={Palette} size={18} />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value={themeId} onValueChange={(value) => handleSelect(value as UiThemeId)}>
          {UI_THEME_LIST.map((theme) => (
            <DropdownMenuRadioItem key={theme.id} value={theme.id} className="text-xs">
              <span
                className="mr-2 size-2.5 rounded-full border border-white/20 shadow-sm"
                style={{ backgroundColor: theme.swatch }}
              />
              <span>{theme.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** URL de imagen de bandera desde flagcdn (funciona en Windows). */
function flagImgUrl(code: string | null): string | null {
  if (!code || code.length !== 2) return null;
  const lower = code.toLowerCase();
  if (!/^[a-z]{2}$/.test(lower)) return null;
  return `https://flagcdn.com/h20/${lower}.png`;
}

function RecentClaimsButton() {
  const { recents, remove, clear } = useRecentClaims();
  const count = recents.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="topbar-chip topbar-action-recents dock-item" aria-label="Siniestros recientes">
            <span className="topbar-chip-icon">
              <TopbarIcon lightIcon={RecientesIcon} darkIcon={History} size={18} />
            </span>
            {count > 0 && <span className="topbar-chip-count">{count}</span>}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-120 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <span className="text-xs font-semibold">
            Siniestros recientes
          </span>
          {count > 0 && (
            <button
              type="button"
              onClick={clear}
              className="pg-btn-platinum"
            >
              Limpiar
            </button>
          )}
        </div>
        {count === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No hay siniestros visitados todavía.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {recents.map((r) => {
              const flagUrl = flagImgUrl(r.countryCode);
              const BlIcon = getClaimTypeIcon(r.claimTypeIcon);
              return (
                <div key={r.id} className="recent-claim-row">
                  <Link href={`/dashboard/claims/${r.id}`} className="recent-claim-link">
                    <span className="recent-claim-number">
                      {r.liquidationNumber || "—"}
                    </span>
                    <span className="recent-claim-ref truncate">
                      {r.clientReference || "—"}
                    </span>
                    <span className="recent-claim-insured truncate">
                      {r.insuredName || "Sin asegurado"}
                    </span>
                    <span className="recent-claim-time">
                      {new Date(r.visitedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="recent-claim-bl-icon" aria-label={r.businessLineName ?? "Tipo de Siniestro"}>
                      <BlIcon className="size-3" />
                    </span>
                    {flagUrl ? (
                      <Image
                        src={flagUrl}
                        alt={r.countryCode ?? ""}
                        className="recent-claim-flag-img"
                        aria-label={r.countryCode ?? ""}
                        width={18}
                        height={13}
                        unoptimized
                      />
                    ) : (
                      <span className="recent-claim-flag-placeholder" />
                    )}
                  </Link>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="recent-claim-remove"
                      >
                        <X className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Quitar</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar() {
  const { user, profile, isLoading, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const topbarInnerRef = useRef<HTMLDivElement>(null);
  useDockMagnification(topbarInnerRef);

  const { data: stats } = useQuery({
    queryKey: ["topbar-stats", profile?.id],
    queryFn: () => getTopbarStats(profile),
    enabled: !!profile,
    refetchInterval: 60000, // refrescar cada 60s
    staleTime: 30000,
  });

  const s = stats ?? {
    liquidations: 0,
    inspections: 0,
    dispatches: 0,
    audits: 0,
    inProgress: 0,
    reviews: 0,
    approvals: 0,
    alert: 0,
    overdue: 0,
  };

  return (
    <div className="topbar">
      {/* Mobile nav drawer — solo visible < 1024px */}
      <MobileNav open={mobileNavOpen} onClose={closeMobileNav} />

      <div className="topbar-inner" ref={topbarInnerRef}>
        {/* Lente líquido — barrido de luz que sigue el cursor (Liquid Glass) */}
        <div className="topbar-lens" aria-hidden="true" />
        {/* ── Izquierda: Hamburger (movil) + Usuario ── */}
        <div className="topbar-left">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="topbar-hamburger"
            aria-label="Abrir menú"
          >
            <Menu />
          </button>
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button type="button" onClick={() => setProfileOpen(true)} className="topbar-avatar-btn">
                <Avatar size="sm">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name || "Avatar"} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px] border border-primary/20">
                    {isLoading ? "..." : getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Mi perfil</p>
            </TooltipContent>
          </Tooltip>
          <div className="topbar-user-info">
            <span className="topbar-user-name">
              {profile?.full_name || user?.email || "Usuario"}
            </span>
            <span className="topbar-user-role">
              {profile?.role ? userTypeLabels[profile.role] : ""}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem("hubi-robot-hidden", "false"); } catch {}
                  window.dispatchEvent(new CustomEvent("hubi-open"));
                }}
                className="topbar-hubi-btn dock-item"
                aria-label="Abrir Hubi"
              >
                <HubiMascot state="idle" size={28} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Hubi — Asistente IA</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Centro: Siniestros (solo iconos + tooltip) ── */}
        <div className="topbar-center">
          <StatChip
            lightIcon={LiquidacionIcon}
            darkIcon={FileCheck2}
            count={s.liquidations}
            label="Liquidaciones"
            href="/dashboard/mis-casos?role=liquidador"
          />
          <StatChip
            lightIcon={InspeccionIcon}
            darkIcon={ScanSearch}
            count={s.inspections}
            label="Inspecciones"
            href="/dashboard/mis-casos?role=inspector"
          />
          <StatChip
            lightIcon={DespachoIcon}
            darkIcon={Send}
            count={s.dispatches}
            label="Despachos"
            href="/dashboard/mis-casos?role=despachador"
          />
          <StatChip
            lightIcon={AuditoriaIcon}
            darkIcon={ShieldCheck}
            count={s.audits}
            label="Auditoría"
            href="/dashboard/mis-casos?role=auditor"
          />
        </div>

        {/* ── Derecha: Acciones ── */}
        <div className="topbar-right">
          <RecentClaimsButton />
          <ThemeSelectorCompact />
          <HelpButton />
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={() => signOut()}
                disabled={isLoading}
                className="topbar-action topbar-action-logout dock-item"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <TopbarIcon lightIcon={LogoutIcon} darkIcon={LogOut} size={18} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Salir</p>
            </TooltipContent>
          </Tooltip>
          {/* placeholder for help below */}
        </div>
      </div>

      {/* Modal Mi Perfil — se abre al clickar el avatar */}
      <MyProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
