import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "./r2-upload";
import { claimDocumentPath } from "./paths";
import { logger } from "@/lib/logger";

/**
 * Sube un documento del siniestro a R2 con el path estructurado del plan.
 *
 * Path: siniestros/{L}/documentos/{L}-DOC-NNNNNN.ext
 *
 * 1. Resuelve claimId → liquidation_number
 * 2. Obtiene el siguiente correlativo DOC-NNNNNN atómico desde la BD
 * 3. Construye el path físico
 * 4. Sube el buffer a R2
 *
 * @returns { url, key, seq, docCode } — URL pública, key en R2, correlativo, código del documento
 */
export async function uploadClaimDocument(
  claimId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; key: string; seq: number; docCode: string }> {
  const supabase = createAdminClient();

  // 1. Resolver liquidation_number
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("liquidation_number")
    .eq("id", claimId)
    .single();

  if (claimError || !claim?.liquidation_number) {
    throw new Error(
      `No se pudo resolver el siniestro ${claimId}: ${claimError?.message ?? "sin liquidation_number"}`
    );
  }

  const liquidationNumber = claim.liquidation_number;

  // 2. Obtener siguiente correlativo
  const { data: seq, error: seqError } = await supabase.rpc("next_claim_doc_seq", {
    p_claim_id: claimId,
  });

  if (seqError || seq === null || seq === undefined) {
    throw new Error(`No se pudo obtener correlativo DOC: ${seqError?.message ?? "sin dato"}`);
  }

  const seqNum = seq as number;

  // 3. Construir path
  const key = claimDocumentPath(liquidationNumber, String(seqNum), ext);
  const docCode = `${liquidationNumber}-DOC-${String(seqNum).padStart(6, "0")}`;

  // 4. Subir a R2
  const url = await uploadToR2(buffer, key, contentType);

  logger.info("Documento de siniestro subido", {
    component: "claim-upload",
    action: "claim.doc.upload",
    metadata: { claimId, liquidationNumber, docCode, seq: seqNum, key, size: buffer.length },
  });

  return { url, key, seq: seqNum, docCode };
}
