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
 * Sube el PDF a R2 con path: siniestros/{L}/gestiones/{code}/documentos/{code}-DOC-NNNN.pdf
 * Actualiza inspection_reports.report_url con la URL pública.
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
    const { url } = await uploadInspectionFile(sessionId, buffer, "application/pdf", "DOC", ".pdf");

    // Actualizar el report_url en inspection_reports
    const supabase = createAdminClient();
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
