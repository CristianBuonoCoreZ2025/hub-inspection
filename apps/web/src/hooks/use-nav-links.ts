"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  mainLinks,
  catalogLinks,
  inspectionCatalogLinks,
  gestionCatalogLinks,
  operationLinks,
  adminLinks,
  navGroups,
  type NavLink,
  type NavGroup,
  type VisibleNavGroup,
  type VisibleNavSubgroup,
  type VisibleNavChild,
} from "@/components/layout/nav-data";
import { getNavMenuConfig, type NavMenuItem } from "@/services/nav-menu-config";

export function useNavLinks(isMobile = false) {
  const { permissions } = useAuth();

  // Cargar configuración del menú desde la BD.
  // Si es null o falla, se usa el orden hardcoded de nav-data.ts.
  const { data: menuConfig } = useQuery({
    queryKey: ["nav-menu-config"],
    queryFn: getNavMenuConfig,
    staleTime: 60_000, // 1 minuto — la config cambia raramente
  });

  const canView = (section: string): boolean => {
    if (!permissions) return true; // mientras carga, mostrar todo
    const perm = permissions.find(p => p.section === section);
    return perm?.can_view ?? false;
  };

  // ── Mapas de todos los items disponibles por clave ──
  const linkByHref = new Map<string, NavLink>();
  for (const l of mainLinks) linkByHref.set(l.href, l);
  for (const l of catalogLinks) linkByHref.set(l.href, l);
  for (const l of inspectionCatalogLinks) linkByHref.set(l.href, l);
  for (const l of gestionCatalogLinks) linkByHref.set(l.href, l);
  for (const l of operationLinks) linkByHref.set(l.href, l);
  for (const l of adminLinks) linkByHref.set(l.href, l);

  const groupBySection = new Map<string, NavGroup>();
  for (const g of navGroups) groupBySection.set(g.section, g);

  // ── Filtrar por permisos ──
  const isLinkVisible = (link: NavLink): boolean => {
    if (isMobile && link.hideOnMobile) return false;
    const section = link.section;
    if (!section) {
      if (link.href.startsWith("/dashboard/catalogos/inspeccion")) return canView("catalogos_inspeccion");
      if (link.href.startsWith("/dashboard/catalogos/gestiones")) return canView("catalogos_gestiones");
      if (link.href.startsWith("/dashboard/catalogos/pantallas")) return canView("catalogos_gestiones");
      if (link.href.startsWith("/dashboard/catalogos/workflows")) return canView("catalogos_gestiones");
      if (link.href.startsWith("/dashboard/catalogos")) return canView("catalogos");
      if (link.href.startsWith("/dashboard/operaciones")) return canView("operaciones");
      return true;
    }
    return canView(section);
  };

  const isGroupVisible = (section: string, hideOnMobile?: boolean): boolean => {
    if (isMobile && hideOnMobile) return false;
    return canView(section);
  };

  // ── Construir resultado ──
  const visibleMainLinks: NavLink[] = [];
  const visibleGroups: VisibleNavGroup[] = [];
  const usedKeys = new Set<string>();

  // Procesar un item de la config recursivamente
  // depth 0 = raíz, depth 1 = dentro de grupo (puede ser subgrupo o link)
  const processLink = (item: NavMenuItem): NavLink | null => {
    if (usedKeys.has(`link:${item.key}`)) return null;
    usedKeys.add(`link:${item.key}`);
    const link = linkByHref.get(item.key);
    if (!link || !isLinkVisible(link)) return null;
    const customLabel = item.label?.trim();
    if (customLabel) return { ...link, label: customLabel };
    return link;
  };

  const processGroup = (item: NavMenuItem, depth: number): VisibleNavGroup | VisibleNavSubgroup | null => {
    if (usedKeys.has(`group:${item.key}`)) return null;
    usedKeys.add(`group:${item.key}`);
    const group = groupBySection.get(item.key);
    if (!group || !isGroupVisible(group.section, group.hideOnMobile)) return null;

    const title = item.label?.trim() || group.title;

    // Children interleaved: links y subgrupos en el orden de la config
    const children: VisibleNavChild[] = [];
    // Para subgrupos (depth=1): solo links, no sub-subgrupos
    const subgroupLinks: NavLink[] = [];

    if (Array.isArray(item.children)) {
      for (const child of item.children) {
        if (child.type === "link") {
          const link = processLink(child);
          if (!link) continue;
          if (depth === 0) {
            children.push({ kind: "link", link });
          } else {
            subgroupLinks.push(link);
          }
        } else if (child.type === "group" && depth === 0) {
          // Subgrupo: solo a depth 0→1 (no más profundo)
          const subgroup = processGroup(child, depth + 1);
          if (subgroup && !("children" in subgroup)) {
            // processGroup a depth 1 retorna VisibleNavSubgroup (sin children)
            children.push({ kind: "subgroup", subgroup: subgroup as VisibleNavSubgroup });
          }
        }
      }
    }

    if (depth === 0) {
      if (children.length === 0) return null;
      return { title, section: group.section, icon: group.icon, children };
    } else {
      if (subgroupLinks.length === 0) return null;
      return { title, section: group.section, icon: group.icon, visibleLinks: subgroupLinks };
    }
  };

  if (menuConfig && Array.isArray(menuConfig.items) && menuConfig.items.length > 0) {
    for (const item of menuConfig.items) {
      if (item.type === "link") {
        const link = processLink(item);
        if (link) visibleMainLinks.push(link);
      } else if (item.type === "group") {
        const group = processGroup(item, 0);
        if (group && "children" in group) {
          visibleGroups.push(group);
        }
      }
    }

    // Fallback: items de nav-data que no están en la config
    for (const l of mainLinks) {
      if (!usedKeys.has(`link:${l.href}`) && isLinkVisible(l)) {
        visibleMainLinks.push(l);
        usedKeys.add(`link:${l.href}`);
      }
    }
    for (const g of navGroups) {
      if (!isGroupVisible(g.section, g.hideOnMobile)) continue;
      // Links de este grupo que no fueron procesados por la config
      const missingLinks = g.links.filter(l => !usedKeys.has(`link:${l.href}`) && isLinkVisible(l));
      if (missingLinks.length === 0) continue;

      if (usedKeys.has(`group:${g.section}`)) {
        // El grupo ya está procesado: inyectar links faltantes al final.
        // Puede ser un grupo top-level (en visibleGroups) o un subgrupo
        // anidado dentro de los children de otro grupo.
        const existing = visibleGroups.find(vg => vg.section === g.section);
        if (existing) {
          for (const link of missingLinks) {
            existing.children.push({ kind: "link", link });
            usedKeys.add(`link:${link.href}`);
          }
        } else {
          // Buscar el subgrupo dentro de los children de algún grupo top-level
          for (const vg of visibleGroups) {
            const subIdx = vg.children.findIndex(c => c.kind === "subgroup" && c.subgroup.section === g.section);
            if (subIdx >= 0) {
              const sub = vg.children[subIdx];
              if (sub.kind === "subgroup") {
                for (const link of missingLinks) {
                  sub.subgroup.visibleLinks.push(link);
                  usedKeys.add(`link:${link.href}`);
                }
              }
              break;
            }
          }
        }
      } else {
        // El grupo no está en la config: crearlo con los links faltantes
        const children: VisibleNavChild[] = missingLinks.map(link => ({ kind: "link", link }));
        visibleGroups.push({ title: g.title, section: g.section, icon: g.icon, children });
        usedKeys.add(`group:${g.section}`);
        for (const link of missingLinks) usedKeys.add(`link:${link.href}`);
      }
    }
  } else {
    // Sin config: usar el orden hardcoded de nav-data.ts
    for (const l of mainLinks) {
      if (isLinkVisible(l)) visibleMainLinks.push(l);
    }
    for (const g of navGroups) {
      if (!isGroupVisible(g.section, g.hideOnMobile)) continue;
      const childLinks = g.links.filter(isLinkVisible);
      if (childLinks.length > 0) {
        const children: VisibleNavChild[] = childLinks.map(link => ({ kind: "link", link }));
        visibleGroups.push({ title: g.title, section: g.section, icon: g.icon, children });
      }
    }
  }

  return {
    visibleMainLinks,
    visibleGroups,
    canView,
  };
}
