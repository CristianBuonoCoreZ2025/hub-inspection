import { fetchAll } from "@/lib/supabase/db";

// ═══════════════════════════════════════════════════════════════
// Servicio para la configuración del menú lateral de navegación.
// Tabla singleton (id=1) con un JSON que define la estructura.
//
// Lectura: usa el cliente Supabase normal (RLS permite SELECT a todos).
// Escritura: usa API route con service role (bypass RLS) porque el
// usuario actual puede no tener rol 'internal' pero igual tiene
// permisos de admin via el sistema de permisos de la app.
// ═══════════════════════════════════════════════════════════════

/**
 * Un item del menú en la configuración.
 * - type "link": item individual, key = href (ej: "/dashboard/claims")
 * - type "group": grupo con submenu, key = section (ej: "catalogos")
 *   children = lista de items anidados
 * - label (opcional): nombre custom que sobreescribe el default de nav-data.ts.
 *   Solo se usa para grupos (los links mantienen su label original).
 */
export interface NavMenuItem {
  type: "link" | "group";
  key: string;
  label?: string;
  children?: NavMenuItem[];
}

export interface NavMenuConfig {
  items: NavMenuItem[];
}

interface NavMenuConfigRow {
  id: number;
  config: NavMenuConfig | Record<string, never>;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Lee la configuración del menú. Si no hay items definidos
 * (config vacía), retorna null — el caller debe usar el fallback
 * hardcoded de nav-data.ts.
 */
export async function getNavMenuConfig(): Promise<NavMenuConfig | null> {
  const rows = await fetchAll<NavMenuConfigRow>("nav_menu_config", {
    select: "id, config, updated_at, updated_by",
    eq: { id: 1 },
    limit: 1,
  });
  const row = rows[0];
  if (!row) return null;
  const config = row.config as NavMenuConfig;
  if (!config || !Array.isArray(config.items) || config.items.length === 0) {
    return null;
  }
  return config;
}

/**
 * Guarda la configuración del menú via API route con service role.
 * Bypass RLS porque el control de acceso se hace en el frontend
 * (usePermissions + SectionGuard section="configuracion").
 */
export async function saveNavMenuConfig(config: NavMenuConfig): Promise<void> {
  const res = await fetch("/api/nav-menu-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: config.items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error al guardar menú" }));
    throw new Error(err.error || "Error al guardar menú");
  }
}
