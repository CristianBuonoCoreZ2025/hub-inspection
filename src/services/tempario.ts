import { fetchAll, fetchById, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  TemparioChapter,
  TemparioSubchapter,
  TemparioTask,
  TemparioPrice,
  TemparioTaskWithPrice,
} from "@/types";

// ═══════════════════════════════════════════════════════════════
// CHAPTERS (Capítulos DS27)
// ═══════════════════════════════════════════════════════════════

const CHAPTER_SELECT = "id, code, name, sort_order, is_active, created_at, updated_at";

export async function getTemparioChapters() {
  return fetchAll<TemparioChapter>("tempario_chapters", {
    select: CHAPTER_SELECT,
    order: { column: "sort_order", ascending: true },
  });
}

export async function getTemparioChapter(id: string) {
  return fetchById<TemparioChapter>("tempario_chapters", id, CHAPTER_SELECT);
}

export async function createTemparioChapter(input: { code: string; name: string; sort_order?: number }) {
  return insertRow<TemparioChapter>(
    "tempario_chapters",
    { ...input, sort_order: input.sort_order ?? 0, is_active: true },
    CHAPTER_SELECT,
  );
}

export async function updateTemparioChapter(id: string, input: Partial<{ code: string; name: string; sort_order: number; is_active: boolean }>) {
  return updateRow<TemparioChapter>("tempario_chapters", id, input, CHAPTER_SELECT);
}

