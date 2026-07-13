"use client"

import { cn } from "@/lib/utils"

/**
 * StatusBadge — indicador de estado moderno con Liquid Glass.
 *
 * Muestra un punto de color + texto, con fondo translúcido y borde sutil
 * que coincide con el color del estado. Reemplaza los Badge planos estilo
 * "Windows XP" por un control informativo y contemporáneo (estilo Linear /
 * Slack / Vercel).
 *
 * Uso:
 *   <StatusBadge status="active" label="Activa" />
 *   <StatusBadge tone="emerald" label="Completada" />
 */

export type StatusTone =
  | "slate"
  | "emerald"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "zinc"
  | "blue"
  | "purple"
  | "gray"

interface StatusBadgeProps {
  /** Tono explícito (alternativa a status) */
  tone?: StatusTone
  /** Código de estado mapeado automáticamente a un tono */
  status?: string
  /** Texto a mostrar */
  label: string
  /** Tamaño */
  size?: "sm" | "md"
  /** Clase extra */
  className?: string
  /** Mostrar punto indicador (default true) */
  dot?: boolean
}

// Map de códigos de estado → tono
// Nota: "active" tiene conflicto entre policies (emerald) e inspections (zinc).
// Se resuelve con el prop `tone` explícito cuando sea necesario.
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // Claims
  created: "sky",
  adjustment: "amber",
  dispatchment: "blue",
  closed: "emerald",
  reopened: "rose",
  // Policies
  draft: "slate",
  active: "emerald",
  expired: "amber",
  cancelled: "rose",
  // Inspections
  scheduled: "sky",
  completed: "violet",
}

// Config de colores por tono — punto, texto, fondo, borde
const TONE_STYLES: Record<StatusTone, {
  dot: string
  text: string
  bg: string
  border: string
  glow: string
}> = {
  slate: {
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-500/8 dark:bg-slate-400/10",
    border: "border-slate-500/20 dark:border-slate-400/15",
    glow: "shadow-[0_0_8px_rgba(100,116,139,0.15)]",
  },
  emerald: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    border: "border-emerald-500/25 dark:border-emerald-400/20",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.2)]",
  },
  amber: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    border: "border-amber-500/25 dark:border-amber-400/20",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.2)]",
  },
  sky: {
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-500/10 dark:bg-sky-400/10",
    border: "border-sky-500/25 dark:border-sky-400/20",
    glow: "shadow-[0_0_8px_rgba(14,165,233,0.2)]",
  },
  violet: {
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-500/10 dark:bg-violet-400/10",
    border: "border-violet-500/25 dark:border-violet-400/20",
    glow: "shadow-[0_0_8px_rgba(139,92,246,0.2)]",
  },
  rose: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-500/10 dark:bg-rose-400/10",
    border: "border-rose-500/25 dark:border-rose-400/20",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.2)]",
  },
  zinc: {
    dot: "bg-zinc-400",
    text: "text-zinc-700 dark:text-zinc-300",
    bg: "bg-zinc-500/10 dark:bg-zinc-400/10",
    border: "border-zinc-500/20 dark:border-zinc-400/15",
    glow: "shadow-[0_0_8px_rgba(161,161,170,0.15)]",
  },
  blue: {
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-500/10 dark:bg-blue-400/10",
    border: "border-blue-500/25 dark:border-blue-400/20",
    glow: "shadow-[0_0_8px_rgba(59,130,246,0.2)]",
  },
  purple: {
    dot: "bg-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-500/10 dark:bg-purple-400/10",
    border: "border-purple-500/25 dark:border-purple-400/20",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.2)]",
  },
  gray: {
    dot: "bg-gray-400",
    text: "text-gray-600 dark:text-gray-300",
    bg: "bg-gray-500/8 dark:bg-gray-400/10",
    border: "border-gray-500/20 dark:border-gray-400/15",
    glow: "shadow-[0_0_8px_rgba(156,163,175,0.15)]",
  },
}

export function StatusBadge({
  tone,
  status,
  label,
  size = "sm",
  className,
  dot = true,
}: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE_MAP[status ?? ""] ?? "slate"
  const s = TONE_STYLES[resolvedTone]

  const sizes = {
    sm: {
      container: "h-5 px-2 text-[10px] gap-1.5",
      dot: "h-1.5 w-1.5",
    },
    md: {
      container: "h-6 px-2.5 text-[11px] gap-2",
      dot: "h-2 w-2",
    },
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-medium whitespace-nowrap",
        "backdrop-blur-md saturate-150 transition-all",
        "select-none",
        s.bg, s.border, s.text,
        sizes[size].container,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "shrink-0 rounded-full",
            s.dot,
            sizes[size].dot,
            "shadow-sm",
            s.glow
          )}
        />
      )}
      {label}
    </span>
  )
}
