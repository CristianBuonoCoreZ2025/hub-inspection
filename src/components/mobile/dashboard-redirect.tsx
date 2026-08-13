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
      // Evitar loop: no redirigir si ya estamos en /mobile
      if (window.location.pathname.startsWith("/mobile")) return;
      router.replace("/mobile");
    }
  }, [isLoading, profile, dataAccess, isMobile, router]);

  return null;
}
