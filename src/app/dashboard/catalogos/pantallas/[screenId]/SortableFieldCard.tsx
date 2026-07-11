"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Copy, GripVertical } from "lucide-react";

import type { ScreenField } from "./types";
import { FieldPreview } from "./FieldPreview";

interface SortableFieldCardProps {
  field: ScreenField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function SortableFieldCard({
  field,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { source: "canvas", fieldId: field.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isEntity = field.category !== "own";
  const isComplex = field.category === "complex_entity";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative rounded-lg border transition-all ${
        selected
          ? "border-primary ring-1 ring-primary/30 bg-primary/5 shadow-sm"
          : isComplex
          ? "border-violet-200 bg-violet-50/30 dark:bg-violet-900/5 hover:border-violet-400"
          : isEntity
          ? "border-dashed border-border bg-muted/10 hover:border-muted-foreground/30"
          : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm"
      } ${isDragging ? "cursor-grabbing" : "cursor-pointer"}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className={`absolute left-1 top-1.5 flex h-6 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } cursor-grab active:cursor-grabbing`}
        title="Arrastrar para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Controles superiores */}
      <div
        className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Duplicar"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
          title="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Contenido */}
      <div className="pl-6 pr-1 py-3">
        <FieldPreview field={field} allFields={[]} />
      </div>
    </div>
  );
}
