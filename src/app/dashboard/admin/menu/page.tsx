"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type CollisionDetection,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  mainLinks,
  catalogLinks,
  inspectionCatalogLinks,
  gestionCatalogLinks,
  operationLinks,
  adminLinks,
  navGroups,
} from "@/components/layout/nav-data";
import { getNavMenuConfig, saveNavMenuConfig, type NavMenuItem } from "@/services/nav-menu-config";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  Save,
  RotateCcw,
  Menu as MenuIcon,
  Folder,
  FolderOpen,
  X,
  Pencil,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

interface FlatItem {
  id: string; // "link:/dashboard" | "group:catalogos"
  type: "link" | "group";
  key: string; // href | section
  label: string; // label efectivo (customLabel || defaultLabel)
  defaultLabel: string; // label original de nav-data.ts
  customLabel?: string; // nombre custom si el usuario lo editó
  icon: LucideIcon;
  depth: number; // 0 = raíz, 1 = dentro de grupo, 2 = dentro de subgrupo
}

interface AvailableItem {
  type: "link" | "group";
  key: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

// ═══════════════════════════════════════════════════════════════
// Catálogo de items disponibles (de nav-data.ts)
// ═══════════════════════════════════════════════════════════════

function buildAvailableItems(): AvailableItem[] {
  const items: AvailableItem[] = [];
  for (const l of mainLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Principales" });
  for (const l of catalogLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Catálogos" });
  for (const l of inspectionCatalogLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Catálogos Inspección" });
  for (const l of gestionCatalogLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Gestiones" });
  for (const l of operationLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Operaciones" });
  for (const l of adminLinks) items.push({ type: "link", key: l.href, label: l.label, icon: l.icon, category: "Administración" });
  for (const g of navGroups) items.push({ type: "group", key: g.section, label: g.title, icon: g.icon, category: "Grupos" });
  return items;
}

const ALL_AVAILABLE = buildAvailableItems();
const AVAILABLE_MAP = new Map(ALL_AVAILABLE.map(a => [`${a.type}:${a.key}`, a]));

// Categorías de la paleta en orden
const PALETTE_CATEGORIES = ["Principales", "Grupos", "Catálogos", "Catálogos Inspección", "Gestiones", "Operaciones", "Administración"];

// ═══════════════════════════════════════════════════════════════
// Conversión config ↔ flat
// ═══════════════════════════════════════════════════════════════

// Helper: construir un FlatItem con label efectivo (custom || default)
function makeFlatItem(
  type: "link" | "group",
  key: string,
  defaultLabel: string,
  icon: LucideIcon,
  depth: number,
  customLabel?: string,
): FlatItem {
  const trimmed = customLabel?.trim();
  return {
    id: `${type}:${key}`,
    type,
    key,
    defaultLabel,
    customLabel: trimmed || undefined,
    label: trimmed || defaultLabel,
    icon,
    depth,
  };
}

function configToFlat(config: NavMenuItem[] | null | undefined): FlatItem[] {
  if (!config || config.length === 0) return defaultFlatFromNavData();
  const flat: FlatItem[] = [];
  // Procesar recursivamente: depth 0 = raíz, 1 = dentro de grupo, 2 = dentro de subgrupo
  function processItem(item: NavMenuItem, depth: number): void {
    const avail = AVAILABLE_MAP.get(`${item.type}:${item.key}`);
    if (!avail) return; // item que ya no existe en nav-data
    if (item.type === "group") {
      // Grupos solo pueden existir a depth 0 o 1 (máximo 2 niveles)
      if (depth > 1) return;
      flat.push(makeFlatItem("group", item.key, avail.label, avail.icon, depth, item.label));
      if (Array.isArray(item.children)) {
        for (const child of item.children) {
          processItem(child, depth + 1);
        }
      }
    } else {
      // Links pueden estar a cualquier depth (0, 1, 2)
      flat.push(makeFlatItem("link", item.key, avail.label, avail.icon, depth));
    }
  }
  for (const item of config) {
    processItem(item, 0);
  }
  // Agregar items de nav-data que no están en la config (no perderlos)
  const usedKeys = new Set(flat.map(f => f.id));
  for (const l of mainLinks) {
    if (!usedKeys.has(`link:${l.href}`)) {
      flat.push(makeFlatItem("link", l.href, l.label, l.icon, 0));
      usedKeys.add(`link:${l.href}`);
    }
  }
  for (const g of navGroups) {
    if (!usedKeys.has(`group:${g.section}`)) {
      flat.push(makeFlatItem("group", g.section, g.title, g.icon, 0));
      usedKeys.add(`group:${g.section}`);
      for (const l of g.links) {
        if (!usedKeys.has(`link:${l.href}`)) {
          flat.push(makeFlatItem("link", l.href, l.label, l.icon, 1));
          usedKeys.add(`link:${l.href}`);
        }
      }
    }
  }
  return flat;
}

function defaultFlatFromNavData(): FlatItem[] {
  const flat: FlatItem[] = [];
  for (const l of mainLinks) flat.push(makeFlatItem("link", l.href, l.label, l.icon, 0));
  for (const g of navGroups) {
    flat.push(makeFlatItem("group", g.section, g.title, g.icon, 0));
    for (const l of g.links) flat.push(makeFlatItem("link", l.href, l.label, l.icon, 1));
  }
  return flat;
}

// flatToConfig: convierte el array plano a estructura jerárquica.
// Los grupos a depth 0 contienen children a depth 1.
// Los grupos a depth 1 (subgrupos) contienen children a depth 2.
// Los links toman el depth del lugar donde están.
// Los grupos guardan su customLabel si lo tienen.
function flatToConfig(flat: FlatItem[]): NavMenuItem[] {
  const items: NavMenuItem[] = [];
  let i = 0;
  while (i < flat.length) {
    const row = flat[i];
    if (row.type === "group") {
      const children: NavMenuItem[] = [];
      i++;
      // Consumir todos los items con depth > row.depth que siguen
      while (i < flat.length && flat[i].depth > row.depth) {
        const child = flat[i];
        if (child.type === "group") {
          // Subgrupo: consumir sus children (depth > child.depth)
          const subChildren: NavMenuItem[] = [];
          i++;
          while (i < flat.length && flat[i].depth > child.depth) {
            subChildren.push({ type: "link", key: flat[i].key });
            i++;
          }
          // Guardar customLabel del subgrupo si es diferente al default
          const subLabel = child.customLabel && child.customLabel !== child.defaultLabel ? child.customLabel : undefined;
          children.push({ type: "group", key: child.key, label: subLabel, children: subChildren });
        } else {
          children.push({ type: "link", key: child.key });
          i++;
        }
      }
      // Guardar customLabel del grupo si es diferente al default
      const label = row.customLabel && row.customLabel !== row.defaultLabel ? row.customLabel : undefined;
      items.push({ type: "group", key: row.key, label, children });
    } else {
      items.push({ type: "link", key: row.key });
      i++;
    }
  }
  return items;
}

// ═══════════════════════════════════════════════════════════════
// Modifier: centrar DragOverlay en el cursor
// ═══════════════════════════════════════════════════════════════

const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent && draggingNodeRect) {
    const event = activatorEvent as PointerEvent;
    const cursorX = event.clientX + transform.x;
    const cursorY = event.clientY + transform.y;
    return {
      ...transform,
      x: cursorX - draggingNodeRect.left - draggingNodeRect.width / 2,
      y: cursorY - draggingNodeRect.top - draggingNodeRect.height / 2,
    };
  }
  return transform;
};

// ═══════════════════════════════════════════════════════════════
// Collision detection custom
// Usa closestCenter para detectar el item más cercano al cursor.
// Filtra canvas-root cuando hay items, para que siempre se detecte
// un item real (y así poder insertar antes/después basado en la
// posición del cursor relativa al centro del item).
// ═══════════════════════════════════════════════════════════════

function createMenuCollisionDetection(hasItems: boolean): CollisionDetection {
  return (args) => {
    const collisions = closestCenter(args);
    if (hasItems) {
      // Filtrar canvas-root — siempre preferir un item real
      const itemCollisions = collisions.filter(c => c.id !== "canvas-root");
      if (itemCollisions.length > 0) return itemCollisions;
    }
    return collisions;
  };
}

// ═══════════════════════════════════════════════════════════════
// Colores por tipo
// ═══════════════════════════════════════════════════════════════

const GROUP_STYLE = {
  bg: "from-violet-500/15 to-violet-600/5",
  border: "border-violet-500/30",
  text: "text-violet-400",
  glow: "bg-violet-500/10",
  iconBg: "bg-violet-500/20 border-violet-500/30",
};

const LINK_STYLE = {
  bg: "from-sky-500/10 to-sky-600/5",
  border: "border-sky-500/20",
  text: "text-sky-400",
  glow: "bg-sky-500/10",
  iconBg: "bg-sky-500/15 border-sky-500/25",
};

// Subgrupo: estilo intermedio (violeta más suave que grupo raíz)
const SUBGROUP_STYLE = {
  bg: "from-violet-500/10 to-indigo-600/5",
  border: "border-indigo-500/25",
  text: "text-indigo-400",
  glow: "bg-indigo-500/10",
  iconBg: "bg-indigo-500/15 border-indigo-500/25",
};

// ═══════════════════════════════════════════════════════════════
// Componente: SortableMenuNode — nodo del menú en el canvas
// ═══════════════════════════════════════════════════════════════

function SortableMenuNode({
  item,
  isExpanded,
  onToggleGroup,
  onRemove,
  onRename,
  isDropTarget,
  dropIndicator,
}: {
  item: FlatItem;
  isExpanded: boolean;
  onToggleGroup: () => void;
  onRemove: () => void;
  onRename: (customLabel: string) => void;
  isDropTarget: boolean;
  dropIndicator: "before" | "after" | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: item.id,
    data: { source: "canvas", itemId: item.id },
  });

  // Con DragOverlay, NO aplicar transform al original — el overlay sigue el cursor.
  // El nodo original solo cambia opacidad (efecto "ghost").
  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const isGroup = item.type === "group";
  const isSubgroup = isGroup && item.depth === 1;
  const sc = isSubgroup ? SUBGROUP_STYLE : isGroup ? GROUP_STYLE : LINK_STYLE;
  const Icon = item.icon;

  // Estado de edición inline del label (solo grupos)
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset editValue cuando cambia el label efectivo (ej: al cargar config)
  const [prevLabel, setPrevLabel] = useState(item.label);
  if (item.label !== prevLabel) {
    setPrevLabel(item.label);
    setEditValue(item.label);
  }

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(item.customLabel || item.defaultLabel);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    onRename(editValue);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
    setEditValue(item.label);
  };

  // Focus automático al entrar en modo edición
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-2 py-1.5",
        "bg-linear-to-br backdrop-blur-sm border transition-all duration-150",
        `bg-linear-to-br ${sc.bg} ${sc.border}`,
        editing ? "cursor-default" : "hover:scale-[1.01]",
        isDropTarget && "ring-2 ring-violet-500/60 scale-[1.02]",
      )}
      onClick={isGroup && !editing ? onToggleGroup : undefined}
    >
      {/* Glow decorativo */}
      <div className={cn("pointer-events-none absolute -inset-0.5 rounded-lg blur-sm opacity-20 -z-10", sc.glow)} />

