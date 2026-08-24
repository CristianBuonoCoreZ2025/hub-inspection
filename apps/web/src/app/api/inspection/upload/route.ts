import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { uploadToR2 } from "@/lib/storage/r2-upload";

/**
 * API route server-side para subir archivos a Cloudflare R2.
 *
 * Recibe multipart/form-data con campo "file" (archivo único).
 * Devuelve { url } con la URL pública del archivo subido.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }

    const filePath = `inspection-evidences/${Date.now()}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const url = await uploadToR2(buffer, filePath, file.type || "application/octet-stream");

    return NextResponse.json({ url, fileId: filePath });
  } catch (err) {
    logger.error("Upload API error", err as Error, {
      component: "upload-route",
      action: "r2.upload",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
