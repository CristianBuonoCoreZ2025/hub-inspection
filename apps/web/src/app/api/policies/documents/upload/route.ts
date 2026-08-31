import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadPolicyDocument } from "@/lib/storage/policy-upload";
import { logger } from "@/lib/logger";

/**
 * API route para subir un documento de póliza a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo
 *   - policyId: UUID de la póliza
 *
 * Flujo:
 *  1. Sube a R2 con path estructurado del plan
 *  2. Inserta el registro en policy_documents con ai_summary=null
 *  3. Responde al cliente inmediatamente
 *  4. El frontend dispara /api/ai/process-pending { policyId } para
 *     que la IA analice el documento en segundo plano.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const policyId = formData.get("policyId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
    }
    if (!policyId || typeof policyId !== "string") {
      return NextResponse.json({ error: "Falta policyId" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()?.toLowerCase()
      : "";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a R2 con path estructurado del plan
    const { url } = await uploadPolicyDocument(policyId, buffer, mimeType, ext || ".bin");

    // Insertar en policy_documents (sin IA — la IA la dispara el frontend
    // vía /api/ai/process-pending después de subir)
    const supabase = createAdminClient();
    const { data: document, error } = await supabase
      .from("policy_documents")
      .insert({
        policy_id: policyId,
        document_name: file.name,
        document_url: url,
        document_type: mimeType,
        file_size: file.size,
        is_active: true,
        ai_summary: null,
        ai_model: null,
      })
      .select("id, policy_id, document_name, document_url, document_type, file_size, is_active, ai_summary, ai_model, created_at, updated_at")
      .single();

    if (error) {
      logger.error("Policy doc upload: insert falló", new Error(error.message), {
        component: "policy-doc-upload",
        action: "insert.policy_doc",
      });
      return NextResponse.json({ error: "Error al registrar documento" }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    logger.error("API /api/policies/documents/upload error", err as Error, {
      component: "policy-doc-upload",
      action: "upload.policy_doc",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo subir el documento" },
      { status: 500 }
    );
  }
}
