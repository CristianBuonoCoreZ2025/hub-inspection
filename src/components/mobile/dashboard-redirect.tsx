"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMediaQuery } from "@/hooks/use-media-query";

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
  const { isMobile } = useMediaQuery();

  useEffect(() => {
    if (isLoading) return;
    if (!profile) return;
    if (!isMobile) return;

    const isInspector = profile.role === "inspector";
    const isInternal = profile.role === "internal" || !!dataAccess?.is_admin;

    if (isInspector || isInternal) {
      const pathname = window.location.pathname;
      // Evitar loop: no redirigir si ya estamos en /mobile
      if (pathname.startsWith("/mobile")) return;
      // No redirigir si el usuario eligio explicitamente el sistema tradicional.
      // Se guarda en localStorage para que la eleccion persista mientras navegue.
      if (typeof window !== "undefined" && localStorage.getItem("no-mobile-redirect") === "1") return;
      // No redirigir si está viendo el detalle de una inspección
      // (/dashboard/inspecciones/[id]) — el mobile no tiene equivalente
      // y el inspector necesita poder revisar la inspección desde el móvil
      if (/^\/dashboard\/inspecciones\/[^/]+/.test(pathname)) return;
      router.replace("/mobile");
    }
  }, [isLoading, profile, dataAccess, isMobile, router]);

  return null;
}
