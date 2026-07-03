"use client";

import { useAuth } from "@/hooks/use-auth";

/**
 * Hook para verificar permisos del usuario actual.
 * Usa los permisos cargados por useAuth.
 *
 * Soporta sub-secciones: si se consulta "catalogos_causas" y no existe
 * como permiso individual, hace fallback al módulo padre "catalogos".
 */
export function usePermissions() {
  const { permissions, profile, isLoading } = useAuth();

  /**
   * Resuelve el permiso para una sección, con fallback al padre.
   * Ej: "catalogos_causas" → si no existe, busca "catalogos".
   */
  const resolvePerm = (section: string) => {
    if (!permissions) return undefined;
    // 1. Buscar permiso exacto de la sección
    const exact = permissions.find(p => p.section === section);
    if (exact) return exact;
    // 2. Si es sub-sección (contiene "_"), buscar el padre
    if (section.includes("_")) {
      // Probar prefijos conocidos: catalogos_*, operaciones_*
      const parentCandidates = [
        section.split("_")[0], // "catalogos_causas" → "catalogos"
        section.split("_").slice(0, 2).join("_"), // "catalogos_inspeccion_muros" → "catalogos_inspeccion"
      ];
      for (const parent of parentCandidates) {
        const parentPerm = permissions.find(p => p.section === parent);
        if (parentPerm) return parentPerm;
      }
    }
    return undefined;
  };

  const can = (section: string, action: "view" | "edit" | "create" | "delete"): boolean => {
    if (!permissions) return true; // mientras carga, permitir
    const perm = resolvePerm(section);
    if (!perm) return false;
    switch (action) {
      case "view": return perm.can_view;
      case "edit": return perm.can_edit;
      case "create": return perm.can_create;
      case "delete": return perm.can_delete;
      default: return false;
    }
  };

  const canView = (section: string): boolean => can(section, "view");
  const canEdit = (section: string): boolean => can(section, "edit");
  const canCreate = (section: string): boolean => can(section, "create");
  const canDelete = (section: string): boolean => can(section, "delete");

  return {
    permissions,
    profile,
    isLoading,
    can,
    canView,
    canEdit,
    canCreate,
    canDelete,
  };
}
