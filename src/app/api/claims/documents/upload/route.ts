import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadClaimDocument } from "@/lib/storage/claim-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir un documento del siniestro a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo
 *   - claimId: UUID del siniestro
 *   - documentTypeCode: código del tipo de documento (opcional)
 *
 * Flujo:
 *  1. Resuelve claimId → claim.liquidation_number
 *  2. Obtiene el siguiente correlativo DOC-NNNNNN atómico desde la BD
 *  3. Sube a R2 con path: claims/{L}/documents/{L}-DOC-NNNNNN.ext
 *  4. Inserta el registro en claim_documents (doc_code, file_path, file_url NOT NULL)
 *
 * Devuelve: { document: { id, document_name, document_url, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const claimId = formData.get("claimId");
    const documentTypeCode = formData.get("documentTypeCode");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!claimId || typeof claimId !== "string") {
      return NextResponse.json({ error: "Falta claimId" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado del plan
    const { url, key, docCode } = await uploadClaimDocument(claimId, buffer, mimeType, ext || ".bin");

    // Insertar en claim_documents — llenar columnas NOT NULL del schema original
    const supabase = createAdminClient();
    const { data: document, error } = await supabase
      .from("claim_documents")
      .insert({
        claim_id: claimId,
        doc_code: docCode,
        file_path: key,
        file_url: url,
        original_filename: file.name,
        mime_type: mimeType,
        document_name: file.name,
        document_url: url,
        document_type: typeof documentTypeCode === "string" && documentTypeCode ? documentTypeCode : null,
        file_size: file.size,
        is_active: true,
      })
      .select("id, claim_id, document_name, document_url, document_type, file_size, is_active, created_at, updated_at")
      .single();

    if (error) {
      logger.error("Claim doc upload: insert falló", new Error(error.message), {
        component: "claim-doc-upload",
        action: "insert.claim_doc",
      });
      return NextResponse.json({ error: "Error al registrar documento" }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    logger.error("API /api/claims/documents/upload error", err as Error, {
      component: "claim-doc-upload",
      action: "upload.claim_doc",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el documento" },
      { status: 500 }
    );
  }
}
