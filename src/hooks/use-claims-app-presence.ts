"use client";

import { useEffect, useState } from "react";

/**
 * Detección cross-tab de la aplicación Claims.
 *
 * El dashboard (cualquier ruta bajo /dashboard) escribe un heartbeat en
 * localStorage cada 3 segundos. La página del Magic Link lee ese heartbeat
 * al montarse: si existe y es reciente (menos de 6 segundos), significa que
 * la aplicación Claims está abierta en otra pestaña del mismo navegador.
 *
 * Esto evita que el inspector abra el Magic Link en el mismo navegador donde
 * ya tiene el dashboard abierto, lo que causaría conflictos en la videollamada
 * (el inspector se conectaría consigo mismo o confundiría los roles).
 *
 * Clave de localStorage: "claims_app_heartbeat"
 * Valor: timestamp (ms) del último heartbeat
 */

const HEARTBEAT_KEY = "claims_app_heartbeat";
const HEARTBEAT_INTERVAL_MS = 3000;
const HEARTBEAT_STALE_MS = 6000; // 2 intervalos de gracia

/**
 * Escribe un heartbeat periódico en localStorage.
 * Usar en el layout del dashboard para anunciar que la app Claims está activa.
 */
export function useClaimsAppHeartbeat(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const write = () => localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
    write();
    const id = setInterval(write, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);
}

/**
 * Verifica si la aplicación Claims está abierta en otra pestaña del mismo navegador.
 * Retorna true si detecta un heartbeat reciente.
 * Usar en la página del Magic Link para bloquear el acceso.
 */
export function useClaimsAppPresence(): { active: boolean; loading: boolean } {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      const raw = localStorage.getItem(HEARTBEAT_KEY);
      if (!raw) {
        setActive(false);
        setLoading(false);
        return;
      }
      const ts = Number(raw);
      if (Number.isNaN(ts)) {
        setActive(false);
        setLoading(false);
        return;
      }
      const age = Date.now() - ts;
      setActive(age < HEARTBEAT_STALE_MS);
      setLoading(false);
    };

    check();

    // Escuchar cambios en localStorage desde otras pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === HEARTBEAT_KEY) check();
    };
    window.addEventListener("storage", onStorage);

    // Re-verificar periódicamente (por si el heartbeat caduca mientras estamos abiertos)
    const id = setInterval(check, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  return { active, loading };
}