      {/* Indent visual para children */}
      {item.depth === 1 && (
        <CornerDownRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
      )}

      {/* Grip handle — DRAG HANDLE exclusivo.
          Los listeners de dnd-kit van SOLO aquí, no en el div padre,
          para que los botones (lápiz, remove, expand) reciban clicks normales. */}
      {!editing && (
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="flex items-center shrink-0 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastrar para reordenar"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
        </button>
      )}

      {/* Icon badge */}
      <div className={cn("flex h-6 w-6 items-center justify-center rounded-md border shrink-0", sc.iconBg)}>
        {isGroup ? (
          isExpanded ? <FolderOpen className={cn("h-3.5 w-3.5", sc.text)} /> : <Folder className={cn("h-3.5 w-3.5", sc.text)} />
        ) : (
          <Icon className={cn("h-3.5 w-3.5", sc.text)} />
        )}
      </div>

      {/* Label o input de edición */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditing(false); setEditValue(item.label); }
          }}
          onBlur={commitEdit}
          className="flex-1 min-w-0 rounded bg-white/10 dark:bg-black/30 border border-violet-500/40
            px-1.5 py-0.5 text-[11px] font-semibold text-foreground outline-none
            focus:ring-1 focus:ring-violet-500/50"
          placeholder={item.defaultLabel}
        />
      ) : (
        <span className={cn(
          "truncate text-[11px] flex-1",
          isGroup ? "font-semibold" : "font-normal",
          item.depth === 1 && "text-muted-foreground",
          item.customLabel && "italic",
        )}>
          {item.label}
        </span>
      )}

      {/* Badge tipo (oculto en edición) */}
      {!editing && (
        <span className={cn(
          "rounded px-1.5 py-0.5 text-[9px] font-medium shrink-0",
          isSubgroup
            ? "bg-indigo-500/15 text-indigo-400"
            : isGroup
            ? "bg-violet-500/15 text-violet-400"
            : "bg-sky-500/10 text-sky-400/70",
        )}>
          {isSubgroup ? "subgrupo" : isGroup ? "grupo" : "link"}
        </span>
      )}

      {/* Expand/collapse chevron para grupos (oculto en edición) */}
      {isGroup && !editing && (
        <span className="shrink-0 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      )}

      {/* Edit button (solo grupos, oculto en edición) */}
      {isGroup && !editing && (
        <button
          type="button"
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded
            bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/30
            text-muted-foreground hover:text-violet-400 transition-all active:scale-90 shrink-0"
          title="Renombrar grupo"
          onClick={startEdit}
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Confirm button (solo en edición) */}
      {editing && (
        <button
          type="button"
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded
            bg-emerald-500/20 border border-emerald-500/30
            text-emerald-400 transition-all active:scale-90 shrink-0"
          title="Confirmar"
          onClick={(e) => { e.stopPropagation(); commitEdit(); }}
        >
          <Check className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Cancel button (solo en edición) */}
      {editing && (
        <button
          type="button"
          className="flex h-4 w-4 items-center justify-center rounded
            bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30
            text-muted-foreground hover:text-rose-400 transition-all active:scale-90 shrink-0"
          title="Cancelar"
          onClick={cancelEdit}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Remove button (oculto en edición) */}
      {!editing && (
        <button
          type="button"
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded
            bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30
            text-muted-foreground hover:text-rose-400 transition-all active:scale-90 shrink-0"
          title="Quitar del menú"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Drop indicator — línea violeta que muestra dónde va a caer el item */}
      {dropIndicator === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-0 right-0 h-0.5 bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
      )}
      {dropIndicator === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-0.5 bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
      )}

      {/* Drop target highlight (legacy, para drops de paleta sobre grupos) */}
      {isDropTarget && (
        <div className="pointer-events-none absolute -inset-1 rounded-lg border-2 border-violet-500/40 bg-violet-500/5 animate-pulse" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente: PaletteItem — item arrastrable de la paleta
// ═══════════════════════════════════════════════════════════════

function PaletteItem({ item, disabled }: { item: AvailableItem; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.type}:${item.key}`,
    data: { source: "palette", type: item.type, key: item.key, label: item.label },
    disabled,
  });

  const Icon = item.icon;
  const isGroup = item.type === "group";
  const sc = isGroup ? GROUP_STYLE : LINK_STYLE;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      disabled={disabled}
      className={cn(
        "group flex items-center gap-2 w-full rounded-lg px-2 py-1.5 border transition-all duration-200",
        "active:scale-95",
        disabled
          ? "bg-white/2 border-white/5 opacity-40 cursor-not-allowed"
          : "bg-white/5 hover:bg-violet-500/15 border-white/10 hover:border-violet-500/30 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <GripVertical className={cn(
        "h-3 w-3 shrink-0 transition-colors",
        disabled ? "text-muted-foreground/20" : "text-muted-foreground/40 group-hover:text-violet-400"
      )} />
      <div className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md border shrink-0",
        sc.iconBg,
        !disabled && "group-hover:scale-110 transition-transform",
      )}>
        {isGroup ? <Folder className={cn("h-3.5 w-3.5", sc.text)} /> : <Icon className={cn("h-3.5 w-3.5", sc.text)} />}
      </div>
      <span className={cn(
        "truncate text-[11px] text-left flex-1",
        isGroup ? "font-semibold" : "font-normal",
        disabled && "line-through",
      )}>
        {item.label}
      </span>
      {isGroup && (
        <span className="rounded px-1 py-0.5 text-[8px] font-medium bg-violet-500/15 text-violet-400 shrink-0">
          grupo
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente: CanvasRoot — zona raíz del canvas (droppable)
// ═══════════════════════════════════════════════════════════════

function CanvasRoot({
  children,
  isPaletteDrag,
  isEmpty,
}: {
  children: React.ReactNode;
  isPaletteDrag: boolean;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { source: "canvas" },
  });

  const showDropIndicator = isPaletteDrag && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-200 min-h-[200px] flex flex-col",
        showDropIndicator
          ? "ring-2 ring-violet-500/50 bg-violet-500/5 border-violet-500/30"
          : isPaletteDrag
          ? "ring-1 ring-violet-500/20 border-violet-500/15 border-dashed"
          : "border-white/10 dark:border-white/5",
        "bg-white/2 backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 border-b transition-colors shrink-0",
        showDropIndicator ? "border-violet-500/30 bg-violet-500/5" : "border-white/5",
      )}>
        <div className={cn(
          "flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
          showDropIndicator ? "bg-violet-500/20 border-violet-500/40" : "bg-violet-500/10 border-violet-500/20",
        )}>
          <MenuIcon className={cn("h-3.5 w-3.5", showDropIndicator ? "text-violet-300" : "text-violet-400")} />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-violet-400">Estructura del Menú</span>
          <span className="text-[9px] text-muted-foreground">
            {isEmpty ? "Arrastra items desde la paleta →" : showDropIndicator ? "Soltar aquí como item raíz" : "Arrastra para reordenar"}
          </span>
        </div>
      </div>
      {/* Contenido */}
      <div className="p-3 flex-1">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Página principal
// ═══════════════════════════════════════════════════════════════

export default function AdminMenuPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["nav-menu-config"],
    queryFn: getNavMenuConfig,
  });

  const [flat, setFlat] = useState<FlatItem[]>(() => defaultFlatFromNavData());
  const [dirty, setDirty] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<{ id: string; label: string; icon: LucideIcon; isGroup: boolean } | null>(null);
  // Drop indicator: muestra una línea violeta antes/después del item over
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: "before" | "after" } | null>(null);

  // Sincronizar flat cuando llega la config de la BD
  const [prevConfig, setPrevConfig] = useState<typeof config>(undefined);
  if (config !== prevConfig) {
    setPrevConfig(config);
    const newFlat = configToFlat(config?.items ?? null);
    setFlat(newFlat);
    // Auto-expandir todos los grupos que tienen children
    const expanded = new Set<string>();
    for (let i = 0; i < newFlat.length; i++) {
      if (newFlat[i].type === "group") {
        const hasChildren = i + 1 < newFlat.length && newFlat[i + 1].depth === 1;
        if (hasChildren) expanded.add(newFlat[i].id);
      }
    }
    setExpandedGroups(expanded);
    setDirty(false);
  }

  const saveMut = useMutation({
    mutationFn: (items: NavMenuItem[]) => saveNavMenuConfig({ items }),
    onSuccess: () => {
      toast.success("Menú guardado");
      queryClient.invalidateQueries({ queryKey: ["nav-menu-config"] });
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const collisionDetection = useMemo(
    () => createMenuCollisionDetection(flat.length > 0),
    [flat.length],
  );

  // Items de la paleta: todos los disponibles menos los que ya están en el canvas
  const canvasIds = useMemo(() => new Set(flat.map(f => `${f.type}:${f.key}`)), [flat]);

  const paletteByCategory = useMemo(() => {
    const map = new Map<string, AvailableItem[]>();
    for (const cat of PALETTE_CATEGORIES) map.set(cat, []);
    for (const item of ALL_AVAILABLE) {
      const inCanvas = canvasIds.has(`${item.type}:${item.key}`);
      if (!inCanvas) {
        map.get(item.category)?.push(item);
      }
    }
    return map;
  }, [canvasIds]);

  // ═══ DnD Handlers ═══

  const onDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.source === "palette") {
      const avail = AVAILABLE_MAP.get(`${data.type}:${data.key}`);
      if (avail) {
        setActiveDrag({ id: e.active.id as string, label: avail.label, icon: avail.icon, isGroup: data.type === "group" });
      }
    } else if (data?.source === "canvas") {
      const item = flat.find(f => f.id === data.itemId);
      if (item) {
        setActiveDrag({ id: e.active.id as string, label: item.label, icon: item.icon, isGroup: item.type === "group" });
      }
    }
  }, [flat]);

  // onDragMove: trackear la posición del cursor para mostrar el drop indicator.
  // Determina si el cursor está en la mitad superior o inferior del item over.
  const onDragMove = useCallback((e: DragMoveEvent) => {
    const { over } = e;
    if (!over || over.id === "canvas-root") {
      setDropIndicator(null);
      return;
    }
    const overId = over.id as string;
    const overRect = over.rect;
    const activatorEvent = e.activatorEvent as PointerEvent;
    const cursorY = activatorEvent.clientY + e.delta.y;
    const isUpperHalf = cursorY < overRect.top + overRect.height / 2;
    setDropIndicator({ id: overId, position: isUpperHalf ? "before" : "after" });
  }, []);

  const onDragCancel = useCallback(() => {
    setActiveDrag(null);
    setDropIndicator(null);
  }, []);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDrag(null);
    setDropIndicator(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    // ── Drop desde paleta ──
    if (activeData?.source === "palette") {
      const avail = AVAILABLE_MAP.get(`${activeData.type}:${activeData.key}`);
      const newItem = makeFlatItem(
        activeData.type,
        activeData.key,
        avail?.label || activeData.key,
        avail?.icon || MenuIcon,
        0,
      );

      // Si ya está en el canvas, no duplicar
      if (canvasIds.has(`${newItem.type}:${newItem.key}`)) {
        toast.error("Ese item ya está en el menú");
        return;
      }

      // Determinar before/after basado en la posición del cursor
      const overRect = over.rect;
      const activatorEvent = e.activatorEvent as PointerEvent;
      const cursorY = activatorEvent.clientY + e.delta.y;
      const isUpperHalf = cursorY < overRect.top + overRect.height / 2;

      setFlat(prev => {
        // Canvas vacío → agregar al final
        if (overId === "canvas-root" || prev.length === 0) {
          return [...prev, newItem];
        }

        const overIdx = prev.findIndex(f => f.id === overId);
        if (overIdx === -1) return [...prev, newItem];

        const overItem = prev[overIdx];

        // Si se droppeó sobre un grupo:
        // - Si el grupo NO tiene children (vacío) → agregar como child
        // - Si el grupo TIENE children y está expandido → before/after como sibling
        // - Si el grupo TIENE children y está colapsado → agregar como child al final
        if (overItem.type === "group") {
          // Verificar si tiene children
          let hasChildren = false;
          for (let i = overIdx + 1; i < prev.length; i++) {
            if (prev[i].depth <= overItem.depth) break;
            hasChildren = true;
            break;
          }
          const isExpanded = expandedGroups.has(overItem.id);

          if (!hasChildren || !isExpanded) {
            // Grupo vacío o colapsado → agregar como child al final
            if (newItem.type === "group" && overItem.depth >= 1) {
              toast.error("No se pueden anidar más de 2 niveles de grupos");
              return prev;
            }
            const childDepth = overItem.depth + 1;
            let insertAfter = overIdx;
            for (let i = overIdx + 1; i < prev.length; i++) {
              if (prev[i].depth <= overItem.depth) break;
              insertAfter = i;
            }
            const next = [...prev];
            next.splice(insertAfter + 1, 0, { ...newItem, depth: childDepth });
            setExpandedGroups(exp => new Set([...exp, overItem.id]));
            return next;
          }

          // Grupo expandido con children → before/after como sibling
          if (isUpperHalf) {
            // Insertar antes del grupo (mismo depth)
            const next = [...prev];
            next.splice(overIdx, 0, { ...newItem, depth: overItem.depth });
            return next;
          } else {
            // Insertar después del grupo y todos sus descendientes (mismo depth)
            let insertAfter = overIdx;
            for (let i = overIdx + 1; i < prev.length; i++) {
              if (prev[i].depth <= overItem.depth) break;
              insertAfter = i;
            }
            const next = [...prev];
            next.splice(insertAfter + 1, 0, { ...newItem, depth: overItem.depth });
            return next;
          }
        }

        // Si se droppeó sobre un link → before/after basado en cursor
        if (isUpperHalf) {
          const next = [...prev];
          next.splice(overIdx, 0, { ...newItem, depth: overItem.depth });
          return next;
        } else {
          const next = [...prev];
          next.splice(overIdx + 1, 0, { ...newItem, depth: overItem.depth });
          return next;
        }
      });
      setDirty(true);
      return;
    }

    // ── Reorder dentro del canvas ──
    if (activeData?.source === "canvas") {
      const activeId = activeData.itemId as string;
      if (activeId === overId) return;

      // Determinar before/after basado en la posición del cursor
      const overRect = over.rect;
      const activatorEvent = e.activatorEvent as PointerEvent;
      const cursorY = activatorEvent.clientY + e.delta.y;
      const isUpperHalf = cursorY < overRect.top + overRect.height / 2;

      setFlat(prev => {
        const oldIdx = prev.findIndex(f => f.id === activeId);
        if (oldIdx === -1) return prev;

        const activeItem = prev[oldIdx];

        // Extraer el item activo Y todos sus descendientes (si es un grupo)
        let blockEnd = oldIdx + 1;
        while (blockEnd < prev.length && prev[blockEnd].depth > activeItem.depth) {
          blockEnd++;
        }
        const movedBlock = prev.slice(oldIdx, blockEnd);
        const remaining = [...prev.slice(0, oldIdx), ...prev.slice(blockEnd)];

        // ── Drop sobre canvas-root → mover a raíz (depth=0) al final ──
        if (overId === "canvas-root") {
          const adjustedBlock = movedBlock.map((item, i) => ({
            ...item,
            depth: i === 0 ? 0 : item.depth - activeItem.depth,
          }));
          return [...remaining, ...adjustedBlock];
        }

        const overIdx = remaining.findIndex(f => f.id === overId);
        if (overIdx === -1) return prev;

        const overItem = remaining[overIdx];

        // ── Drop sobre un grupo → mover dentro del grupo como child ──
        // (solo si el grupo está vacío o colapsado; si está expandido con children,
        // se usa before/after como sibling — igual que los links)
        if (overItem.type === "group" && activeItem.id !== overItem.id) {
          let hasChildren = false;
          for (let i = overIdx + 1; i < remaining.length; i++) {
            if (remaining[i].depth <= overItem.depth) break;
            hasChildren = true;
            break;
          }
          const isExpanded = expandedGroups.has(overItem.id);

          if (!hasChildren || !isExpanded) {
            // Grupo vacío o colapsado → mover dentro como child
            if (activeItem.type === "group" && overItem.depth >= 1) {
              toast.error("No se pueden anidar más de 2 niveles de grupos");
              return prev;
            }
            if (movedBlock.some(m => m.id === overItem.id)) {
              toast.error("No se puede mover un grupo dentro de sí mismo");
              return prev;
            }
            const childDepth = overItem.depth + 1;
            const depthDelta = childDepth - activeItem.depth;
            let insertAfter = overIdx;
            for (let i = overIdx + 1; i < remaining.length; i++) {
              if (remaining[i].depth <= overItem.depth) break;
              insertAfter = i;
            }
            const adjustedBlock = movedBlock.map(item => ({ ...item, depth: item.depth + depthDelta }));
            const next = [...remaining];
            next.splice(insertAfter + 1, 0, ...adjustedBlock);
            setExpandedGroups(exp => new Set([...exp, overItem.id]));
            return next;
          }
          // Grupo expandido con children → cae al before/after de abajo
        }

        // ── Reorder normal: before/after basado en cursor ──
        // Calcular índice de inserción
        let insertIdx = overIdx;
        if (!isUpperHalf) {
          // After: si es un grupo, insertar después de todos sus descendientes
          if (overItem.type === "group") {
            let afterIdx = overIdx;
            for (let i = overIdx + 1; i < remaining.length; i++) {
              if (remaining[i].depth <= overItem.depth) break;
              afterIdx = i;
            }
            insertIdx = afterIdx + 1;
          } else {
            insertIdx = overIdx + 1;
          }
        }

        // El depth del item movido = depth del item que está en insertIdx-1
        // (o del over item si es before). Esto mantiene la coherencia del árbol.
        let targetDepth = overItem.depth;
        if (!isUpperHalf && insertIdx >= remaining.length) {
          // Insertando al final → depth 0 (raíz)
          targetDepth = 0;
        } else if (!isUpperHalf && insertIdx < remaining.length) {
          // After: el depth del item siguiente determina el contexto
          const nextItem = remaining[insertIdx];
          if (nextItem.depth <= overItem.depth) {
            // El siguiente item es un sibling o está menos anidado → mismo depth
            targetDepth = overItem.depth;
          } else {
            // El siguiente item está más anidado → somos el último child del grupo
            targetDepth = overItem.depth;
          }
        }

        const depthDelta = targetDepth - activeItem.depth;
        const adjustedBlock = movedBlock.map(item => ({ ...item, depth: item.depth + depthDelta }));
        const next = [...remaining];
        next.splice(insertIdx, 0, ...adjustedBlock);
        return next;
      });
      setDirty(true);
    }
  }, [canvasIds, expandedGroups]);

  // ═══ Acciones ═══

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Renombrar un grupo: actualiza customLabel y recalcula el label efectivo.
  // Si el nuevo valor es igual al default, se limpia el customLabel.
  const renameItem = (id: string, customLabel: string) => {
    setFlat(prev => prev.map(f => {
      if (f.id !== id) return f;
      const trimmed = customLabel.trim();
      return {
        ...f,
        customLabel: trimmed && trimmed !== f.defaultLabel ? trimmed : undefined,
        label: trimmed || f.defaultLabel,
      };
    }));
    setDirty(true);
  };

  const removeItem = (id: string) => {
    setFlat(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx === -1) return prev;
      // Si es un grupo, remover todos sus descendientes (depth > item.depth)
      if (prev[idx].type === "group") {
        const itemDepth = prev[idx].depth;
        let end = idx + 1;
        while (end < prev.length && prev[end].depth > itemDepth) end++;
        return [...prev.slice(0, idx), ...prev.slice(end)];
      }
      return prev.filter(f => f.id !== id);
    });
    setDirty(true);
  };

  const handleSave = () => {
    const configItems = flatToConfig(flat);
    saveMut.mutate(configItems);
  };

  const handleReset = () => {
    if (!confirm("¿Restablecer al orden por defecto? Se perderán los cambios no guardados.")) return;
    const def = defaultFlatFromNavData();
    setFlat(def);
    const expanded = new Set<string>();
    for (let i = 0; i < def.length; i++) {
      if (def[i].type === "group" && i + 1 < def.length && def[i + 1].depth === 1) {
        expanded.add(def[i].id);
      }
    }
    setExpandedGroups(expanded);
    setDirty(true);
  };

  // Items visibles en el canvas (respetar expand/collapse de grupos y subgrupos)
  // Un grupo colapsado oculta TODOS sus descendientes.
  // Un subgrupo colapsado oculta solo sus links (depth > subgrupo.depth).
  const visibleFlat = useMemo(() => {
    const result: FlatItem[] = [];
    // Stack de "depth límite" — si un ancestro está colapsado, no mostrar
    // items con depth > ese ancestro.
    const collapsedDepths: number[] = [];
    for (const item of flat) {
      // Pop del stack los depths que ya no aplican
      while (collapsedDepths.length > 0 && collapsedDepths[collapsedDepths.length - 1] >= item.depth) {
        collapsedDepths.pop();
      }
      // Si hay algún ancestro colapsado, skip
      if (collapsedDepths.length > 0) continue;
      result.push(item);
      // Si es un grupo colapsado, push su depth al stack
      if (item.type === "group" && !expandedGroups.has(item.id)) {
        collapsedDepths.push(item.depth);
      }
    }
    return result;
  }, [flat, expandedGroups]);

  const groupCount = flat.filter(f => f.type === "group").length;
  const linkCount = flat.filter(f => f.type === "link").length;
  const isPaletteDrag = activeDrag?.id.startsWith("palette:") ?? false;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
        bg-white/5 dark:bg-white/2 backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        px-5 py-4">
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl
            bg-linear-to-br from-violet-500/20 to-sky-500/20 backdrop-blur-sm
            border border-white/10">
            <MenuIcon className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Menú Lateral</h1>
            <p className="text-[11px] text-muted-foreground">
              Arrastra items desde la paleta para construir el menú · {groupCount} grupos · {linkCount} links
              {dirty && <span className="text-amber-400 ml-1">· cambios sin guardar</span>}
            </p>
          </div>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={handleReset}
            className="pg-btn-platinum"
            disabled={saveMut.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer
          </Button>
          <Button
            onClick={handleSave}
            className="pg-btn-platinum"
            disabled={!dirty || saveMut.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            Guardar
          </Button>
        </div>
      </div>

      {/* Contenido principal: canvas + paleta */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        modifiers={[snapCenterToCursor]}
      >
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Canvas: estructura del menú */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              </div>
            ) : (
              <CanvasRoot isPaletteDrag={isPaletteDrag} isEmpty={flat.length === 0}>
                {flat.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic text-center py-8">
                    Sin items — arrastra desde la paleta →
                  </p>
                ) : (
                  <SortableContext items={visibleFlat.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {visibleFlat.map(item => (
                        <div key={item.id} style={{ paddingLeft: item.depth * 20 }}>
                          <SortableMenuNode
                            item={item}
                            isExpanded={expandedGroups.has(item.id)}
                            onToggleGroup={() => toggleGroup(item.id)}
                            onRemove={() => removeItem(item.id)}
                            onRename={(customLabel) => renameItem(item.id, customLabel)}
                            isDropTarget={false}
                            dropIndicator={
                              dropIndicator?.id === item.id ? dropIndicator.position : null
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                )}
              </CanvasRoot>
            )}
          </div>

          {/* Paleta: items disponibles */}
          <div className="w-[280px] shrink-0 relative overflow-auto rounded-2xl border border-white/10 dark:border-white/5
            bg-white/5 dark:bg-white/2 backdrop-blur-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]
            p-4">
            <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <span className="text-[11px] font-semibold">Paleta</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 ml-9">
                Arrastra al canvas para agregar
              </p>
            </div>

            <div className="relative space-y-3">
              {PALETTE_CATEGORIES.map(cat => {
                const items = paletteByCategory.get(cat) || [];
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <div className="h-px flex-1 bg-white/5" />
                      <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                        {cat}
                      </span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="space-y-1">
                      {items.map(item => (
                        <PaletteItem
                          key={`${item.type}:${item.key}`}
                          item={item}
                          disabled={false}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {ALL_AVAILABLE.every(a => canvasIds.has(`${a.type}:${a.key}`)) && (
                <p className="text-[11px] text-muted-foreground italic text-center py-4">
                  Todos los items están en el menú
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDrag ? (
            <div className="flex items-center gap-2 rounded-lg border border-violet-500/40
              bg-card/80 backdrop-blur-xl px-3 py-1.5
              shadow-[0_8px_30px_rgba(139,92,246,0.2)]">
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border",
                activeDrag.isGroup ? "bg-violet-500/20 border-violet-500/30" : "bg-sky-500/15 border-sky-500/25",
              )}>
                {activeDrag.isGroup ? (
                  <Folder className="h-3.5 w-3.5 text-violet-400" />
                ) : (
                  <activeDrag.icon className="h-3.5 w-3.5 text-sky-400" />
                )}
              </div>
              <span className="text-[11px] font-semibold">{activeDrag.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
