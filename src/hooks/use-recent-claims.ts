"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  getRecentClaimsSnapshot,
  getRecentClaimsServerSnapshot,
  subscribeRecentClaims,
  recordRecentClaim,
  removeRecentClaim,
  clearRecentClaims,
  type RecentClaimEntry,
} from "@/lib/recent-claims-client-store";

/**
 * Hook para leer la lista de siniestros visitados recientemente.
 * Reacciona a cambios en localStorage y a llamadas a
 * recordRecentClaim / removeRecentClaim / clearRecentClaims.
 */
export function useRecentClaims(): {
  recents: RecentClaimEntry[];
  record: (entry: { id: string; liquidationNumber: string | null; clientReference: string | null; insuredName: string | null; businessLineName: string | null; claimTypeIcon: string | null; countryCode: string | null }) => void;
  remove: (id: string) => void;
  clear: () => void;
} {
  const recents = useSyncExternalStore(
    subscribeRecentClaims,
    getRecentClaimsSnapshot,
    getRecentClaimsServerSnapshot
  );

  const record = useCallback(
    (entry: { id: string; liquidationNumber: string | null; clientReference: string | null; insuredName: string | null; businessLineName: string | null; claimTypeIcon: string | null; countryCode: string | null }) => {
      recordRecentClaim(entry);
    },
    []
  );

  const remove = useCallback((id: string) => {
    removeRecentClaim(id);
  }, []);

  const clear = useCallback(() => {
    clearRecentClaims();
  }, []);

  return { recents, record, remove, clear };
}
