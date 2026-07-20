import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { uploadToR2 } from "@/lib/storage/r2-upload";
import { gestionDocumentVersionPath } from "@/lib/storage/paths";
import {
  getCurrentEditableDocument,
  createDocumentVersion,
  hasPdf,
  mimeTypeFor,
} from "@/services/claim-action-documents";
import { convertToPdf } from "@/services/pdf-conversion";
import { actionSupportsDocumentTemplates } from "@/server/lib/screen-templates";
import { logger } from "@/lib/logger";

/**
 * POST /api/claims/actions/[actionId]/convert-to-pdf
 *
 * Convierte el documento editable actual (Word/Excel/PowerPoint) a PDF,
 * sube el PDF a R2 y crea una nueva versión con file_type='pdf'.
 * Esto cierra la gestión (pasa a "cerrada/publicada").
 *
 * Validaciones:
 * - La gestión no debe tener ya un PDF (no se puede convertir 2 veces)
 * - Debe haber un documento editable actual
 * - Si action_template.is_dispatch_applicable = true:
 *   * El siniestro debe estar en estado "despacho"
 *   * El usuario debe ser despachador (TODO: validar rol)
 * - Si is_dispatch_applicable = false:
 *   * Cualquier usuario con permisos puede convertir
 *
 * Devuelve: { document } — la nueva versión PDF creada
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { actionId } = await params;
    const user = await requireCurrentUser();
    const supabase = createAdminClient();

    // 1. Verificar que la gestión no tenga ya un PDF
    const alreadyHasPdf = await hasPdf(actionId);
    if (alreadyHasPdf) {
      return NextResponse.json(
        { error: "La gestión ya tiene un PDF final. No se puede convertir nuevamente." },
        { status: 400 }
      );
    }

    // 2. Obtener el documento editable actual
    const editableDoc = await getCurrentEditableDocument(actionId);
    if (!editableDoc) {
      return NextResponse.json(
        { error: "No hay un documento editable (Word/Excel/PowerPoint) para convertir a PDF" },
        { status: 400 }
      );
    }

    // 3. Obtener la gestión + action_template + claim
    const { data: action, error: actionError } = await supabase
      .from("claim_actions")
      .select(
        "id, code, claim_id, status, action_template:action_template!claim_actions_action_template_id_fkey(id, is_dispatch_applicable)"
      )
      .eq("id", actionId)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: "Gestión no encontrada" }, { status: 404 });
    }

    // 4. Validar según is_dispatch_applicable
    const isDispatchApplicable = (action.action_template as any)?.is_dispatch_applicable === true;

    if (isDispatchApplicable) {
      // Verificar que el siniestro esté en estado "despacho"
      const { data: claim, error: claimError } = await supabase
        .from("claims")
        .select("id, status:claims_status_id_fkey(id, name, code)")
        .eq("id", action.claim_id)
        .single();

      if (claimError || !claim) {
        return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 });
      }

      const claimStatusCode = (claim.status as any)?.code?.toLowerCase() || "";
      const claimStatusName = (claim.status as any)?.name?.toLowerCase() || "";
      const isDispatchState =
        claimStatusCode.includes("despacho") || claimStatusName.includes("despacho");

      if (!isDispatchState) {
        return NextResponse.json(
          {
            error:
              "Esta gestión requiere despacho. El botón 'Convertir a PDF' solo está disponible cuando el siniestro está en estado 'despacho'.",
            claimStatus: (claim.status as any)?.name,
          },
          { status: 400 }
        );
      }

      // TODO: validar que el usuario sea despachador
      // Por ahora, cualquier usuario autenticado puede convertir cuando el siniestro está en despacho
    }

    // 5. Descargar el documento editable de R2
    const fileResponse = await fetch(editableDoc.file_url);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: `Error al descargar el documento editable: ${fileResponse.status}` },
        { status: 500 }
      );
    }
    const editableBuffer = new Uint8Array(await fileResponse.arrayBuffer());

    // 6. Convertir a PDF
    const pdfBuffer = await convertToPdf(editableBuffer, editableDoc.original_filename || editableDoc.file_name);

    // 7. Resolver códigos para el path
    const { data: claimData } = await supabase
      .from("claims")
      .select("liquidation_number")
      .eq("id", action.claim_id)
      .single();

    if (!claimData?.liquidation_number) {
      return NextResponse.json({ error: "Siniestro sin liquidation_number" }, { status: 400 });
    }

    const parts = action.code.split("-");
    if (parts.length < 4) {
      return NextResponse.json({ error: `Código de gestión inválido: ${action.code}` }, { status: 400 });
    }
    const compositeCode = parts[2];
    const instanceSeq = parts[3];

    // 8. Calcular próxima versión
    const { data: existingVersions } = await supabase
      .from("claim_action_documents")
      .select("version")
      .eq("claim_action_id", actionId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
    const key = gestionDocumentVersionPath(claimData.liquidation_number, compositeCode, instanceSeq, nextVersion, ".pdf");
    const mimeType = mimeTypeFor("pdf");
    const url = await uploadToR2(Buffer.from(pdfBuffer), key, mimeType);

    // 9. Crear versión PDF (esto marca has_pdf=true y pdf_generated_at)
    const document = await createDocumentVersion({
      claim_action_id: actionId,
      claim_id: action.claim_id,
      source: "pdf_conversion",
      file_url: url,
      file_path: key,
      file_name: `${action.code}-v${nextVersion}.pdf`,
      original_filename: editableDoc.original_filename
        ? editableDoc.original_filename.replace(/\.(docx|xlsx|pptx)$/i, ".pdf")
        : `${action.code}.pdf`,
      mime_type: mimeType,
      file_size: pdfBuffer.byteLength,
      file_type: "pdf",
      workflow_level: isDispatchApplicable ? "dispatcher" : "system",
      created_by: user.id,
    });

    logger.info("Documento convertido a PDF — gestión cerrada", {
      component: "convert-to-pdf",
      action: "convert",
      metadata: {
        actionId,
        actionCode: action.code,
        version: nextVersion,
        sourceDoc: editableDoc.file_name,
        pdfSize: pdfBuffer.byteLength,
        isDispatchApplicable,
        userId: user.id,
      },
    });

    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    logger.error("API convert-to-pdf error", err as Error);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al convertir a PDF" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 120; // la conversión puede tardar
