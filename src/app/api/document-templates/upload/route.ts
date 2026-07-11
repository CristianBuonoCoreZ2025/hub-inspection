import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { extractPlaceholdersFromDocx } from "@/services/document-templates-docx";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/document-templates/upload
 *
 * Sube un .docx a Supabase Storage y devuelve:
 *  - url: URL pública del archivo
 *  - fileId: path del archivo en Storage
 *  - fileName, fileSize
 *  - placeholders: lista de {placeholders} detectados en el documento
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }

    // Validar que sea .docx
    const isDocx =
      file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isDocx) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .docx" },
        { status: 400 }
      );
    }

    // 1. Leer el buffer para detectar placeholders ANTES de subir
    const arrayBuffer = await file.arrayBuffer();
    let placeholders: string[] = [];
    try {
      placeholders = extractPlaceholdersFromDocx(arrayBuffer);
    } catch (e) {
      logger.warn("No se pudieron extraer placeholders del .docx", {
        component: "doc-template-upload",
        action: "extractPlaceholders",
        metadata: { fileName: file.name, error: (e as Error).message },
      });
    }

    // 2. Subir a Supabase Storage
    const supabase = createAdminClient();
    const filePath = `document-templates/${Date.now()}_${file.name}`;
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    if (uploadError) {
      logger.error("Doc template upload: Storage error", new Error(uploadError.message), {
        component: "doc-template-upload",
        action: "storage.upload",
        metadata: { error: uploadError.message },
      });
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      fileId: filePath,
      fileName: file.name,
      fileSize: file.size,
      placeholders,
    });
  } catch (err) {
    logger.error("Doc template upload error", err as Error, {
      component: "doc-template-upload",
      action: "upload",
    });
    return NextResponse.json(
      { error: "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
