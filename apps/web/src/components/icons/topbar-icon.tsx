"use client";

import type { SVGProps } from "react";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

interface TopbarIconProps {
  /** Ícono custom multicolor para tema claro */
  lightIcon: React.ComponentType<IconProps>;
  /** Ícono outline (lucide) para tema oscuro */
  darkIcon: React.ComponentType<{ className?: string; size?: number | string }>;
  size?: number | string;
  className?: string;
}

/**
 * Renderiza el ícono custom en tema claro, o el ícono outline (lucide)
 * en tema oscuro. Evita mismatch de hidratación usando useMounted.
 */
export function TopbarIcon({
  lightIcon: LightIcon,
  darkIcon: DarkIcon,
  size = 18,
  className,
}: TopbarIconProps) {
  const isDark = useIsDarkTheme();

  if (isDark) {
    return <DarkIcon size={size} className={className} />;
  }
  return <LightIcon size={size} className={className} />;
}
