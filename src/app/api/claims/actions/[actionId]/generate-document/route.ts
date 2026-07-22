import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/storage/r2-upload";
import { gestionDocumentVersionPath } from "@/lib/storage/paths";
import { getDocumentTemplateById } from "@/services/document-templates";
import { renderDocument } from "@/services/document-render";
import { buildDocumentDataForClaim, fetchTemplateBuffer } from "@/services/document-data";
import { buildTemplateData } from "@/lib/document-fields";
import { createDocumentVersion, detectFileType, mimeTypeFor, type WorkflowLevel } from "@/services/claim-action-documents";
import { actionSupportsDocumentTemplates } from "@/server/lib/screen-templates";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/generate-document
 *
 * Genera un documento (Word/Excel/PowerPoint) renderizado con los datos del siniestro
 * a partir de una plantilla del sistema, lo sube a R2 y crea una nueva versión en
 * claim_action_documents.
 *
 * Body: { templateId: string }
 *
 * Devuelve: { document } — el registro de claim_action_documents creado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params;
    const supabase = createAdminClient();

    // 1. Obtener la gestión con su template y claim
    const { data: action, error: actionError } = await supabase
      .from("claim_actions")
      .select(
        "id, code, claim_id, action_template_id, issuer_id, issued_by, action_template:action_template!claim_actions_action_template_id_fkey(id, code)"
      )
      .eq("id", actionId)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: "Gestión no encontrada" }, { status: 404 });
    }

    if (!action.code || !action.claim_id) {
      return NextResponse.json({ error: "La gestión no tiene code o claim_id" }, { status: 400 });
    }

    // 1b. Validar que la pantalla de la gestión soporte flujo de templates.
    // Si la pantalla no tiene un campo "document_templates" en su form_schema,
    // no se puede generar un documento desde template.
    const supportsTemplates = await actionSupportsDocumentTemplates(actionId);
    if (!supportsTemplates) {
      return NextResponse.json(
        {
          error:
            "La pantalla asociada a esta gestión no soporta templates. Solo las gestiones con pantalla «Pantalla + Templates» pueden generar documentos desde template.",
        },
        { status: 400 }
      );
    }

    // 2. Obtener templateId del body
    const body = (await request.json().catch(() => ({}))) as { templateId?: string };
    if (!body.templateId) {
      return NextResponse.json({ error: "Falta templateId en el body" }, { status: 400 });
    }

    const template = await getDocumentTemplateById(body.templateId);
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }
    if (!template.is_active) {
      return NextResponse.json({ error: "La plantilla está inactiva" }, { status: 400 });
    }

    // 3. Detectar tipo de archivo
    const fileType = template.file_type || detectFileType(template.file_name, template.mime_type || undefined);
    if (fileType === "pdf") {
      return NextResponse.json(
        { error: "No se puede generar un PDF desde plantilla — los PDFs se generan por conversión" },
        { status: 400 }
      );
    }

    // 4. Resolver liquidation_number del claim
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("liquidation_number")
      .eq("id", action.claim_id)
      .single();

    if (claimError || !claim?.liquidation_number) {
      return NextResponse.json({ error: "Siniestro sin liquidation_number" }, { status: 400 });
    }

    const liquidationNumber = claim.liquidation_number;
    const actionCode = action.code;
    const parts = actionCode.split("-");
    if (parts.length < 4) {
      return NextResponse.json({ error: `Código de gestión inválido: ${actionCode}` }, { status: 400 });
    }
    const compositeCode = parts[2];
    const instanceSeq = parts[3];

    // 5. Construir los datos del siniestro y renderizar
    const docData = await buildDocumentDataForClaim(action.claim_id);
    const templateData = buildTemplateData(docData, template.placeholder_mapping);
    const templateBuffer = await fetchTemplateBuffer(template.file_url);
    const rendered = await renderDocument(templateBuffer, templateData, fileType);

    // 6. Determinar workflow_level según el estado de la gestión
    // Nota: no trajimos el status en el select, pero para generate-document
    // el workflow_level siempre es "issuer" (se genera en etapa de emisión).
    const workflowLevel = determineWorkflowLevel(null);

    // 7. Crear versión (esto calcula el número de versión automáticamente)
    // Necesitamos pre-calcular el path, pero el número de versión lo calcula createDocumentVersion.
    // Para evitar una doble query, primero obtenemos el próximo número de versión.
    const { data: existingVersions } = await supabase
      .from("claim_action_documents")
      .select("version")
      .eq("claim_action_id", actionId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
    const ext = `.${fileType}`;
    const key = gestionDocumentVersionPath(liquidationNumber, compositeCode, instanceSeq, nextVersion, ext);
    const mimeType = mimeTypeFor(fileType);
    const url = await uploadToR2(Buffer.from(rendered), key, mimeType);

    // 8. Crear el registro de versión
    const document = await createDocumentVersion({
      claim_action_id: actionId,
      claim_id: action.claim_id,
      source: "template",
      document_template_id: template.id,
      file_url: url,
      file_path: key,
      file_name: `${actionCode}-v${nextVersion}.${fileType}`,
      original_filename: template.original_filename || template.file_name,
      mime_type: mimeType,
      file_size: rendered.byteLength,
      file_type: fileType,
      workflow_level: workflowLevel,
      created_by: action.issued_by || action.issuer_id,
    });

    logger.info("Documento de gestión generado y versionado", {
      component: "generate-document",
      action: "generate.version",
      metadata: { actionId, actionCode, version: nextVersion, fileType, key, size: rendered.byteLength },
    });

    return NextResponse.json({ document });
  } catch (err) {
    logger.error("API /api/claims/actions/[id]/generate-document error", err as Error, {
      component: "generate-document",
      action: "generate",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar documento" },
      { status: 500 }
    );
  }
}

/** Determina el workflow_level según el estado de la gestión */
function determineWorkflowLevel(status: string | null): WorkflowLevel {
  if (!status) return "issuer";
  if (status === "todo" || status === "rejected") return "issuer";
  if (status === "issued" || status === "review") return "reviewer";
  if (status === "reviewed" || status === "approval") return "approver";
  if (status === "approved" || status === "dispatched") return "dispatcher";
  return "issuer";
}
