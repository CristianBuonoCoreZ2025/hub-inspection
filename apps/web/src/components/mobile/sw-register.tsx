"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Registra el service worker para habilitar PWA y offline.
 * Se monta en el mobile layout.
 * Auto-actualiza el SW cuando hay una nueva versión.
 */
export function ServiceWorkerRegister() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      setStatus("error");
      return;
    }

    const register = async () => {
      try {
        // Limpiar SW de desarrollo viejo que pueda estar registrado
        // (bug previo: sw-dev.js se registraba en producción)
        if (process.env.NODE_ENV !== "development") {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) {
            const scriptURL = r.active?.scriptURL ?? "";
            if (scriptURL.includes("sw-dev.js")) {
              await r.unregister();
            }
          }
        }

        // En producción usar el SW generado por Serwist (sw.js).
        // En desarrollo usar el SW de desarrollo (sw-dev.js).
        const swFile = process.env.NODE_ENV === "development" ? "/sw-dev.js" : "/sw.js";
        const reg = await navigator.serviceWorker.register(swFile, { scope: "/" });

        // Escuchar actualizaciones del SW
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Nueva versión disponible — forzar activación
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });

        // Forzar verificación de actualización
        reg.update();

        // Si ya hay un SW controlando la página, está listo
        if (navigator.serviceWorker.controller) {
          setStatus("ready");
        } else {
          // Esperar a que el SW tome control
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            setStatus("ready");
          });
          // Timeout: si no toma control en 3s, igual marcar como ready
          setTimeout(() => setStatus("ready"), 3000);
        }
      } catch {
        setStatus("error");
      }
    };

    register();
  }, []);

  // Solo mostrar el indicador en dev
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-1 right-1 z-50 pointer-events-none">
      {status === "ready" && (
        <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-2.5 w-2.5" />
          SW
        </div>
      )}
      {status === "loading" && (
        <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          SW...
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-2.5 w-2.5" />
          SW off
        </div>
      )}
    </div>
  );
}
