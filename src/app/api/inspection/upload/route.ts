import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * API route server-side para subir archivos a Supabase Storage.
 * Usa service role key para evitar problemas de permisos.
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

    const supabase = createAdminClient();
    const filePath = `inspection-evidences/${Date.now()}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("inspection-evidences")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      logger.error("Upload API: Storage error", new Error(uploadError.message), {
        component: "upload-route",
        action: "storage.upload",
        metadata: { error: uploadError.message },
      });
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("inspection-evidences")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl, fileId: filePath });
  } catch (err) {
    logger.error("Upload API error", err as Error, {
      component: "upload-route",
      action: "storage.upload",
    });
    return NextResponse.json(
      { error: "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
