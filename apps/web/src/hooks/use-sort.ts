import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortState<T> {
  key: keyof T | null;
  direction: SortDirection;
}

/**
 * Hook reutilizable para ordenar arrays de objetos.
 *
 * Uso:
 *   const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "name");
 *
 *   // En el header de la tabla:
 *   <th onClick={() => toggleSort("name")}>
 *     Nombre {sortKey === "name" && (sortDir === "asc" ? "▲" : "▼")}
 *   </th>
 */
export function useSort<T extends Record<string, unknown>>(
  data: T[] | undefined,
  initialKey: keyof T | null = null,
  initialDirection: SortDirection = "asc"
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDirection);

  const toggleSort = (key: keyof T) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else {
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    if (!sortKey || !sortDir) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Nulls/undefined van al final
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Strings: comparación case-insensitive
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        return sortDir === "asc" ? cmp : -cmp;
      }

      // Números
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Booleanos (false < true)
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDir === "asc" ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
      }

      // Fallback: comparar como strings
      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
