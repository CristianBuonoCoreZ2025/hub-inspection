"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Monitor, ClipboardCheck, ArrowRight } from "lucide-react";

/**
 * Pantalla de elección del modo de trabajo en mobile.
 *
 * Se muestra cuando un inspector o internal se loguea desde móvil/tablet.
 * Ofrece dos opciones:
 * 1. Sistema tradicional — dashboard responsive
 * 2. Inspección mobile — módulo de inspección adaptado
 *
 * La elección se guarda en localStorage para no preguntar cada vez.
 */
export default function MobileChoicePage() {
  const router = useRouter();
  const { profile, isLoading } = useAuth();
  // Inicializar desde localStorage. Si ya hay preferencia, redirigir.
  // En SSR localStorage no existe, por eso se usa lazy initializer con guard.
  const [savedMode] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("mobile-mode");
  });

  // Respetar la preferencia guardada: si ya eligió un modo, redirigir automáticamente.
  useEffect(() => {
    if (isLoading) return;
    if (savedMode === "traditional") {
      router.replace("/dashboard");
      return;
    }
    if (savedMode === "inspection") {
      router.replace("/mobile/inspecciones");
      return;
    }
  }, [isLoading, savedMode, router]);

  const handleChoice = (mode: "traditional" | "inspection") => {
    localStorage.setItem("mobile-mode", mode);
    if (mode === "traditional") {
      router.push("/dashboard");
    } else {
      router.push("/mobile/inspecciones");
    }
  };

  // Mientras verificamos la preferencia o estamos redirigiendo, no mostramos la pantalla.
  if (savedMode === "traditional" || savedMode === "inspection") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ClipboardCheck className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / título */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <ClipboardCheck className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Hub Inspection</h1>
          <p className="text-sm text-muted-foreground">
            Hola, {profile?.full_name?.split(" ")[0] || "Inspector"}
          </p>
        </div>

        {/* Pregunta */}
        <div className="space-y-3">
          <p className="text-center text-sm font-medium text-muted-foreground">
            ¿Cómo quieres trabajar?
          </p>

          {/* Opción: Inspección mobile */}
          <button
            onClick={() => handleChoice("inspection")}
            className="mobile-choice-card"
          >
            <div className="flex items-center gap-3">
              <div className="mobile-choice-icon bg-primary/10 text-primary">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Inspección mobile</p>
                <p className="text-xs text-muted-foreground">
                  Módulo de inspección optimizado para campo
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>

          {/* Opción: Sistema tradicional */}
          <button
            onClick={() => handleChoice("traditional")}
            className="mobile-choice-card"
          >
            <div className="flex items-center gap-3">
              <div className="mobile-choice-icon bg-muted text-muted-foreground">
                <Monitor className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm">Sistema tradicional</p>
                <p className="text-xs text-muted-foreground">
                  Dashboard adaptado a tu pantalla
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Nota */}
        <p className="text-center text-xs text-muted-foreground">
          Puedes cambiar de modo con el botón <Monitor className="inline h-3 w-3" /> en el header
        </p>
      </div>
    </div>
  );
}
