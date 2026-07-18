import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir una evidencia de inspección a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo (foto, video, pdf)
 *   - sessionId: UUID de la inspection_session
 *   - description: descripción opcional (default: nombre original del archivo)
 *
 * Flujo:
 *  1. Resuelve sessionId → claim_action.code + claim.liquidation_number
 *  2. Obtiene el siguiente correlativo EVI-NNNN atómico desde la BD
 *  3. Sube a R2 con path: siniestros/{L}/gestiones/{code}/imagenes/{code}-EVI-NNNN.ext
 *  4. Inserta el registro en inspection_evidences
 *
 * Devuelve: { evidence: { id, url, type, description, created_at } }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");
    const description = formData.get("description");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    // Mapear MIME type → file_type de la BD
    const mimeType = file.type || "application/octet-stream";
    const fileType: "photo" | "video" | "pdf" | "document" = mimeType.startsWith("image/")
      ? "photo"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType === "application/pdf"
          ? "pdf"
          : "document";

    // Extensión desde el nombre original
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop()?.toLowerCase() : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado (EVI = evidencia)
    const { url } = await uploadInspectionFile(
      sessionId,
      buffer,
      mimeType,
      "EVI",
      ext || ".bin"
    );

    // Insertar en inspection_evidences
    const supabase = createAdminClient();
    const { data: evidence, error } = await supabase
      .from("inspection_evidences")
      .insert({
        session_id: sessionId,
        type: fileType,
        url,
        description: typeof description === "string" && description ? description : file.name,
      })
      .select("id, url, type, description, created_at")
      .single();

    if (error) {
      logger.error("Evidence upload: insert falló", new Error(error.message), {
        component: "inspection-evidences-upload",
        action: "insert.evidence",
      });
      return NextResponse.json({ error: "Error al registrar evidencia" }, { status: 500 });
    }

    return NextResponse.json({ evidence });
  } catch (err) {
    logger.error("API /api/inspection/evidences/upload error", err as Error, {
      component: "inspection-evidences-upload",
      action: "upload.evidence",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir la evidencia" },
      { status: 500 }
    );
  }
}
