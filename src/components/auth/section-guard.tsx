"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { UserTypePermission } from "@/types";

interface SectionGuardProps {
  section: string;
  children: React.ReactNode;
}

/**
 * Resuelve el permiso para una sección, con fallback al padre.
 * Ej: "claims_detalle" → si no existe, busca "claims".
 * Ej: "catalogos_causas" → si no existe, busca "catalogos".
 */
function resolvePerm(permissions: UserTypePermission[] | undefined, section: string): UserTypePermission | undefined {
  if (!permissions) return undefined;
  // 1. Buscar permiso exacto
  const exact = permissions.find(p => p.section === section);
  if (exact) return exact;
  // 2. Fallback al padre (prefijo antes del primer "_")
  if (section.includes("_")) {
    const parentCandidates = [
      section.split("_")[0],
      section.split("_").slice(0, 2).join("_"),
    ];
    for (const parent of parentCandidates) {
      const parentPerm = permissions.find(p => p.section === parent);
      if (parentPerm) return parentPerm;
    }
  }
  return undefined;
}

/**
 * Guard que bloquea el acceso a una sección si el usuario no tiene permiso can_view.
 * Redirige al dashboard si no tiene permiso.
 * Soporta sub-secciones con fallback al módulo padre.
 */
export function SectionGuard({ section, children }: SectionGuardProps) {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !permissions) return;
    const perm = resolvePerm(permissions, section);
    if (!perm?.can_view) {
      router.replace("/dashboard");
    }
  }, [permissions, isLoading, section, router]);

  if (isLoading || !permissions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const perm = resolvePerm(permissions, section);
  if (!perm?.can_view) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
