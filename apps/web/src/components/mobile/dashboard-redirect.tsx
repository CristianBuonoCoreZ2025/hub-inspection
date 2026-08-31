"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDeviceType } from "@/hooks/use-device-type";

/**
 * Si el usuario es inspector/internal y accede al dashboard desde móvil,
 * redirige automáticamente a /mobile (pantalla de elección).
 *
 * Esto se monta en el layout del dashboard (client-side) para capturar
 * cualquier acceso directo a /dashboard desde un dispositivo móvil.
 */
export function DashboardMobileRedirect() {
  const router = useRouter();
  const { profile, dataAccess, isLoading } = useAuth();
  const deviceType = useDeviceType();
  const isMobileDevice = deviceType === "mobile";

  useEffect(() => {
    if (isLoading) return;
    if (!profile) return;
    if (!isMobileDevice) return;

    const isInspector = profile.role === "inspector";
    const isInternal = profile.role === "internal" || !!dataAccess?.is_admin;

    if (isInspector || isInternal) {
      const pathname = window.location.pathname;
      // Evitar loop: no redirigir si ya estamos en /mobile/inspecciones
      if (pathname.startsWith("/mobile/inspecciones")) return;
      // No redirigir si está viendo el detalle de una inspección
      // (/dashboard/inspecciones/[id]) — el mobile no tiene equivalente
      // y el inspector necesita poder revisar la inspección desde el móvil
      if (/^\/dashboard\/inspecciones\/[^/]+/.test(pathname)) return;
      // Limpiar flag legacy (ya no existe el botón "Sistema tradicional")
      if (typeof window !== "undefined") localStorage.removeItem("no-mobile-redirect");
      router.replace("/mobile/inspecciones");
    }
  }, [isLoading, profile, dataAccess, isMobileDevice, router]);

  return null;
}
