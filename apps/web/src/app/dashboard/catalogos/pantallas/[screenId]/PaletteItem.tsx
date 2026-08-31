"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface PaletteItemProps {
  code: string;
  label: string;
  icon: string;
  desc: string;
  disabled?: boolean;
}

// Item arrastrable desde la paleta al canvas
export function PaletteItem({ code, label, icon, desc, disabled }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette_${code}`,
    data: { source: "palette", code },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      disabled={disabled}
      className="w-full flex items-start gap-2.5 rounded-lg border border-white/10 dark:border-white/5
                 bg-card/50 backdrop-blur-md p-2.5 text-left transition-all
                 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:scale-[1.02]
                 disabled:opacity-40 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground leading-tight">{label}</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{desc}</div>
      </div>
    </button>
  );
}
