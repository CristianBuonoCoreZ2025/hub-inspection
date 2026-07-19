import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "./r2-upload";
import { claimDocumentPath, claimImagePath } from "./paths";
import { optimizeFile } from "./optimize";
import { logger } from "@/lib/logger";

/**
 * Sube un documento del siniestro a R2 con el path estructurado del plan.
 *
 * Path: claims/{L}/documents/{L}-DOC-NNNNNN.ext
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

  // 3. Optimizar el archivo antes de subir (imágenes se redimensionan y comprimen)
  const optimized = await optimizeFile(buffer, contentType, ext);

  // 4. Construir path
  const key = claimDocumentPath(liquidationNumber, String(seqNum), optimized.ext);
  const docCode = `${liquidationNumber}-DOC-${String(seqNum).padStart(6, "0")}`;

  // 5. Subir a R2
  const url = await uploadToR2(optimized.buffer, key, optimized.mimeType);

  logger.info("Documento de siniestro subido", {
    component: "claim-upload",
    action: "claim.doc.upload",
    metadata: {
      claimId,
      liquidationNumber,
      docCode,
      seq: seqNum,
      key,
      originalSize: buffer.length,
      optimizedSize: optimized.buffer.length,
    },
  });

  return { url, key, seq: seqNum, docCode };
}

/**
 * Sube una imagen del siniestro a R2 SIN optimizar (raw, rápido).
 *
 * Path: claims/{L}/images/{L}-IMG-NNNNNN.ext
 *
 * 1. Resuelve claimId → liquidation_number
 * 2. Obtiene el siguiente correlativo IMG-NNNNNN atómico desde la BD
 * 3. Construye el path físico
 * 4. Sube el buffer original a R2 (sin optimizar)
 *
 * @returns { url, key, seq, imgCode } — URL pública, key en R2, correlativo, código de la imagen
 */
export async function uploadClaimImageRaw(
  claimId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; key: string; seq: number; imgCode: string }> {
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

  // 2. Obtener siguiente correlativo IMG
  const { data: seq, error: seqError } = await supabase.rpc("next_claim_image_seq", {
    p_claim_id: claimId,
  });

  if (seqError || seq === null || seq === undefined) {
    throw new Error(`No se pudo obtener correlativo IMG: ${seqError?.message ?? "sin dato"}`);
  }

  const seqNum = seq as number;

  // 3. Construir path (sin optimizar — usa la extensión original)
  const key = claimImagePath(liquidationNumber, String(seqNum), ext);
  const imgCode = `${liquidationNumber}-IMG-${String(seqNum).padStart(6, "0")}`;

  // 4. Subir a R2 (buffer original, sin optimizar)
  const url = await uploadToR2(buffer, key, contentType);

  logger.info("Imagen de siniestro subida (raw)", {
    component: "claim-upload",
    action: "claim.image.upload.raw",
    metadata: { claimId, liquidationNumber, imgCode, seq: seqNum, key, size: buffer.length },
  });

  return { url, key, seq: seqNum, imgCode };
}

/**
 * Re-sube una imagen optimizada a R2, reemplazando la versión raw.
 * Se usa después de la subida inicial para optimizar en background.
 *
 * @returns { url, key } — nueva URL y key en R2 (puede cambiar la extensión)
 */
export async function reuploadClaimImageOptimized(
  claimId: string,
  seq: number,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; key: string }> {
  const supabase = createAdminClient();

  // Resolver liquidation_number
  const { data: claim } = await supabase
    .from("claims")
    .select("liquidation_number")
    .eq("id", claimId)
    .single();

  if (!claim?.liquidation_number) {
    throw new Error(`No se pudo resolver el siniestro ${claimId}`);
  }

  // Optimizar
  const optimized = await optimizeFile(buffer, contentType, ext);

  // Construir path con la extensión optimizada
  const key = claimImagePath(claim.liquidation_number, String(seq), optimized.ext);

  // Subir a R2 (reemplaza el archivo anterior si la key es la misma)
  const url = await uploadToR2(optimized.buffer, key, optimized.mimeType);

  logger.info("Imagen de siniestro optimizada y re-subida", {
    component: "claim-upload",
    action: "claim.image.optimize",
    metadata: {
      claimId,
      seq,
      key,
      originalSize: buffer.length,
      optimizedSize: optimized.buffer.length,
    },
  });

  return { url, key };
}
