import { fetchAll } from "@/lib/supabase/db";

const CACHE_MS = 60_000; // cachear 1 minuto en memoria
const cache: Record<string, { value: string; expires: number }> = {};

/**
 * Obtiene un setting del sistema por key.
 * Usa cache en memoria para no golpear Supabase en cada request.
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache[key];
  if (cached && cached.expires > now) {
    return cached.value;
  }

  const rows = await fetchAll<{ value: string }>("system_settings", {
    select: "value",
    eq: { key, is_active: true },
    limit: 1,
  });

  const value = rows[0]?.value ?? null;
  if (value !== null) {
    cache[key] = { value, expires: now + CACHE_MS };
  }
  return value;
}

/**
 * Obtiene el umbral de geolocalización en metros.
 * Valor por defecto: 500 metros.
 */
export async function getGeoThresholdMeters(): Promise<number> {
  const raw = await getSystemSetting("geo_threshold_meters");
  if (!raw) return 500;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 500;
  return parsed;
}

/**
 * Invalida la cache de settings (útil tras actualizar un valor).
 */
export function invalidateSystemSettingCache(key?: string) {
  if (key) {
    delete cache[key];
  } else {
    for (const k of Object.keys(cache)) {
      delete cache[k];
    }
  }
}