export async function deleteTemparioChapter(id: string) {
  return updateTemparioChapter(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// SUBCHAPTERS (Subcapítulos DS27)
// ═══════════════════════════════════════════════════════════════

const SUBCHAPTER_SELECT = `
  id, chapter_id, code, name, sort_order, is_active, created_at, updated_at,
  chapter:tempario_chapters!tempario_subchapters_chapter_id_fkey(id, code, name)
`;

export async function getTemparioSubchapters(chapterId?: string) {
  const eq: Record<string, unknown> = { is_active: true };
  if (chapterId) eq.chapter_id = chapterId;
  return fetchAll<TemparioSubchapter>("tempario_subchapters", {
    select: SUBCHAPTER_SELECT,
    eq,
    order: { column: "sort_order", ascending: true },
  });
}

export async function getTemparioSubchapter(id: string) {
  return fetchById<TemparioSubchapter>("tempario_subchapters", id, SUBCHAPTER_SELECT);
}

export async function createTemparioSubchapter(input: { chapter_id: string; code: string; name: string; sort_order?: number }) {
  return insertRow<TemparioSubchapter>(
    "tempario_subchapters",
    { ...input, sort_order: input.sort_order ?? 0, is_active: true },
    SUBCHAPTER_SELECT,
  );
}

export async function updateTemparioSubchapter(id: string, input: Partial<{ chapter_id: string; code: string; name: string; sort_order: number; is_active: boolean }>) {
  return updateRow<TemparioSubchapter>("tempario_subchapters", id, input, SUBCHAPTER_SELECT);
}

export async function deleteTemparioSubchapter(id: string) {
  return updateTemparioSubchapter(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// TASKS (Partidas — independientes de región)
// ═══════════════════════════════════════════════════════════════

const TASK_SELECT = `
  id, chapter_id, subchapter_id, code, description, unit, crew_type, complexity,
  rendimiento, time_per_unit, category_sindical, source, source_ref, observations,
  is_active, created_at, updated_at,
  chapter:tempario_chapters!tempario_tasks_chapter_id_fkey(id, code, name),
  subchapter:tempario_subchapters!tempario_tasks_subchapter_id_fkey(id, code, name)
`;

export async function getTemparioTasks(filters?: { chapterId?: string; subchapterId?: string; onlyActive?: boolean }) {
  const eq: Record<string, unknown> = {};
  if (filters?.chapterId) eq.chapter_id = filters.chapterId;
  if (filters?.subchapterId) eq.subchapter_id = filters.subchapterId;
  if (filters?.onlyActive ?? true) eq.is_active = true;
  return fetchAll<TemparioTask>("tempario_tasks", {
    select: TASK_SELECT,
    eq,
    order: { column: "code", ascending: true },
  });
}

export async function getTemparioTask(id: string) {
  return fetchById<TemparioTask>("tempario_tasks", id, TASK_SELECT);
}

export async function createTemparioTask(input: {
  chapter_id: string;
  subchapter_id?: string | null;
  code: string;
  description: string;
  unit: string;
  crew_type?: string | null;
  complexity?: "facil" | "media" | "dificil";
  rendimiento: number;
  time_per_unit: number;
  category_sindical?: string | null;
  source?: string;
  source_ref?: string | null;
  observations?: string | null;
}) {
  return insertRow<TemparioTask>(
    "tempario_tasks",
    {
      ...input,
      subchapter_id: input.subchapter_id ?? null,
      complexity: input.complexity ?? "media",
      source: input.source ?? "MINVU DS27",
      is_active: true,
    },
    TASK_SELECT,
  );
}

export async function updateTemparioTask(id: string, input: Partial<{
  chapter_id: string;
  subchapter_id: string | null;
  code: string;
  description: string;
  unit: string;
  crew_type: string | null;
  complexity: "facil" | "media" | "dificil";
  rendimiento: number;
  time_per_unit: number;
  category_sindical: string | null;
  source: string;
  source_ref: string | null;
  observations: string | null;
  is_active: boolean;
}>) {
  return updateRow<TemparioTask>("tempario_tasks", id, input, TASK_SELECT);
}

export async function deleteTemparioTask(id: string) {
  return updateTemparioTask(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// PRICES (Precio por región × moneda × fecha)
// ═══════════════════════════════════════════════════════════════

const PRICE_SELECT = `
  id, task_id, region_id, currency_code, price, factor_zonal, effective_date,
  source, is_active, created_at, updated_at,
  task:tempario_tasks!tempario_prices_task_id_fkey(id, code, description, unit),
  region:regions!tempario_prices_region_id_fkey(id, code, name),
  currency:currencies!tempario_prices_currency_code_fkey(code, name, symbol)
`;

export async function getTemparioPrices(filters?: { taskId?: string; regionId?: string; currencyCode?: string; onlyActive?: boolean }) {
  const eq: Record<string, unknown> = {};
  if (filters?.taskId) eq.task_id = filters.taskId;
  if (filters?.regionId) eq.region_id = filters.regionId;
  if (filters?.currencyCode) eq.currency_code = filters.currencyCode;
  if (filters?.onlyActive ?? true) eq.is_active = true;
  return fetchAll<TemparioPrice>("tempario_prices", {
    select: PRICE_SELECT,
    eq,
    order: { column: "effective_date", ascending: false },
  });
}

export async function getTemparioPrice(id: string) {
  return fetchById<TemparioPrice>("tempario_prices", id, PRICE_SELECT);
}

export async function createTemparioPrice(input: {
  task_id: string;
  region_id: string;
  currency_code: string;
  price: number;
  factor_zonal?: number;
  effective_date: string;
  source?: string;
}) {
  // UPSERT: solo hay un precio vigente por (task_id, region_id, currency_code).
  // Si ya existe, se actualiza (no se crea histórico).
  const supabase = getSupabaseClient();
  const row = {
    ...input,
    factor_zonal: input.factor_zonal ?? 1.0,
    source: input.source ?? "MINVU DS27",
    is_active: true,
  };
  const { data, error } = await supabase
    .from("tempario_prices")
    .upsert(row, { onConflict: "task_id,region_id,currency_code" })
    .select(PRICE_SELECT)
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data as TemparioPrice;
}

export async function updateTemparioPrice(id: string, input: Partial<{
  task_id: string;
  region_id: string;
  currency_code: string;
  price: number;
  factor_zonal: number;
  effective_date: string;
  source: string;
  is_active: boolean;
}>) {
  return updateRow<TemparioPrice>("tempario_prices", id, input, PRICE_SELECT);
}

export async function deleteTemparioPrice(id: string) {
  return updateTemparioPrice(id, { is_active: false });
}

export async function hardDeleteTemparioPrice(id: string) {
  return deleteRow<TemparioPrice>("tempario_prices", id);
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Tasks con precio para una región + moneda específica
// (lo que usará el módulo de inspecciones en la fase 2)
// ═══════════════════════════════════════════════════════════════

export async function getTemparioTasksWithPrice(filters: {
  regionId?: string;
  currencyCode?: string;
  chapterId?: string;
  onlyActive?: boolean;
}): Promise<TemparioTaskWithPrice[]> {
  const tasks = await getTemparioTasks({
    chapterId: filters.chapterId,
    onlyActive: filters.onlyActive ?? true,
  });
  if (tasks.length === 0) return [];

  // Si no hay región/moneda, devolver tasks sin precio
  if (!filters.regionId || !filters.currencyCode) {
    return tasks.map((t) => ({ ...t }));
  }

  // El tempario guarda precios en la moneda original de la fuente (UF para DS27).
  // NO se hace conversión: el precio se muestra en la moneda en que se cargó.
  // Si se pide una moneda que no existe en tempario_prices, no se devuelve precio.
  const prices = await getTemparioPrices({
    regionId: filters.regionId,
    currencyCode: filters.currencyCode,
    onlyActive: filters.onlyActive ?? true,
  });

  // Indexar precios por task_id (el más reciente ya viene primero por el order)
  const priceByTask = new Map<string, TemparioPrice>();
  for (const p of prices) {
    if (!priceByTask.has(p.task_id)) priceByTask.set(p.task_id, p);
  }

  return tasks.map((t) => {
    const p = priceByTask.get(t.id);
    if (!p) {
      return {
        ...t,
        price_id: null,
        price: null,
        factor_zonal: null,
        currency_code: null,
        region_id: null,
        region_name: null,
        effective_date: null,
        price_source: null,
      };
    }
    return {
      ...t,
      price_id: p.id,
      price: p.price,
      factor_zonal: p.factor_zonal,
      currency_code: p.currency_code,
      region_id: p.region_id,
      region_name: p.region?.name ?? null,
      effective_date: p.effective_date,
      price_source: p.source,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// FILTROS: opciones derivadas de lo que realmente tiene tempario_prices
// Solo muestra países / regiones / monedas que tienen precios cargados.
// ═══════════════════════════════════════════════════════════════

export interface TemparioFilterOptions {
  countries: { id: string; code: string; name: string }[];
  regions: { id: string; country_id: string; code: string | null; name: string }[];
  // Monedas almacenadas (UF) + CLP (derivable en runtime desde UF)
  currencies: { code: string; name: string; symbol: string | null }[];
}

export async function getTemparioFilterOptions(): Promise<TemparioFilterOptions> {
  // Traer todos los precios activos con join a región y país
  const prices = await fetchAll<TemparioPrice & {
    region?: { id: string; country_id: string; code: string | null; name: string; country?: { id: string; code: string; name: string } } | null;
  }>("tempario_prices", {
    select: `
      id, region_id, currency_code,
      region:regions!tempario_prices_region_id_fkey(
        id, country_id, code, name,
        country:countries!regions_country_id_fkey(id, code, name)
      )
    `,
    eq: { is_active: true },
  });

  // Dedupar países
  const countryMap = new Map<string, { id: string; code: string; name: string }>();
  const regionMap = new Map<string, { id: string; country_id: string; code: string | null; name: string }>();
  const currencySet = new Set<string>();

  for (const p of prices) {
    if (p.region) {
      regionMap.set(p.region.id, {
        id: p.region.id,
        country_id: p.region.country_id,
        code: p.region.code,
        name: p.region.name,
      });
      if (p.region.country) {
        countryMap.set(p.region.country.id, p.region.country);
      }
    }
    if (p.currency_code) currencySet.add(p.currency_code);
  }

  // Monedas: solo las que están realmente almacenadas en tempario_prices.
  // NO se agrega CLP artificialmente — el tempario se muestra en la moneda
  // en que se cargó (UF para DS27). Sin conversiones.
  const currencyCodes = [...currencySet];

  // Traer metadata de las monedas (nombre, símbolo)
  const { fetchAll: fetchAllCurrencies } = await import("@/lib/supabase/db");
  const currencyRows = await fetchAllCurrencies<{ code: string; name: string; symbol: string | null }>("currencies", {
    select: "code, name, symbol",
    in: { code: currencyCodes },
  });
  const currencyByCode = new Map(currencyRows.map((c) => [c.code, c]));
  const currencies = currencyCodes
    .map((code) => currencyByCode.get(code))
    .filter((c): c is { code: string; name: string; symbol: string | null } => !!c)
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    countries: [...countryMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regionMap.values()].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "")),
    currencies,
  };
}

