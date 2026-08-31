"use client";

import { useSyncExternalStore } from "react";

export type DeviceType = "mobile" | "desktop";

/**
 * Detecta si el dispositivo es móvil o desktop basado en el User-Agent.
 *
 * - Móvil: Android, iPhone, iPad, iPod (sin importar resolución de pantalla)
 * - Desktop: Windows, Mac, Linux, otros
 *
 * Esto resuelve el problema de equipos desktop con resolución baja
 * que eran detectados como móvil por el ancho de pantalla.
 */
export function useDeviceType(): DeviceType {
  return useSyncExternalStore(
    subscribe,
    getDeviceSnapshot,
    getServerSnapshot
  );
}

function subscribe(callback: () => void): () => void {
  // El User-Agent no cambia en runtime, pero nos suscribimos a resize
  // por si la página cambia de orientación (no afecta el device type)
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getDeviceSnapshot(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  return detectDeviceType(navigator.userAgent);
}

function getServerSnapshot(): DeviceType {
  return "desktop";
}

/**
 * Detecta el tipo de dispositivo desde un User-Agent string.
 *
 * Móvil: Android (excluyendo "Android Tablet" o "Chromebook"), iPhone, iPad, iPod
 * Desktop: Windows, Macintosh, Linux, Chrome OS, otros
 *
 * Nota: iPad con iPadOS 13+ reporta "Macintosh" en el User-Agent,
 * pero también incluye "iPad" o se puede detectar por touch + Mac.
 */
export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  // iOS: iPhone, iPod
  if (ua.includes("iphone") || ua.includes("ipod")) {
    return "mobile";
  }

  // iPad: iPadOS 13+ reporta como Macintosh, pero tiene "Macintosh" + "Safari"
  // y soporta touch. Detectar por "ipad" explícito o por "Macintosh" + maxTouchPoints > 1
  if (ua.includes("ipad")) {
    return "mobile";
  }

  // iPad con iPadOS 13+: el UA dice "Macintosh" pero es un iPad
  // Se detecta en el cliente con navigator.maxTouchPoints
  if (typeof navigator !== "undefined" && ua.includes("macintosh")) {
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    if (maxTouchPoints > 1) {
      return "mobile";
    }
  }

  // Android: móvil (excluye tablets con "tablet" en UA, pero la mayoría
  // de tablets Android también son móviles para nuestra app)
  if (ua.includes("android")) {
    return "mobile";
  }

  // Desktop: Windows, Mac, Linux, Chrome OS, etc.
  return "desktop";
}

/**
 * Versión sin hook para usar en server-side o fuera de React.
 * Útil para middleware o server components.
 */
export function getDeviceTypeFromUA(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();

  if (ua.includes("iphone") || ua.includes("ipod") || ua.includes("ipad")) {
    return "mobile";
  }
  if (ua.includes("android")) {
    return "mobile";
  }
  // iPad con iPadOS 13+: server-side no puede detectar maxTouchPoints
  // pero el UA de iPad dice "Macintosh" - no podemos distinguir de Mac real
  // sin maxTouchPoints. En server-side, tratamos Macintosh como desktop.
  return "desktop";
}
