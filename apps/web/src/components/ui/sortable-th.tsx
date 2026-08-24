"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/hooks/use-sort";

interface SortableThProps {
  children: React.ReactNode;
  sortKey: string;
  currentKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

/**
 * Header de tabla con indicador de ordenamiento.
 *
 * Uso:
 *   <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>
 *     Nombre
 *   </SortableTh>
 */
export function SortableTh({ children, sortKey, currentKey, direction, onSort, className = "" }: SortableThProps) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`cursor-pointer select-none hover:bg-muted/40 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {isActive && direction === "asc" && <ChevronUp className="h-3 w-3 text-primary" />}
        {isActive && direction === "desc" && <ChevronDown className="h-3 w-3 text-primary" />}
        {!isActive && <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />}
      </div>
    </th>
  );
}
