"use client";

import { WifiOff, Wifi } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

/**
 * Banner que indica el estado de conexión.
 * Se muestra arriba de todo en el módulo mobile.
 */
export function OfflineBanner() {
  const online = useOnline();

  if (online) return null;

  return (
    <div className="offline-banner">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Sin conexión — Modo offline</span>
    </div>
  );
}

/**
 * Indicador pequeño de estado de conexión (para headers).
 */
export function ConnectionIndicator() {
  const online = useOnline();

  return (
    <div className={`connection-indicator ${online ? "online" : "offline"}`}>
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      <span>{online ? "En línea" : "Offline"}</span>
    </div>
  );
}
