import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteFromR2 } from "@/lib/storage/r2-upload";
import { logger } from "@/lib/logger";

/**
 * POST /api/inspection/geo/reset-geo
 * Borra las evidencias geo_map de una sesión para permitir recaptura.
 * Público para el magic link (autentica por token).
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Traer la sesión
    const { data: sessions, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select("id, geo_recapture_enabled")
      .eq("magic_link_token", token)
      .limit(1);
    if (sessionError) throw new Error(sessionError.message);
    const session = sessions?.[0];
    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    // 2. Borrar evidencias geo_map anteriores
    const { data: evidences, error: listError } = await supabase
      .from("inspection_evidences")
      .select("id, url")
      .eq("session_id", session.id)
      .eq("source", "geo_map");
    if (listError) throw new Error(listError.message);

    if (evidences && evidences.length > 0) {
      const publicUrl = process.env.R2_PUBLIC_URL || "";
      for (const ev of evidences) {
        if (ev.url) {
          try {
            const key = ev.url.replace(`${publicUrl}/`, "");
            if (key && key !== ev.url) await deleteFromR2(key);
          } catch (delErr) {
            logger.warn("No se pudo borrar archivo de R2 al resetear geo", {
              component: "geo-reset",
              action: "delete.r2_file",
              metadata: { evidenceId: ev.id, error: delErr instanceof Error ? delErr.message : String(delErr) },
            });
          }
        }
      }
      const { error: deleteError } = await supabase
        .from("inspection_evidences")
        .delete()
        .eq("session_id", session.id)
        .eq("source", "geo_map");
      if (deleteError) throw new Error(deleteError.message);
    }

    return NextResponse.json({ success: true, deleted: evidences?.length ?? 0 });
  } catch (err) {
    const error = err as Error;
    logger.error("API /api/inspection/geo/reset-geo error", error, {
      component: "geo-reset",
      action: "reset.geo",
    });
    return NextResponse.json(
      { error: error.message || "No se pudo resetear la geolocalización" },
      { status: 500 }
    );
  }
}
