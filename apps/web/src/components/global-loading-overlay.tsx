"use client";

import { useEffect, useState } from "react";
import { useIsUserMutating } from "@/hooks/use-is-user-mutating";
import { Loader2Icon } from "lucide-react";

/**
 * GlobalLoadingOverlay
 *
 * Bloquea toda interacción del usuario mientras hay MUTATIONS en curso
 * que fueron iniciadas por el usuario (presionar un botón físico como
 * Guardar, Emitir, Eliminar, etc.).
 *
 * NO se muestra para:
 * - Queries de lectura (cambio de página, carga de datos)
 * - Mutations de autoguardado (meta: { autosave: true }) que se disparan
 *   automáticamente cuando el usuario escribe en campos con debounce
 *
 * - Se monta una sola vez en <Providers/> y aplica a TODAS las páginas.
 * - Tiene un retardo de 150ms antes de aparecer para no parpadear en
 *   operaciones rápidas.
 * - Se mantiene visible hasta que TODAS las mutations del usuario terminan.
 * - Usa un portal visual fixed con backdrop translúcido y spinner.
 */
export function GlobalLoadingOverlay() {
  const isMutating = useIsUserMutating();
  const isPending = isMutating > 0;

  const [visible, setVisible] = useState(false);

  // No mostrar el overlay cuando estamos offline.
  // Las mutations offline son a IndexedDB (instantáneas) y las mutations
  // online colgadas (fetch a Supabase) nunca terminan, dejando el overlay pegado.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (isPending && online) {
      // Retardo corto para no parpadear en operaciones rápidas (<150ms).
      const t = setTimeout(() => setVisible(true), 150);
      return () => clearTimeout(t);
    }
    // Ocultar en el siguiente tick para evitar setState sincrónico en el effect.
    const t = setTimeout(() => setVisible(false), 0);
    return () => clearTimeout(t);
  }, [isPending, online]);

  if (!visible) return null;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      role="status"
      className="cn-global-loading-overlay"
    >
      <div className="cn-global-loading-card">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="app-body cn-global-loading-text">
          Procesando…
        </span>
      </div>
    </div>
  );
}
