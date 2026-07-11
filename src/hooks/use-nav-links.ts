"use client";

import { useAuth } from "@/hooks/use-auth";
import { mainLinks, catalogLinks, inspectionCatalogLinks, gestionCatalogLinks, operationLinks, adminLinks, navGroups, type NavLink, type NavGroup } from "@/components/layout/nav-data";

export function useNavLinks() {
  const { permissions } = useAuth();

  const canView = (section: string): boolean => {
    if (!permissions) return true; // mientras carga, mostrar todo
    const perm = permissions.find(p => p.section === section);
    return perm?.can_view ?? false;
  };

  const visibleMainLinks = mainLinks.filter(link => {
    const section = link.section;
    return section ? canView(section) : true;
  });

  const visibleCatalogLinks = canView("catalogos") ? catalogLinks : [];
  const visibleInspectionCatalogLinks = canView("catalogos_inspeccion") ? inspectionCatalogLinks : [];
  const visibleGestionCatalogLinks = canView("gestiones") ? gestionCatalogLinks : [];
  const visibleOperationLinks = canView("operaciones") ? operationLinks : [];
  const visibleAdminLinks = adminLinks.filter(link => {
    const section = link.section;
    return section ? canView(section) : true;
  });

  // Grupos visibles — buscar por section para no depender del orden
  const visibleGroups: (NavGroup & { visibleLinks: NavLink[] })[] = [];
  const groupBySection: Record<string, NavLink[]> = {
    catalogos: visibleCatalogLinks,
    catalogos_inspeccion: visibleInspectionCatalogLinks,
    gestiones: visibleGestionCatalogLinks,
    operaciones: visibleOperationLinks,
    administracion: visibleAdminLinks,
  };
  for (const g of navGroups) {
    const links = groupBySection[g.section];
    if (links && links.length > 0) {
      visibleGroups.push({ ...g, visibleLinks: links });
    }
  }

  return {
    visibleMainLinks,
    visibleCatalogLinks,
    visibleInspectionCatalogLinks,
    visibleGestionCatalogLinks,
    visibleOperationLinks,
    visibleAdminLinks,
    visibleGroups,
    canView,
  };
}
