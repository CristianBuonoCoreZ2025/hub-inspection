import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadInspectionFile } from "@/lib/storage/inspection-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir el PDF del acta de inspección a R2.
 *
 * Recibe multipart/form-data:
 *   - file: el PDF generado
 *   - sessionId: UUID de la inspection_session
 *
 * Sube el PDF a R2 con path: claims/{L}/actions/{code}/documents/{code}-DOC-NNNN.pdf
 * Actualiza inspection_reports.report_url con la URL pública.
 * Registra el PDF en claim_documents para que aparezca en el siniestro.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionId = formData.get("sessionId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Falta sessionId" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 como DOC
    const { url, key, fileCode } = await uploadInspectionFile(sessionId, buffer, "application/pdf", "DOC", ".pdf");

    const supabase = createAdminClient();

    // Obtener claim_id y datos de la sesión para vincular el documento al siniestro
    const { data: session } = await supabase
      .from("inspection_sessions")
      .select("claim_id, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code)")
      .eq("id", sessionId)
      .maybeSingle();

    // Actualizar el report_url en inspection_reports
    const { data: existing } = await supabase
      .from("inspection_reports")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("inspection_reports")
        .update({ report_url: url })
        .eq("id", existing.id);
    }

    // Registrar el PDF en claim_documents para que aparezca en el siniestro
    if (session?.claim_id) {
      const actionCode = (session.claim_action as { code?: string } | null)?.code || "INS";
      const { error: docError } = await supabase
        .from("claim_documents")
        .insert({
          claim_id: session.claim_id,
          doc_code: fileCode,
          file_path: key,
          file_url: url,
          document_name: `Acta de Inspección — ${actionCode}`,
          document_url: url,
          document_type: "application/pdf",
          original_filename: `${fileCode}.pdf`,
          mime_type: "application/pdf",
          file_size: buffer.length,
          is_active: true,
          ai_status: "pending",
          ai_summary: null,
          ai_model: null,
        });

      if (docError) {
        logger.error("No se pudo registrar el PDF en claim_documents", new Error(docError.message), {
          component: "inspection-report-upload",
          action: "insert.claim_document",
          metadata: { sessionId, claimId: session.claim_id, fileCode },
        });
        throw new Error(docError.message);
      }
    }

    return NextResponse.json({ url });
  } catch (err) {
    logger.error("API /api/inspection/report/upload error", err as Error, {
      component: "inspection-report-upload",
      action: "upload.report_pdf",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el PDF" },
      { status: 500 }
    );
  }
}
