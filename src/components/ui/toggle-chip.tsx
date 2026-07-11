"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ToggleChip — tarjeta/chip clicable que reemplaza los checkboxes.
 * Un click lo activa (con color), otro click lo desactiva.
 *
 * Uso:
 *   <ToggleChip
 *     active={form.is_blocker}
 *     onClick={(v) => setForm({ ...form, is_blocker: v })}
 *     disabled={!canBlock}
 *   >
 *     Bloqueante
 *   </ToggleChip>
 *
 *   <ToggleChip
 *     active={form.recoveryTypeLegal}
 *     onClick={(v) => setValue("recoveryTypeLegal", v)}
 *     icon={<Briefcase className="h-3 w-3" />}
 *   >
 *     Recupero Legal
 *   </ToggleChip>
 */
interface ToggleChipProps {
  active: boolean;
  onClick: (value: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function ToggleChip({
  active,
  onClick,
  disabled = false,
  icon,
  className,
  children,
}: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(!active)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all select-none",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50 hover:border-border/80",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export { ToggleChip };
