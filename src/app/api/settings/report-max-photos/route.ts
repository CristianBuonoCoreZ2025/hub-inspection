import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getReportMaxPhotos, invalidateSystemSettingCache } from "@/services/settings";

/**
 * GET /api/settings/report-max-photos
 * Devuelve la cantidad máxima de fotos por informe.
 * Valor por defecto: 18.
 */
export async function GET() {
  try {
    const value = await getReportMaxPhotos();
    return NextResponse.json({ value });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al leer configuración" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/report-max-photos
 * Actualiza la cantidad máxima de fotos por informe.
 * Body: { value: number } (0..24)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = Number(body?.value);

    if (Number.isNaN(value) || value < 0 || value > 24) {
      return NextResponse.json(
        { error: "El valor debe estar entre 0 y 24" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("system_settings")
      .upsert({ key: "report_max_photos", value: String(value) }, { onConflict: "key" });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    invalidateSystemSettingCache("report_max_photos");
    return NextResponse.json({ ok: true, value });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar" },
      { status: 500 }
    );
  }
}
