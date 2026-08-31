import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteFromR2 } from "@/lib/storage/r2-upload";
import { logger } from "@/lib/logger";

/**
 * API route para borrar un croquis de inspección.
 *
 * 1. Borra el archivo de R2
 * 2. Borra el registro de damage_sketches
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sketchId: string }> }
) {
  try {
    const { sketchId } = await params;
    if (!sketchId) {
      return NextResponse.json({ error: "Falta sketchId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener la URL antes de borrar
    const { data: sketch, error: fetchError } = await supabase
      .from("damage_sketches")
      .select("sketch_url")
      .eq("id", sketchId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: "Error al buscar croquis" }, { status: 500 });
    }

    // 2. Borrar de R2
    if (sketch?.sketch_url) {
      try {
        const publicUrl = process.env.R2_PUBLIC_URL || "";
        const key = sketch.sketch_url.replace(`${publicUrl}/`, "");
        if (key && key !== sketch.sketch_url) {
          await deleteFromR2(key);
        }
      } catch (delErr) {
        logger.warn("No se pudo borrar croquis de R2", {
          component: "inspection-sketch-delete",
          action: "delete.r2_file",
          metadata: { sketchId, error: delErr instanceof Error ? delErr.message : String(delErr) },
        });
      }
    }

    // 3. Borrar de la BD
    const { error: deleteError } = await supabase
      .from("damage_sketches")
      .delete()
      .eq("id", sketchId);

    if (deleteError) {
      return NextResponse.json({ error: "Error al borrar croquis" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("API /api/inspection/sketch DELETE error", err as Error, {
      component: "inspection-sketch-delete",
      action: "delete.sketch",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo borrar el croquis" },
      { status: 500 }
    );
  }
}
