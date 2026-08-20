"use client";

import { useEffect } from "react";

/**
 * Registra el service worker para habilitar PWA y offline.
 * Se monta en el mobile layout.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silencioso — el SW es opcional, la app funciona sin él
      }
    };

    register();
  }, []);

  return null;
}
