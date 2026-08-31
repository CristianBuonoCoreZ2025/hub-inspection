"use client";

import Image from "next/image";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";

interface KpiIconProps {
  variant: "today" | "active" | "scheduled" | "completed" | "overdue" | "time";
}

const LIGHT_ICONS: Record<KpiIconProps["variant"], string> = {
  today: "/icons/kpi-today.svg",
  active: "/icons/kpi-active.svg",
  scheduled: "/icons/kpi-scheduled.svg",
  completed: "/icons/kpi-completed.svg",
  overdue: "/icons/kpi-overdue.svg",
  time: "/icons/kpi-time.svg",
};

const DARK_ICONS: Record<KpiIconProps["variant"], string> = {
  today: "/icons/kpi-today-outline.svg",
  active: "/icons/kpi-active-outline.svg",
  scheduled: "/icons/kpi-scheduled-outline.svg",
  completed: "/icons/kpi-completed-outline.svg",
  overdue: "/icons/kpi-overdue-outline.svg",
  time: "/icons/kpi-time-outline.svg",
};

export function KpiIcon({ variant }: KpiIconProps) {
  const isDark = useIsDarkTheme();
  const src = isDark ? DARK_ICONS[variant] : LIGHT_ICONS[variant];

  return (
    <Image
      src={src}
      alt=""
      width={96}
      height={96}
      className={`h-24 w-24 ${isDark ? "kpi-icon-outline" : ""}`}
    />
  );
}

export function KpiTodayIcon() {
  return <KpiIcon variant="today" />;
}
export function KpiActiveIcon() {
  return <KpiIcon variant="active" />;
}
export function KpiScheduledIcon() {
  return <KpiIcon variant="scheduled" />;
}
export function KpiCompletedIcon() {
  return <KpiIcon variant="completed" />;
}
export function KpiOverdueIcon() {
  return <KpiIcon variant="overdue" />;
}
export function KpiTimeIcon() {
  return <KpiIcon variant="time" />;
}
