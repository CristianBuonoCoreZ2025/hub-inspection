import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { invalidateSystemSettingCache } from "@/services/settings";

export type MapProvider = "osm" | "mapbox";

export interface MapProvidersConfig {
  providers: MapProvider[];
  tokens: Record<MapProvider, string | null>;
}

const DEFAULT_CONFIG: MapProvidersConfig = {
  providers: ["osm"],
  tokens: { osm: null, mapbox: null },
};

/**
 * GET /api/settings/map-providers
 * Devuelve la configuración de proveedores de mapas (orden y tokens).
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
    let config: MapProvidersConfig = DEFAULT_CONFIG;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<MapProvidersConfig>;
        const providers = Array.isArray(parsed.providers)
          ? parsed.providers.filter((p): p is MapProvider => p === "osm" || p === "mapbox")
          : DEFAULT_CONFIG.providers;
        config = {
          providers: providers.length > 0 ? providers : DEFAULT_CONFIG.providers,
          tokens: {
            osm: null,
            mapbox: typeof parsed.tokens?.mapbox === "string" ? parsed.tokens.mapbox : null,
          },
        };
      } catch {
        // mantener default
      }
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
 * Body: { providers: ["osm", "mapbox"], tokens: { mapbox: "pk..." } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MapProvidersConfig>;
    const providers = Array.isArray(body.providers)
      ? body.providers.filter((p): p is MapProvider => p === "osm" || p === "mapbox")
      : DEFAULT_CONFIG.providers;
    const tokens = {
      osm: null,
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
    return NextResponse.json({ providers, tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: message, ...DEFAULT_CONFIG }, { status: 500 });
  }
}
