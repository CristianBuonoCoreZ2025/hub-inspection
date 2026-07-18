import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir un croquis como archivo (no dibujado) a R2.
 *
 * A diferencia de /api/inspection/sketch (que recibe base64 dibujado),
 * este endpoint recibe un File subido por el usuario.
 *
 * Path: siniestros/{L}/gestiones/{code}/documentos/{code}-CRO-NNNN.ext
 *
 * Recibe multipart/form-data:
 *   - file: el archivo (png, jpg, pdf)
 *   - sessionId: UUID de la inspection_session
 *   - label: etiqueta opcional (default: nombre del archivo)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");
    const label = formData.get("label");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : ".png";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado (CRO = croquis)
    const { url } = await uploadInspectionFile(sessionId, buffer, mimeType, "CRO", ext);

    // Insertar en damage_sketches
    const supabase = createAdminClient();
    const { data: sketch, error } = await supabase
      .from("damage_sketches")
      .insert({
        session_id: sessionId,
        sketch_url: url,
        label: typeof label === "string" && label ? label : file.name,
      })
      .select("id, session_id, sketch_url, label, created_at")
      .single();

    if (error) {
      logger.error("Sketch file upload: insert falló", new Error(error.message), {
        component: "inspection-sketch-upload",
        action: "insert.sketch",
      });
      return NextResponse.json({ error: "Error al registrar croquis" }, { status: 500 });
    }

    return NextResponse.json({ sketch });
  } catch (err) {
    logger.error("API /api/inspection/sketch/upload error", err as Error, {
      component: "inspection-sketch-upload",
      action: "upload.sketch_file",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el croquis" },
      { status: 500 }
    );
  }
}
