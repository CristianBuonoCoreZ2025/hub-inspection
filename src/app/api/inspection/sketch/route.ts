import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route pública (sin auth) para que el asegurado o inspector
 * guarde un croquis dibujado desde la herramienta de dibujo.
 *
 * Recibe: { sessionId, sketchDataUrl (base64 PNG), label }
 * 1. Sube la imagen a Cloudflare R2 con path estructurado del plan:
 *    claims/{L}/actions/{code}/documents/{code}-CRO-NNNN.png
 * 2. Crea el registro en damage_sketches
 *
 * Si se envía sketchId, actualiza el croquis existente (editar).
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, sketchDataUrl, label, sketchId } = await request.json();
    if (!sessionId || !sketchDataUrl) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Convertir base64 a buffer y subir a R2 con path estructurado (CRO = croquis)
    const base64Response = await fetch(sketchDataUrl);
    const blob = await base64Response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    const { url: sketchUrl } = await uploadInspectionFile(
      sessionId,
      buffer,
      "image/png",
      "CRO",
      ".png"
    );

    // 2. Crear o actualizar registro en damage_sketches
    if (sketchId) {
      // Editar croquis existente
      const { data: sketch, error: updateError } = await supabase
        .from("damage_sketches")
        .update({ sketch_url: sketchUrl, label: label || "Croquis" })
        .eq("id", sketchId)
        .select("id, sketch_url, label, created_at")
        .single();

      if (updateError) {
        logger.error("Sketch API: update falló", new Error(updateError.message), {
          component: "inspection-sketch-route",
          action: "update.sketch",
        });
        return NextResponse.json({ error: "Error al actualizar croquis" }, { status: 500 });
      }

      return NextResponse.json({ sketch });
    } else {
      // Crear nuevo croquis
      const { data: sketch, error: insertError } = await supabase
        .from("damage_sketches")
        .insert({
          session_id: sessionId,
          sketch_url: sketchUrl,
          label: label || "Croquis",
        })
        .select("id, sketch_url, label, created_at")
        .single();

      if (insertError) {
        logger.error("Sketch API: insert falló", new Error(insertError.message), {
          component: "inspection-sketch-route",
          action: "insert.sketch",
        });
        return NextResponse.json({ error: "Error al guardar croquis" }, { status: 500 });
      }

      return NextResponse.json({ sketch });
    }
  } catch (err) {
    logger.error("API /api/inspection/sketch error", err as Error, {
      component: "inspection-sketch-route",
      action: "save.sketch",
    });
    return NextResponse.json({ error: "No se pudo guardar el croquis" }, { status: 500 });
  }
}
