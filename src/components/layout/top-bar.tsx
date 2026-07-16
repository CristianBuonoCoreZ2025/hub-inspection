"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Menu,
  X,
  History,
  Power,
} from "lucide-react";
import {
  LiquidacionIcon,
  InspeccionIcon,
  DespachoIcon,
  AuditoriaIcon,
} from "@/components/icons/claim-toolbar-icons";
import { useSyncExternalStore } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useMounted } from "@/hooks/use-mounted";
import { getTopbarStats } from "@/services/topbar-stats";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import {
  getUiStyleSnapshot,
  subscribeUiStyle,
  persistUiStyleChoice,
  UI_STYLE_LABELS,
  UI_STYLE_SWATCHES,
  type UiStyleSkin,
} from "@/lib/ui-style-client-store";
import { getClaimTypeIcon } from "@/lib/claim-type-icons";
import { useRecentClaims } from "@/hooks/use-recent-claims";
import { useDockMagnification } from "@/hooks/use-dock-magnification";
import { MobileNav } from "@/components/layout/mobile-nav";

function getInitials(email?: string | null) {
  if (!email) return "U";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface StatChipProps {
  icon: React.ElementType;
  count: number;
  label: string;
  href: string;
  variant?: "default";
  iconClassName?: string;
}

function StatChip({ icon: Icon, count, label, href, variant = "default", iconClassName }: StatChipProps) {
  return (
    <Link
      href={href}
      className={`topbar-chip topbar-chip-${variant} dock-item`}
      title={`${label}: ${count}`}
    >
      <span className="topbar-chip-icon">
        <Icon className={iconClassName} />
      </span>
      {count > 0 && <span className="topbar-chip-count">{count}</span>}
    </Link>
  );
}

function ThemeToggleCompact() {
  const { setTheme, theme } = useTheme();
  const mounted = useMounted();

  const currentIcon =
    mounted && theme === "dark" ? <Moon /> : <Sun />;

  const currentValue = mounted ? theme ?? "system" : "system";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="topbar-action dock-item" title="Tema">
            {currentIcon}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={currentValue} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="text-xs">
            <Sun className="mr-2 size-3" />
            <span>Claro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-xs">
            <Moon className="mr-2 size-3" />
            <span>Oscuro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-xs">
            <Monitor className="mr-2 size-3" />
            <span>Sistema</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SkinToggleCompact() {
  const skin = useSyncExternalStore(subscribeUiStyle, getUiStyleSnapshot, getUiStyleSnapshot);

  const handleSelect = (value: UiStyleSkin) => {
    persistUiStyleChoice(value);
    document.documentElement.setAttribute("data-ui-style", value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="topbar-action dock-item" title="Color">
            <Palette />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
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
          <button type="button" className="topbar-chip topbar-action-recents dock-item" title="Siniestros recientes">
            <span className="topbar-chip-icon">
              <History />
            </span>
            {count > 0 && <span className="topbar-chip-count">{count}</span>}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[480px] p-0">
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
                    <span className="recent-claim-bl-icon" title={r.businessLineName ?? "Tipo de Siniestro"}>
                      <BlIcon className="size-3" />
                    </span>
                    {flagUrl ? (
                      <Image
                        src={flagUrl}
                        alt={r.countryCode ?? ""}
                        className="recent-claim-flag-img"
                        title={r.countryCode ?? ""}
                        width={18}
                        height={13}
                        unoptimized
                      />
                    ) : (
                      <span className="recent-claim-flag-placeholder" />
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="recent-claim-remove"
                    title="Quitar"
                  >
                    <X className="size-3" />
                  </button>
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
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

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
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] border border-primary/20">
              {isLoading ? "..." : getInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="topbar-user-info">
            <span className="topbar-user-name">
              {profile?.full_name || user?.email || "Usuario"}
            </span>
            <span className="topbar-user-role">
              {profile?.role === "internal" ? "Interno" :
                profile?.role === "adjuster" ? "Liquidador" :
                profile?.role === "inspector" ? "Inspector" :
                profile?.role === "assistant" ? "Asistente" :
                profile?.role === "client_operator" ? "Operador" : ""}
            </span>
          </div>
        </div>

        {/* ── Centro: Siniestros (solo iconos + tooltip) ── */}
        <div className="topbar-center">
          <StatChip
            icon={LiquidacionIcon}
            count={s.liquidations}
            label="Liquidaciones"
            href="/dashboard/mis-casos?role=liquidador"
          />
          <StatChip
            icon={InspeccionIcon}
            count={s.inspections}
            label="Inspecciones"
            href="/dashboard/mis-casos?role=inspector"
          />
          <StatChip
            icon={DespachoIcon}
            count={s.dispatches}
            label="Despachos"
            href="/dashboard/mis-casos?role=despachador"
          />
          <StatChip
            icon={AuditoriaIcon}
            count={s.audits}
            label="Auditoría"
            href="/dashboard/mis-casos?role=auditor"
          />
        </div>

        {/* ── Derecha: Acciones ── */}
        <div className="topbar-right">
          <RecentClaimsButton />
          <ThemeToggleCompact />
          <SkinToggleCompact />
          <button
            type="button"
            onClick={() => signOut()}
            disabled={isLoading}
            className="topbar-action topbar-action-logout dock-item"
            title="Salir"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Power />}
          </button>
        </div>
      </div>
    </div>
  );
}
