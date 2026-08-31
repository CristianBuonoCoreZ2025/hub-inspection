import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { invalidateSystemSettingCache } from "@/services/settings";

export type MapProvider = "carto" | "mapbox" | "google";

export interface MapProvidersConfig {
  providers: MapProvider[];
  tokens: Record<MapProvider, string | null>;
  /** Uso mensual de Google Maps (para control de costo) */
  googleUsage?: { month: string; count: number; limit: number };
}

const DEFAULT_CONFIG: MapProvidersConfig = {
  providers: ["google", "carto", "mapbox"],
  tokens: { google: null, carto: null, mapbox: null },
};

// Límite mensual de requests a Google Maps (~$200 USD free tier).
// Cada geocodificación + carga de mapa consume ~2 requests.
// 25,000 requests/mes ≈ $175-190, dejando margen antes del tope.
const GOOGLE_MONTHLY_LIMIT = 25000;

/**
 * Obtiene el mes actual en formato YYYY-MM
 */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Lee el contador de uso de Google Maps del mes actual.
 * Se guarda en system_settings con key `google_maps_usage_YYYY_MM`.
 */
async function getGoogleUsage(admin: ReturnType<typeof createAdminClient>): Promise<{ month: string; count: number }> {
  const month = currentMonth();
  const key = `google_maps_usage_${month}`;
  const { data, error } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.value) return { month, count: 0 };
  try {
    const parsed = JSON.parse(data.value) as { count?: number };
    return { month, count: parsed.count || 0 };
  } catch {
    return { month, count: 0 };
  }
}

/**
 * Incrementa el contador de uso de Google Maps.
 * Se llama cada vez que se devuelve Google como proveedor activo.
 */
async function incrementGoogleUsage(admin: ReturnType<typeof createAdminClient>, month: string): Promise<void> {
  const key = `google_maps_usage_${month}`;
  const { data } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  let count = 0;
  if (data?.value) {
    try { count = (JSON.parse(data.value) as { count?: number }).count || 0; } catch { /* ignore */ }
  }

  await admin
    .from("system_settings")
    .upsert(
      { key, value: JSON.stringify({ count: count + 1 }), is_active: true },
      { onConflict: "key" }
    );
}

/**
 * GET /api/settings/map-providers
 * Devuelve la configuración de proveedores de mapas (orden y tokens).
 * CartoDB es el proveedor por defecto (gratis, CORS, sin rate limits).
 * Mapbox es la alternativa secundaria (requiere token).
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "map_providers")
      .eq("is_active", true)
      .limit(1);
    if (error) throw new Error(error.message);

    const raw = rows?.[0]?.value ?? null;
    // Token de Google Maps desde env var (siempre disponible si está configurado)
    const googleToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;

    // Control de cuota mensual de Google Maps
    const usage = await getGoogleUsage(admin);
    const googleAvailable = googleToken && usage.count < GOOGLE_MONTHLY_LIMIT;

    let config: MapProvidersConfig = DEFAULT_CONFIG;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { providers?: string[]; tokens?: Record<string, string | null> };
        // Migrar config antigua: "osm" → "carto"
        const rawProviders = Array.isArray(parsed.providers) ? parsed.providers : [];
        let providers = rawProviders
          .map((p) => (p === "osm" ? "carto" : p))
          .filter((p): p is MapProvider => p === "carto" || p === "mapbox" || p === "google");

        // Si Google tiene token y está dentro de cuota, asegurarlo como primer proveedor
        if (googleAvailable && !providers.includes("google")) {
          providers.unshift("google");
        }

        // Si Google superó el límite mensual, quitarlo de la lista (fallback a Mapbox/OSM)
        if (!googleAvailable) {
          providers = providers.filter((p) => p !== "google");
          if (!providers.includes("carto")) providers.unshift("carto");
          if (!providers.includes("mapbox")) providers.push("mapbox");
          console.warn(`[map-providers] Google Maps fuera de cuota (${usage.count}/${GOOGLE_MONTHLY_LIMIT}), usando fallback`);
        }

        config = {
          providers: providers.length > 0 ? providers : DEFAULT_CONFIG.providers,
          tokens: {
            google: googleAvailable ? googleToken : null,
            carto: null,
            mapbox: typeof parsed.tokens?.mapbox === "string" ? parsed.tokens.mapbox : null,
          },
          googleUsage: { month: usage.month, count: usage.count, limit: GOOGLE_MONTHLY_LIMIT },
        };
      } catch {
        // mantener default
      }
    } else {
      // Sin config en DB: usar defaults con token de Google desde env
      const providers = googleAvailable
        ? DEFAULT_CONFIG.providers
        : (["carto", "mapbox"] as MapProvider[]);

      config = {
        providers,
        tokens: {
          google: googleAvailable ? googleToken : null,
          carto: null,
          mapbox: null,
        },
        googleUsage: { month: usage.month, count: usage.count, limit: GOOGLE_MONTHLY_LIMIT },
      };
    }

    // Incrementar contador de uso de Google si está activo
    if (googleAvailable) {
      await incrementGoogleUsage(admin, usage.month);
    }

    return NextResponse.json(config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer configuración";
    return NextResponse.json({ error: message, ...DEFAULT_CONFIG }, { status: 500 });
  }
}

/**
 * POST /api/settings/map-providers
 * Actualiza la configuración de proveedores de mapas.
 * Body: { providers: ["carto", "mapbox"], tokens: { mapbox: "pk..." } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MapProvidersConfig>;
    const providers = Array.isArray(body.providers)
      ? body.providers.filter((p): p is MapProvider => p === "carto" || p === "mapbox" || p === "google")
      : DEFAULT_CONFIG.providers;
    const tokens = {
      google: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || (typeof body.tokens?.google === "string" ? body.tokens.google : null),
      carto: null,
      mapbox: typeof body.tokens?.mapbox === "string" ? body.tokens.mapbox : null,
    } as Record<MapProvider, string | null>;

    const admin = createAdminClient();
    const { error } = await admin
      .from("system_settings")
      .upsert(
        { key: "map_providers", value: JSON.stringify({ providers, tokens }) },
        { onConflict: "key" }
      );

    if (error) {
      throw new Error(error.message);
    }

    invalidateSystemSettingCache("map_providers");
    const usage = await getGoogleUsage(admin);
    return NextResponse.json({ providers, tokens, googleUsage: { month: usage.month, count: usage.count, limit: GOOGLE_MONTHLY_LIMIT } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: message, ...DEFAULT_CONFIG }, { status: 500 });
  }
}
