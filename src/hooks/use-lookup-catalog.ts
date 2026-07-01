"use client";

import { useQuery } from "@tanstack/react-query";
import { getLookupCatalog } from "@/services/catalogs";
import type { LookupCatalog } from "@/types";

/**
 * Hook para obtener items de lookup_catalog por categoría.
 * Cachea por categoría para reutilizar entre componentes.
 *
 * Ejemplo:
 *   const { items, isLoading } = useLookupCatalog("materiality_walls");
 *   items.forEach(i => console.log(i.code, i.name));
 */
export function useLookupCatalog(category: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["lookup-catalog", category],
    queryFn: () => getLookupCatalog(category),
    staleTime: 1000 * 60 * 30, // 30 min (catálogos cambian poco)
  });

  return { items: data ?? [], isLoading };
}

/**
 * Hook para obtener múltiples categorías a la vez.
 * Útil para formularios que necesitan varios selects.
 *
 * Ejemplo:
 *   const { catalogs, isLoading } = useLookupCatalogs([
 *     "materiality_walls", "materiality_roof", "materiality_flooring"
 *   ]);
 *   catalogs["materiality_walls"] // LookupCatalog[]
 */
export function useLookupCatalogs(categories: string[]) {
  const queries = useQuery({
    queryKey: ["lookup-catalogs", categories],
    queryFn: async () => {
      const results = await Promise.all(
        categories.map(async (cat) => {
          const items = await getLookupCatalog(cat);
          return [cat, items] as const;
        })
      );
      return Object.fromEntries(results) as Record<string, LookupCatalog[]>;
    },
    staleTime: 1000 * 60 * 30,
  });

  return { catalogs: queries.data ?? {}, isLoading: queries.isLoading };
}
