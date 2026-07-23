import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/storage/r2-upload";
import { gestionDocumentVersionPath } from "@/lib/storage/paths";
import {
  createDocumentVersion,
  detectFileType,
  mimeTypeFor,
  type WorkflowLevel,
} from "@/services/claim-action-documents";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/upload-document
 *
 * Sube un documento de ofimática (Word/Excel/PowerPoint) subido por el usuario
 * y crea una nueva versión en claim_action_documents.
 *
 * NO acepta PDF — los PDFs se generan por conversión desde el documento editable.
 *
 * Body: multipart/form-data con campo "file" (el archivo .docx/.xlsx/.pptx)
 *
 * Devuelve: { document } — el registro de claim_action_documents creado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params;
    logger.info("upload-document llamado", {
      component: "upload-document",
      action: "upload.start",
      metadata: { actionId, actionIdType: typeof actionId, actionIdLength: actionId?.length },
    });
    const supabase = createAdminClient();

    // 1. Obtener la gestión
    const { data: action, error: actionError } = await supabase
      .from("claim_actions")
      .select("id, code, claim_id, issuer_id, issued_by, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code)")
      .eq("id", actionId)
      .single();

    if (actionError || !action) {
      logger.error("Gestión no encontrada en upload-document", new Error(actionError?.message || "no data"), {
        component: "upload-document",
        action: "upload.notfound",
        metadata: { actionId, error: actionError?.message, code: actionError?.code },
      });
      return NextResponse.json({ error: "Gestión no encontrada", detail: actionError?.message, actionId }, { status: 404 });
    }

    if (!action.code || !action.claim_id) {
      return NextResponse.json({ error: "La gestión no tiene code o claim_id" }, { status: 400 });
    }

    // 2. Parsear multipart
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
    }

    // 3. Detectar tipo de archivo
    const fileName = file.name;
    const fileType = detectFileType(fileName, file.type);

    // NO aceptar PDF — los PDFs se generan por conversión
    if (fileType === "pdf") {
      return NextResponse.json(
        {
          error:
            "No se puede subir un PDF directamente. Los PDFs se generan con el botón 'Convertir a PDF' desde un documento Word/Excel/PowerPoint.",
        },
        { status: 400 }
      );
    }

    // 4. Resolver liquidation_number y códigos
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("liquidation_number")
      .eq("id", action.claim_id)
      .single();

    if (claimError || !claim?.liquidation_number) {
      return NextResponse.json({ error: "Siniestro sin liquidation_number" }, { status: 400 });
    }

    const liquidationNumber = claim.liquidation_number;
    const parts = action.code.split("-");
    if (parts.length < 4) {
      return NextResponse.json({ error: `Código de gestión inválido: ${action.code}` }, { status: 400 });
    }
    const compositeCode = parts[2];
    const instanceSeq = parts[3];

    // 5. Calcular próxima versión
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

    // 6. Subir a R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadToR2(buffer, key, mimeType);

    // 7. Determinar workflow_level
    const statusCode = (action as Record<string, unknown>)?.action_status as { code?: string | null } | null;
    const workflowLevel = determineWorkflowLevel(statusCode?.code ?? null);

    // 8. Crear versión
    const source = `upload_${fileType}` as "upload_docx" | "upload_xlsx" | "upload_pptx";
    const document = await createDocumentVersion({
      claim_action_id: actionId,
      claim_id: action.claim_id,
      source,
      file_url: url,
      file_path: key,
      file_name: `${action.code}-v${nextVersion}.${fileType}`,
      original_filename: fileName,
      mime_type: mimeType,
      file_size: buffer.byteLength,
      file_type: fileType,
      workflow_level: workflowLevel,
      created_by: action.issued_by || action.issuer_id,
    });

    logger.info("Documento de gestión subido y versionado", {
      component: "upload-document",
      action: "upload.version",
      metadata: { actionId, actionCode: action.code, version: nextVersion, fileType, fileName, size: buffer.byteLength },
    });

    return NextResponse.json({ document });
  } catch (err) {
    logger.error("API /api/claims/actions/[id]/upload-document error", err as Error, {
      component: "upload-document",
      action: "upload",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir documento" },
      { status: 500 }
    );
  }
}

function determineWorkflowLevel(status: string | null): WorkflowLevel {
  if (!status) return "issuer";
  if (status === "todo" || status === "rejected") return "issuer";
  if (status === "issued" || status === "review") return "reviewer";
  if (status === "reviewed" || status === "approval") return "approver";
  if (status === "approved" || status === "dispatched") return "dispatcher";
  return "issuer";
}

// Forzar Node.js runtime (manejo de archivos)
export const runtime = "nodejs";
export const maxDuration = 60;
