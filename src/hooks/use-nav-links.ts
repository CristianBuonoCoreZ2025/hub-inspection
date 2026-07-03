"use client";

import { useAuth } from "@/hooks/use-auth";
import { mainLinks, catalogLinks, inspectionCatalogLinks, operationLinks, adminLinks, navGroups, type NavLink, type NavGroup } from "@/components/layout/nav-data";

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
  const visibleOperationLinks = canView("operaciones") ? operationLinks : [];
  const visibleAdminLinks = adminLinks.filter(link => {
    const section = link.section;
    return section ? canView(section) : true;
  });

  // Grupos visibles
  const visibleGroups: (NavGroup & { visibleLinks: NavLink[] })[] = [];
  if (visibleCatalogLinks.length > 0) {
    visibleGroups.push({ ...navGroups[0], visibleLinks: visibleCatalogLinks });
  }
  if (visibleInspectionCatalogLinks.length > 0) {
    visibleGroups.push({ ...navGroups[1], visibleLinks: visibleInspectionCatalogLinks });
  }
  if (visibleOperationLinks.length > 0) {
    visibleGroups.push({ ...navGroups[2], visibleLinks: visibleOperationLinks });
  }
  if (visibleAdminLinks.length > 0) {
    visibleGroups.push({ ...navGroups[3], visibleLinks: visibleAdminLinks });
  }

  return {
    visibleMainLinks,
    visibleCatalogLinks,
    visibleInspectionCatalogLinks,
    visibleOperationLinks,
    visibleAdminLinks,
    visibleGroups,
    canView,
  };
}
