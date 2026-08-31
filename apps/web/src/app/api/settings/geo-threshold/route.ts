import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { invalidateSystemSettingCache } from "@/services/settings";

/**
 * GET /api/settings/geo-threshold
 * Devuelve el umbral de geolocalización configurado en system_settings.
 * Valor por defecto: 500 metros.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "geo_threshold_meters")
      .eq("is_active", true)
      .limit(1);
    if (error) throw new Error(error.message);

    const raw = rows?.[0]?.value ?? null;
    let threshold = 500;
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) threshold = parsed;
    }

    return NextResponse.json({ threshold });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer configuración";
    return NextResponse.json({ error: message, threshold: 500 }, { status: 500 });
  }
}

/**
 * POST /api/settings/geo-threshold
 * Actualiza el umbral de geolocalización en system_settings.
 * Body: { value: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = Number(body.value);
    if (Number.isNaN(value) || value <= 0) {
      return NextResponse.json({ error: "El valor debe ser un número mayor a 0" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("system_settings")
      .upsert({ key: "geo_threshold_meters", value: String(value) }, { onConflict: "key" });

    if (error) {
      throw new Error(error.message);
    }

    invalidateSystemSettingCache("geo_threshold_meters");
    return NextResponse.json({ threshold: value });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
