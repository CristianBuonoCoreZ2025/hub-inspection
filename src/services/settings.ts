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
export type MapProvider = "osm" | "mapbox";

export interface MapProvidersConfig {
  providers: MapProvider[];
  tokens: Record<MapProvider, string | null>;
}

/**
 * Obtiene la configuración de proveedores de mapas.
 * Por defecto: OpenStreetMap.
 */
export async function getMapProviders(): Promise<MapProvidersConfig> {
  const raw = await getSystemSetting("map_providers");
  if (!raw) {
    return { providers: [("osm" as MapProvider)], tokens: { osm: null, mapbox: null } };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MapProvidersConfig>;
    const providers = Array.isArray(parsed.providers)
      ? parsed.providers.filter((p): p is MapProvider => p === "osm" || p === "mapbox")
      : [("osm" as MapProvider)];
    return {
      providers: providers.length > 0 ? providers : [("osm" as MapProvider)],
      tokens: {
        osm: null,
        mapbox: typeof parsed.tokens?.mapbox === "string" ? parsed.tokens.mapbox : null,
      },
    };
  } catch {
    return { providers: [("osm" as MapProvider)], tokens: { osm: null, mapbox: null } };
  }
}

export function invalidateSystemSettingCache(key?: string) {
  if (key) {
    delete cache[key];
  } else {
    for (const k of Object.keys(cache)) {
      delete cache[k];
    }
  }
}
