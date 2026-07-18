import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "./r2-upload";
import { policyDocumentPath } from "./paths";
import { optimizeFile } from "./optimize";
import { logger } from "@/lib/logger";

/**
 * Sube un documento de póliza a R2 con el path estructurado del plan.
 *
 * Path: policies/{policy_number}/documents/{policy_number}-DOC-NNNN.ext
 *
 * 1. Resuelve policyId → policy_number
 * 2. Obtiene el siguiente correlativo DOC-NNNN atómico desde la BD
 * 3. Construye el path físico
 * 4. Sube el buffer a R2
 *
 * @returns { url, key, seq, docCode }
 */
export async function uploadPolicyDocument(
  policyId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; key: string; seq: number; docCode: string }> {
  const supabase = createAdminClient();

  // 1. Resolver policy_number
  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("policy_number")
    .eq("id", policyId)
    .single();

  if (policyError || !policy?.policy_number) {
    throw new Error(
      `No se pudo resolver la póliza ${policyId}: ${policyError?.message ?? "sin policy_number"}`
    );
  }

  const policyNumber = policy.policy_number;

  // 2. Obtener siguiente correlativo
  const { data: seq, error: seqError } = await supabase.rpc("next_policy_doc_seq", {
    p_policy_id: policyId,
  });

  if (seqError || seq === null || seq === undefined) {
    throw new Error(`No se pudo obtener correlativo DOC: ${seqError?.message ?? "sin dato"}`);
  }

  const seqNum = seq as number;

  // 3. Optimizar el archivo antes de subir (imágenes se redimensionan y comprimen)
  const optimized = await optimizeFile(buffer, contentType, ext);

  // 4. Construir path
  const key = policyDocumentPath(policyNumber, seqNum, optimized.ext);
  const docCode = `${policyNumber}-DOC-${String(seqNum).padStart(4, "0")}`;

  // 5. Subir a R2
  const url = await uploadToR2(optimized.buffer, key, optimized.mimeType);

  logger.info("Documento de póliza subido", {
    component: "policy-upload",
    action: "policy.doc.upload",
    metadata: {
      policyId,
      policyNumber,
      docCode,
      seq: seqNum,
      key,
      originalSize: buffer.length,
      optimizedSize: optimized.buffer.length,
    },
  });

  return { url, key, seq: seqNum, docCode };
}
