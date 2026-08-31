import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

/**
 * Hook reutilizable para ordenar tablas con accessors personalizados.
 *
 * Soporta campos anidados (ej: t.action_type?.name) mediante un accessor map.
 *
 * Uso:
 *   const { sorted, sortKey, sortDir, toggleSort } = useTableSort(data, {
 *     name: (t) => t.name,
 *     code: (t) => t.line_business?.code_prefix + t.action_feature?.code,
 *     action_type: (t) => t.action_type?.name || "",
 *     days_to_issue: (t) => t.days_to_issue,
 *   }, "name");
 *
 *   // En el header:
 *   <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>
 *     Nombre
 *   </SortableTh>
 */
export function useTableSort<T>(
  data: T[] | undefined,
  accessors: Record<string, (item: T) => unknown>,
  initialKey: string | null = "name",
  initialDirection: SortDirection = "asc"
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDirection);

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
    else setSortDir("asc");
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    if (!sortKey || !sortDir) return data;
    const accessor = accessors[sortKey];
    if (!accessor) return data;

    return [...data].sort((a, b) => {
      const aVal = accessor(a);
      const bVal = accessor(b);

      // Nulls/undefined van al final
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Números
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Booleanos (false < true)
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDir === "asc"
          ? (aVal === bVal ? 0 : aVal ? 1 : -1)
          : (aVal === bVal ? 0 : aVal ? -1 : 1);
      }

      // Strings y fallback: case-insensitive
      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, accessors]);

  return { sorted, sortKey, sortDir, toggleSort };
}
