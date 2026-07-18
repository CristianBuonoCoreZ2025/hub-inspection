import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { extractPlaceholdersFromDocx } from "@/services/document-templates-docx";
import { uploadGestionTemplate } from "@/lib/storage/template-upload";

/**
 * POST /api/document-templates/upload
 *
 * Sube un .docx a Cloudflare R2 con el path estructurado del plan:
 *   configuracion/gestiones/{CODIGO_COMPUESTO}/{CODIGO_COMPUESTO}-NNNNN.docx
 *
 * Recibe multipart/form-data:
 *   - file: el archivo .docx
 *   - actionTemplateId: UUID del action_template (para resolver el compositeCode)
 *
 * Devuelve:
 *  - url: URL pública del archivo
 *  - fileId: path del archivo en R2
 *  - fileName, fileSize
 *  - placeholders: lista de {placeholders} detectados en el documento
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const actionTemplateId = formData.get("actionTemplateId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!actionTemplateId || typeof actionTemplateId !== "string") {
      return NextResponse.json({ error: "Falta actionTemplateId" }, { status: 400 });
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

    // 2. Subir a R2 con path estructurado del plan
    const buffer = Buffer.from(arrayBuffer);
    const { url, key: filePath } = await uploadGestionTemplate(
      actionTemplateId,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".docx"
    );

    return NextResponse.json({
      url,
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
      { error: err instanceof Error ? err.message : "No se pudo subir el archivo" },
      { status: 500 }
    );
  }
}
