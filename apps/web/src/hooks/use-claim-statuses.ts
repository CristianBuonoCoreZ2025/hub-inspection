"use client";

import { useQuery } from "@tanstack/react-query";
import { getLookupCatalog } from "@/services/catalogs";

/**
 * Hook que carga el catálogo de claim_status y expone mapas
 * para resolver código/label desde status_id y viceversa.
 *
 * Uso:
 *   const { statusCode, statusLabel, codeToId, statusColors } = useClaimStatuses();
 *   const code = statusCode(claim.status_id);   // "closed"
 *   const label = statusLabel(claim.status_id); // "Cerrado"
 *   const id = codeToId["closed"];              // uuid
 */
export function useClaimStatuses() {
  const { data: catalog } = useQuery({
    queryKey: ["lookup-catalog", "claim_status"],
    queryFn: () => getLookupCatalog("claim_status"),
    staleTime: 5 * 60 * 1000,
  });

  const items = catalog ?? [];

  // Mapas indexados
  const idToCode: Record<string, string> = {};
  const idToLabel: Record<string, string> = {};
  const codeToId: Record<string, string> = {};
  const codeToLabel: Record<string, string> = {};

  for (const item of items) {
    if (!item.code) continue;
    idToCode[item.id] = item.code;
    idToLabel[item.id] = item.name;
    codeToId[item.code] = item.id;
    codeToLabel[item.code] = item.name;
  }

  /** Resuelve el código machine-readable desde status_id */
  const statusCode = (statusId: string | null | undefined): string | null =>
    statusId ? idToCode[statusId] ?? null : null;

  /** Resuelve el label human-readable desde status_id */
  const statusLabel = (statusId: string | null | undefined): string =>
    statusId ? idToLabel[statusId] ?? "—" : "—";

  /** Resuelve el ID desde un código */
  const idFromCode = (code: string): string | null => codeToId[code] ?? null;

  return {
    items,
    idToCode,
    idToLabel,
    codeToId,
    codeToLabel,
    statusCode,
    statusLabel,
    idFromCode,
  };
}
