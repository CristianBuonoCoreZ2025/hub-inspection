import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  getDocumentTemplateById,
} from "@/services/document-templates";
import { renderDocx } from "@/services/document-templates-docx";
import { buildDocumentDataForClaim, fetchTemplateBuffer } from "@/services/document-data";
import { buildTemplateData } from "@/lib/document-fields";

/**
 * GET /api/document-templates/[id]/generate?claimId=xxx
 *
 * Genera un .docx renderizado con los datos del siniestro indicado,
 * reemplazando los {placeholders} de la plantilla. Devuelve el archivo
 * .docx como respuesta binaria (Content-Type: application/vnd...wordprocessingml.document).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const claimId = request.nextUrl.searchParams.get("claimId");
    if (!claimId) {
      return NextResponse.json(
        { error: "Falta parámetro claimId" },
        { status: 400 }
      );
    }

    // 1. Obtener la plantilla
    const template = await getDocumentTemplateById(id);
    if (!template || !template.is_active) {
      return NextResponse.json(
        { error: "Plantilla no encontrada o inactiva" },
        { status: 404 }
      );
    }

    // 2. Construir los datos del siniestro
    const docData = await buildDocumentDataForClaim(claimId);

    // 3. Resolver placeholders: campos canónicos + mapeo manual del usuario
    const templateData = buildTemplateData(docData, template.placeholder_mapping);

    // 4. Descargar el .docx de Storage
    const buffer = await fetchTemplateBuffer(template.file_url);

    // 5. Renderizar
    const rendered = renderDocx(buffer, templateData);

    // 6. Devolver como .docx
    const fileName = template.file_name.replace(/\.docx$/i, "") + `_rendered.docx`;
    return new NextResponse(rendered as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(rendered.byteLength),
      },
    });
  } catch (err) {
    logger.error("Doc template generate error", err as Error, {
      component: "doc-template-generate",
      action: "generate",
    });
    const msg = err instanceof Error ? err.message : "Error al generar el documento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
