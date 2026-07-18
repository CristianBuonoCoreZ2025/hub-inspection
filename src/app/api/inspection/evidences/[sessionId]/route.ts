import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { presignEvidenceUrls } from "@/lib/supabase/storage-presigned";
import { logger } from "@/lib/logger";

/**
 * API route que devuelve las evidencias de una sesión de inspección
 * con signed URLs (accesibles sin auth en el navegador).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ evidences: [] }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: evidences, error } = await supabase
      .from("inspection_evidences")
      .select(
        "id, url, type, description, category, captured_at, created_at, metadata, captured_by, lat, lng, exif_lat, exif_lng, uploader:profiles!inspection_evidences_captured_by_fkey(id, full_name, email)"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const evs = evidences || [];
    await presignEvidenceUrls(evs);

    return NextResponse.json({ evidences: evs });
  } catch (err) {
    logger.error("API /api/inspection/evidences error", err as Error, {
      component: "inspection-evidences-route",
      action: "get.evidences",
    });
    return NextResponse.json(
      { evidences: [], error: "No se pudieron cargar las evidencias" },
      { status: 500 }
    );
  }
}
