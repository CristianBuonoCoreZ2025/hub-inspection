import { getSupabaseClient, fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

export interface CoverageCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  theme: string;
  country_id: string | null;
  is_active: boolean;
  sort_order: number;
  document_url: string | null;
  subcoverage_count?: number;
}

export interface SubcoverageCatalogItem {
  id: string;
  coverage_catalog_id: string | null;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  document_url: string | null;
}

// Construye la URL de búsqueda en la CMF desde el código POL/CAD
// Lleva a la página de resultados donde se puede ver y descargar el documento
export function buildCmfUrl(code: string): string {
  const poliza = encodeURIComponent(code.trim());
  return `https://www.cmfchile.cl/institucional/inc/seguros_deposito_consulta2.php?poliza=${poliza}&dd=%23&mm=%23&aa=%23&dd2=%23%23%23&mm2=%23%23%23&aa2=%23%23%23&norma=ALL&texto=&tema=ALL`;
}

// ═══════════════════════════════════════════════════════════════
// Coverage Catalog
// ═══════════════════════════════════════════════════════════════

const COVERAGE_FIELDS =
  "id, code, name, description, theme, country_id, is_active, sort_order, document_url";

const SUBCOVERAGE_FIELDS =
  "id, coverage_catalog_id, code, name, description, is_active, sort_order, document_url";

/**
 * Helper: obtiene el conteo de subcoberturas activas por coverage_catalog_id.
 * Más resiliente que subcoverage_catalog_aggregate (no requiere relationship trackeada).
 */
async function getSubcoverageCounts(coverageIds: string[]): Promise<Record<string, number>> {
  if (coverageIds.length === 0) return {};
  try {
    const subs = await getSubcoveragesByCoverageIds(coverageIds);
    const counts: Record<string, number> = {};
    for (const s of subs) {
      const parentId = s.coverage_catalog_id;
      if (parentId) counts[parentId] = (counts[parentId] || 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export async function getCoverageCatalog(countryId?: string): Promise<CoverageCatalogItem[]> {
  const options: Parameters<typeof fetchAll>[1] = {
    select: COVERAGE_FIELDS,
    eq: { is_active: true },
  };
  if (countryId) {
    options.eq = { ...options.eq, country_id: countryId };
  }
  const rows = await fetchAll<Omit<CoverageCatalogItem, "subcoverage_count">>("coverage_catalog", options);

  // Sort by theme, sort_order, name (multi-column)
  rows.sort((a, b) => {
    if (a.theme !== b.theme) return a.theme.localeCompare(b.theme);
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });

  const counts = await getSubcoverageCounts(rows.map((c) => c.id));

  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    theme: c.theme,
    country_id: c.country_id,
    is_active: c.is_active,
    sort_order: c.sort_order,
    document_url: c.document_url || buildCmfUrl(c.code),
    subcoverage_count: counts[c.id] ?? 0,
  }));
}

export async function getCoverageCatalogByTheme(theme: string, countryId?: string): Promise<CoverageCatalogItem[]> {
  const options: Parameters<typeof fetchAll>[1] = {
    select: COVERAGE_FIELDS,
    eq: { is_active: true, theme },
  };
  if (countryId) {
    options.eq = { ...options.eq, country_id: countryId };
  }
  const rows = await fetchAll<Omit<CoverageCatalogItem, "subcoverage_count">>("coverage_catalog", options);

  // Sort by sort_order, name (multi-column)
  rows.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });

  const counts = await getSubcoverageCounts(rows.map((c) => c.id));

  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    theme: c.theme,
    country_id: c.country_id,
    is_active: c.is_active,
    sort_order: c.sort_order,
    document_url: c.document_url || buildCmfUrl(c.code),
    subcoverage_count: counts[c.id] ?? 0,
  }));
}

export async function getCoverageThemes(countryId?: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("coverage_catalog")
    .select("theme")
    .eq("is_active", true);
  if (countryId) {
    query = query.eq("country_id", countryId);
  }
  const { data, error } = await query.order("theme", { ascending: true });
  if (error) throw new Error(error.message);
  // distinct themes
  const themes = (data ?? []).map((r: { theme: string }) => r.theme) as string[];
  return [...new Set(themes)];
}

export async function createCoverageCatalog(input: {
  code: string;
  name: string;
  description?: string;
  theme: string;
  country_id?: string;
}): Promise<CoverageCatalogItem> {
  return insertRow<CoverageCatalogItem>("coverage_catalog", {
    code: input.code,
    name: input.name,
    description: input.description || null,
    theme: input.theme,
    country_id: input.country_id || null,
    is_active: true,
  }, "id, code, name, description, theme, country_id, is_active, sort_order");
}

export async function updateCoverageCatalog(id: string, input: {
  code?: string;
  name?: string;
  description?: string;
  theme?: string;
  is_active?: boolean;
}): Promise<CoverageCatalogItem> {
  return updateRow<CoverageCatalogItem>("coverage_catalog", id, input, "id, code, name, description, theme, is_active, sort_order");
}

export async function deactivateCoverageCatalog(id: string): Promise<void> {
  await updateCoverageCatalog(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// Subcoverage Catalog
// ═══════════════════════════════════════════════════════════════

export async function getSubcoveragesByCoverageId(coverageCatalogId: string): Promise<SubcoverageCatalogItem[]> {
  const rows = await fetchAll<SubcoverageCatalogItem>("subcoverage_catalog", {
    select: SUBCOVERAGE_FIELDS,
    eq: { coverage_catalog_id: coverageCatalogId, is_active: true },
  });
  // Sort by sort_order, name (multi-column)
  rows.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
  return rows.map((s) => ({ ...s, document_url: s.document_url || buildCmfUrl(s.code) }));
}

export async function getAllSubcoverages(): Promise<SubcoverageCatalogItem[]> {
  const rows = await fetchAll<SubcoverageCatalogItem>("subcoverage_catalog", {
    select: SUBCOVERAGE_FIELDS,
    eq: { is_active: true },
  });
  // Sort by sort_order, name (multi-column)
  rows.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
  return rows.map((s) => ({ ...s, document_url: s.document_url || buildCmfUrl(s.code) }));
}

export async function getSubcoveragesByCoverageIds(coverageIds: string[]): Promise<SubcoverageCatalogItem[]> {
  if (coverageIds.length === 0) return [];
  const rows = await fetchAll<SubcoverageCatalogItem>("subcoverage_catalog", {
    select: SUBCOVERAGE_FIELDS,
    eq: { is_active: true },
    in: { coverage_catalog_id: coverageIds },
  });
  // Sort by sort_order, name (multi-column)
  rows.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
  return rows.map((s) => ({ ...s, document_url: s.document_url || buildCmfUrl(s.code) }));
}

export async function createSubcoverageCatalog(input: {
  coverage_catalog_id: string;
  code: string;
  name: string;
  description?: string;
}): Promise<SubcoverageCatalogItem> {
  return insertRow<SubcoverageCatalogItem>("subcoverage_catalog", {
    coverage_catalog_id: input.coverage_catalog_id,
    code: input.code,
    name: input.name,
    description: input.description || null,
    is_active: true,
  }, "id, coverage_catalog_id, code, name, description, is_active, sort_order");
}

export async function updateSubcoverageCatalog(id: string, input: {
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}): Promise<SubcoverageCatalogItem> {
  return updateRow<SubcoverageCatalogItem>("subcoverage_catalog", id, input, "id, coverage_catalog_id, code, name, description, is_active, sort_order");
}

export async function deactivateSubcoverageCatalog(id: string): Promise<void> {
  await updateSubcoverageCatalog(id, { is_active: false });
}
