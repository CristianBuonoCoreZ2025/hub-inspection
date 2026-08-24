import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteFromR2 } from "@/lib/storage/r2-upload";
import { logger } from "@/lib/logger";

/**
 * API route para borrar una evidencia de inspección.
 *
 * 1. Borra el archivo de R2
 * 2. Borra el registro de inspection_evidences
 *
 * Así nunca quedan archivos huérfanos en R2.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const { evidenceId } = await params;
    if (!evidenceId) {
      return NextResponse.json({ error: "Falta evidenceId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener la URL del archivo antes de borrar el registro
    const { data: evidence, error: fetchError } = await supabase
      .from("inspection_evidences")
      .select("url")
      .eq("id", evidenceId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: "Error al buscar evidencia" }, { status: 500 });
    }

    // 2. Borrar el archivo de R2
    if (evidence?.url) {
      try {
        const publicUrl = process.env.R2_PUBLIC_URL || "";
        const key = evidence.url.replace(`${publicUrl}/`, "");
        if (key && key !== evidence.url) {
          await deleteFromR2(key);
        }
      } catch (delErr) {
        // No bloquear el borrado de la BD si falla R2, pero loguear
        logger.warn("No se pudo borrar archivo de R2 al eliminar evidencia", {
          component: "inspection-evidences-delete",
          action: "delete.r2_file",
          metadata: { evidenceId, error: delErr instanceof Error ? delErr.message : String(delErr) },
        });
      }
    }

    // 3. Borrar el registro de la BD
    const { error: deleteError } = await supabase
      .from("inspection_evidences")
      .delete()
      .eq("id", evidenceId);

    if (deleteError) {
      return NextResponse.json({ error: "Error al borrar evidencia" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("API /api/inspection/evidences DELETE error", err as Error, {
      component: "inspection-evidences-delete",
      action: "delete.evidence",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo borrar la evidencia" },
      { status: 500 }
    );
  }
}
