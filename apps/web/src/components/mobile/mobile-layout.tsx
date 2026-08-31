"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, LogOut, ArrowLeft, RefreshCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/mobile/sw-register";
import { OfflineBanner } from "@/components/mobile/offline-banner";

/**
 * Layout del módulo mobile.
 *
 * Verifica:
 * 1. Que el usuario esté autenticado.
 * 2. Que el dispositivo sea móvil/tablet (si es desktop, redirige a /dashboard).
 * 3. Que el usuario tenga rol inspector o internal (si no, redirige a /dashboard).
 *
 * Header minimal: logo + botón volver + cerrar sesión.
 * No incluye navegación del dashboard tradicional.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, dataAccess, isLoading, signOut } = useAuth();
  const { isMobile } = useMediaQuery();

  const isInspector = profile?.role === "inspector";
  const isInternal = profile?.role === "internal" || !!dataAccess?.is_admin;

  // Redirect si no hay sesión (user null = no session, no profile null = still loading)
  // Nota: usar !user en lugar de !profile para evitar race condition:
  // cuando isLoading=false pero el profile query aún no completó, profile es undefined.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Si es desktop, redirigir al dashboard normal
  useEffect(() => {
    if (!isLoading && profile && !isMobile) {
      router.replace("/dashboard");
    }
  }, [isLoading, profile, isMobile, router]);

  // Si no es inspector ni internal, redirigir al dashboard
  useEffect(() => {
    if (!isLoading && profile && isMobile && !isInspector && !isInternal) {
      router.replace("/dashboard");
    }
  }, [isLoading, profile, isMobile, isInspector, isInternal, router]);

  if (isLoading || (user && !profile)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const handleSignOut = async () => {
    await signOut();
  };

  const isInspectionList = pathname === "/mobile/inspecciones";

  return (
    <div className="mobile-skin flex h-dvh flex-col bg-background">
      <ServiceWorkerRegister />
      <OfflineBanner />
      {/* Header minimal */}
      <header className="flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          {!isInspectionList && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => router.push("/mobile/inspecciones")}
              aria-label="Volver a lista de inspecciones"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Inspecciones</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleSignOut}
                aria-label="Cerrar sesión"
              />
            }>
              <LogOut className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Cerrar sesión</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto overscroll-contain mobile-safe-bottom">
        {children}
      </main>
    </div>
  );
}
