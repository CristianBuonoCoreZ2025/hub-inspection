import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/storage/r2-upload";
import { gestionDocumentPath } from "@/lib/storage/paths";
import { getDocumentTemplateById } from "@/services/document-templates";
import { renderDocx } from "@/services/document-templates-docx";
import { buildDocumentDataForClaim, fetchTemplateBuffer } from "@/services/document-data";
import { buildTemplateData } from "@/lib/document-fields";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/generate-document
 *
 * Genera el documento .docx renderizado con los datos del siniestro y lo sube
 * a Cloudflare R2 con el path estructurado del plan:
 *   siniestros/{L}/gestiones/{L}-{CODIGO}-NNNN/{L}-{CODIGO}-NNNN.docx
 *
 * Se llama después de emitir una gestión que tiene template asociado.
 * Si la gestión no tiene template, devuelve 204 (no content).
 *
 * Devuelve: { url } — URL pública del documento en R2, o null si no hay template
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
        "id, code, claim_id, action_template_id, action_template:action_template!claim_actions_action_template_id_fkey(id, code)"
      )
      .eq("id", actionId)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: "Gestión no encontrada" }, { status: 404 });
    }

    if (!action.code || !action.claim_id) {
      return NextResponse.json({ error: "La gestión no tiene code o claim_id" }, { status: 400 });
    }

    // 2. Buscar el document_template asociado a este action_template
    const actionTemplateId = action.action_template_id;
    if (!actionTemplateId) {
      // Sin template → no hay documento que generar
      return NextResponse.json({ url: null, message: "Sin template asociado" }, { status: 200 });
    }

    const { data: templates, error: templatesError } = await supabase
      .from("document_templates")
      .select("id, file_url, file_name, placeholder_mapping, is_active")
      .eq("action_template_id", actionTemplateId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1);

    if (templatesError || !templates || templates.length === 0) {
      // Sin document_template → no hay documento que generar
      return NextResponse.json({ url: null, message: "Sin document_template activo" }, { status: 200 });
    }

    const templateRow = templates[0];
    const template = await getDocumentTemplateById(templateRow.id);
    if (!template) {
      return NextResponse.json({ url: null, message: "Template no encontrado" }, { status: 200 });
    }

    // 3. Resolver liquidation_number del claim
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("liquidation_number")
      .eq("id", action.claim_id)
      .single();

    if (claimError || !claim?.liquidation_number) {
      return NextResponse.json({ error: "Siniestro sin liquidation_number" }, { status: 400 });
    }

    const liquidationNumber = claim.liquidation_number;
    const actionCode = action.code; // ej: "L-000000141-HILI-001"

    // 4. Construir los datos del siniestro y renderizar
    const docData = await buildDocumentDataForClaim(action.claim_id);
    const templateData = buildTemplateData(docData, template.placeholder_mapping);
    const templateBuffer = await fetchTemplateBuffer(template.file_url);
    const rendered = renderDocx(templateBuffer, templateData);

    // 5. Subir a R2 con path estructurado del plan
    // El actionCode ya tiene el formato "L-000000141-HILI-001" (3 dígitos de instancia)
    // Necesito separar el compositeCode del actionCode para gestionDocumentPath
    // actionCode = liquidationNumber + "-" + compositeCode + "-" + instanceSeq
    // Ej: "L-000000141-HILI-001" → liquidation="L-000000141", composite="HILI", seq="001"
    const parts = actionCode.split("-");
    if (parts.length < 3) {
      return NextResponse.json({ error: `Código de gestión inválido: ${actionCode}` }, { status: 400 });
    }
    // parts[0] = "L", parts[1] = "000000141", parts[2] = "HILI", parts[3] = "001"
    // Pero liquidationNumber ya lo tenemos. compositeCode = parts[2], instanceSeq = parts[3]
    const compositeCode = parts[2];
    const instanceSeq = parts[3] || "0001";

    const key = gestionDocumentPath(liquidationNumber, compositeCode, instanceSeq, ".docx");
    const url = await uploadToR2(
      Buffer.from(rendered),
      key,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    logger.info("Documento de gestión generado y subido", {
      component: "generate-document",
      action: "generate.upload",
      metadata: { actionId, actionCode, key, size: rendered.byteLength },
    });

    return NextResponse.json({ url, key });
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
