import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadPolicyDocument } from "@/lib/storage/policy-upload";
import { summarizeFile } from "@/lib/ai/openrouter";
import { logger } from "@/lib/logger";

/**
 * API route para subir un documento de póliza a Cloudflare R2.
 *
 * Recibe multipart/form-data:
 *   - file: el archivo
 *   - policyId: UUID de la póliza
 *
 * Flujo:
 *  1. Resuelve policyId → policy.policy_number
 *  2. Obtiene el siguiente correlativo DOC-NNNN atómico desde la BD
 *  3. Sube a R2 con path: policies/{policy_number}/documents/{policy_number}-DOC-NNNN.ext
 *  4. Inserta el registro en policy_documents
 *
 * Devuelve: { document: { id, document_name, document_url, ... } }
 */
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

    // ── IA: resumen automático (free → paid) ──
    let aiSummary: string | null = null;
    let aiModel: string | null = null;
    try {
      const ai = await summarizeFile(buffer, mimeType, file.name);
      if (ai.ok) {
        aiSummary = ai.summary;
        aiModel = ai.model;
        logger.info("IA: resumen de documento de póliza generado", {
          component: "policy-doc-upload",
          action: "ai.summary",
          metadata: { model: ai.model, summaryLength: ai.summary.length },
        });
      } else {
        logger.warn("IA: documento de póliza no procesado", {
          component: "policy-doc-upload",
          action: "ai.summary.skipped",
          metadata: { mimeType, reason: ai.reason },
        });
      }
    } catch (aiErr) {
      logger.warn("IA: no se pudo generar resumen de póliza", {
        component: "policy-doc-upload",
        action: "ai.summary.error",
        metadata: { error: aiErr instanceof Error ? aiErr.message : String(aiErr) },
      });
    }

    // Insertar en policy_documents
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
        ai_summary: aiSummary,
        ai_model: aiModel,
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
