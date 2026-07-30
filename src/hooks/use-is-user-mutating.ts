"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
 *
 * Usa useEffect + useState en vez de useSyncExternalStore para evitar
 * el warning de React 19 "Cannot update a component while rendering
 * a different component".
 */
export function useIsUserMutating(): number {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const cache = queryClient.getMutationCache();

    let raf: number | null = null;
    const update = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        setCount(
          cache
            .getAll()
            .filter((m) => {
              const meta = m.meta as Record<string, unknown> | undefined;
              const isAutosave = meta?.autosave === true;
              return !isAutosave && m.state.status === "pending";
            }).length
        );
      });
    };

    update();
    const unsub = cache.subscribe(update);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsub();
    };
  }, [queryClient]);

  return count;
}
