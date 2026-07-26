"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * useIsUserMutating
 *
 * Cuenta las mutations en curso que NO son autoguardado.
 *
 * Las mutations de autoguardado se marcan con `meta: { autosave: true }`
 * al definirlas (useMutation({ meta: { autosave: true }, ... })).
 * Esas no se cuentan aquí, para que el GlobalLoadingOverlay no aparezca
 * cuando el usuario simplemente está escribiendo en un campo.
 *
 * El overlay solo debe aparecer cuando el usuario presiona un botón
 * físico (Guardar, Emitir, Eliminar, etc.), no en autoguardados
 * automáticos con debounce.
 */
export function useIsUserMutating(): number {
  const queryClient = useQueryClient();
  const cache = queryClient.getMutationCache();

  const subscribe = (callback: () => void) => {
    return cache.subscribe(callback);
  };

  const getSnapshot = (): number => {
    return cache
      .getAll()
      .filter((m) => {
        const meta = m.meta as Record<string, unknown> | undefined;
        const isAutosave = meta?.autosave === true;
        return !isAutosave && m.state.status === "pending";
      }).length;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
