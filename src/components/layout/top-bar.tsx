"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  Eye,
  Send,
  ListTodo,
  AlertTriangle,
  Clock,
  LogOut,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Menu,
} from "lucide-react";
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
  variant?: "default" | "alert" | "overdue";
  alwaysVisible?: boolean;
}

function StatChip({ icon: Icon, count, label, href, variant = "default", alwaysVisible = false }: StatChipProps) {
  if (count === 0 && !alwaysVisible) return null;

  return (
    <Link
      href={href}
      className={`topbar-chip topbar-chip-${variant}`}
      title={label}
    >
      <Icon className="topbar-chip-icon" />
      <span className="topbar-chip-count">{count}</span>
      <span className="topbar-chip-label">{label}</span>
    </Link>
  );
}

function ThemeToggleCompact() {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const mounted = useMounted();

  const currentIcon =
    mounted && resolvedTheme === "dark" ? (
      <Moon className="size-3.5" />
    ) : (
      <Sun className="size-3.5" />
    );

  const currentValue = mounted ? theme ?? "system" : "system";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className="topbar-action" title="Tema">
            {currentIcon}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={currentValue} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="text-xs">
            <Sun className="mr-2 size-3.5" />
            <span>Claro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-xs">
            <Moon className="mr-2 size-3.5" />
            <span>Oscuro</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-xs">
            <Monitor className="mr-2 size-3.5" />
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
          <button type="button" className="topbar-action" title="Color">
            <Palette className="size-3.5" />
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

export function TopBar() {
  const { user, profile, isLoading, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["topbar-stats", profile?.id],
    queryFn: () => getTopbarStats(profile),
    enabled: !!profile,
    refetchInterval: 60000, // refrescar cada 60s
    staleTime: 30000,
  });

  const s = stats ?? {
    inspectionsActive: 0,
    liquidationsActive: 0,
    reviewsPending: 0,
    dispatchesPending: 0,
    gestionsAssigned: 0,
    gestionsAlert: 0,
    gestionsOverdue: 0,
  };

  return (
    <div className="topbar">
      {/* Mobile nav drawer — solo visible < 1024px */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="topbar-inner">
        {/* ── Izquierda: Hamburger (movil) + Usuario ── */}
        <div className="topbar-left">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="topbar-hamburger"
            aria-label="Abrir menú"
          >
            <Menu className="size-4" />
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

        {/* ── Centro: Stats chips (fijos, siempre visibles) ── */}
        <div className="topbar-center">
          <StatChip
            icon={FileText}
            count={s.liquidationsActive}
            label="Liquidaciones"
            href="/dashboard/claims?status=adjustment"
            alwaysVisible
          />
          <StatChip
            icon={Eye}
            count={s.reviewsPending}
            label="Revisiones"
            href="/dashboard/gestiones?filter=reviews"
            alwaysVisible
          />
          <StatChip
            icon={Send}
            count={s.dispatchesPending}
            label="Despachos"
            href="/dashboard/gestiones?filter=dispatches"
            alwaysVisible
          />
          <StatChip
            icon={ClipboardCheck}
            count={s.inspectionsActive}
            label="Inspecciones"
            href="/dashboard/inspecciones?status=active"
            alwaysVisible
          />
          <StatChip
            icon={ListTodo}
            count={s.gestionsAssigned}
            label="En curso"
            href="/dashboard/gestiones?filter=all"
            alwaysVisible
          />
          <StatChip
            icon={AlertTriangle}
            count={s.gestionsAlert}
            label="En alarma"
            href="/dashboard/gestiones?filter=alert"
            variant="alert"
            alwaysVisible
          />
          <StatChip
            icon={Clock}
            count={s.gestionsOverdue}
            label="Atrasadas"
            href="/dashboard/gestiones?filter=overdue"
            variant="overdue"
            alwaysVisible
          />
        </div>

        {/* ── Derecha: Acciones ── */}
        <div className="topbar-right">
          <ThemeToggleCompact />
          <SkinToggleCompact />
          <button
            type="button"
            onClick={() => signOut()}
            disabled={isLoading}
            className="topbar-action topbar-action-logout"
            title="Salir"
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
