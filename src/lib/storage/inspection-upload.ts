import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "./r2-upload";
import { inspectionImagePath, inspectionDocumentPath } from "./paths";
import { logger } from "@/lib/logger";

/**
 * Contexto de almacenamiento resuelto desde una sesión de inspección.
 * Contiene todo lo necesario para construir el path físico en R2.
 */
export interface InspectionStorageContext {
  claimActionId: string;
  actionCode: string;           // ej: "L-000000141-HINS-001"
  liquidationNumber: string;    // ej: "L-000000141"
}

/**
 * Tipo de archivo de inspección para el correlativo.
 *  EVI = evidencia (foto, video, pdf)
 *  DOC = documento extra (croquis, oficio)
 *  FIR = firma
 *  DAN = foto de daño
 */
export type InspectionFileType = "EVI" | "DOC" | "FIR" | "DAN";

/**
 * Resuelve el contexto de almacenamiento desde un sessionId.
 *
 * Va de inspection_sessions → claim_actions (code) + claims (liquidation_number).
 * El claim_actions.code ya tiene el formato "L-000000141-HINS-001" (generado por
 * el trigger set_claim_action_code de la migración 131).
 */
export async function resolveInspectionStorageContext(
  sessionId: string
): Promise<InspectionStorageContext> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("inspection_sessions")
    .select(
      "id, claim_action_id, claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(id, code), claim:claims!inspection_sessions_claim_id_fkey(liquidation_number)"
    )
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error(`No se pudo resolver la sesión ${sessionId}: ${error?.message ?? "no data"}`);
  }

  const claimAction = data.claim_action as unknown as { id: string; code: string } | null;
  const claim = data.claim as unknown as { liquidation_number: string } | null;

  if (!claimAction?.id || !claimAction?.code) {
    throw new Error(
      `La sesión ${sessionId} no tiene claim_action asociado. ` +
      "La inspección debe nacer de una gestión INS del siniestro (workflow)."
    );
  }

  if (!claim?.liquidation_number) {
    throw new Error(`El siniestro de la sesión ${sessionId} no tiene liquidation_number.`);
  }

  return {
    claimActionId: claimAction.id,
    actionCode: claimAction.code,
    liquidationNumber: claim.liquidation_number,
  };
}

/**
 * Obtiene el siguiente correlativo atómico para un archivo de una gestión.
 * Llama a la función SQL next_file_seq(claim_action_id, file_type).
 */
export async function nextFileSeq(
  claimActionId: string,
  fileType: InspectionFileType
): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("next_file_seq", {
    p_claim_action_id: claimActionId,
    p_file_type: fileType,
  });

  if (error || data === null || data === undefined) {
    throw new Error(`No se pudo obtener correlativo ${fileType}: ${error?.message ?? "sin dato"}`);
  }

  return data as number;
}

/**
 * Sube un archivo de inspección a R2 con el path estructurado del plan.
 *
 * 1. Resuelve el contexto (actionCode + liquidationNumber) desde sessionId
 * 2. Obtiene el siguiente correlativo (EVI/DOC/FIR/DAN) atómico desde la BD
 * 3. Construye el path físico: siniestros/{L}/gestiones/{code}/imagenes|documentos/{code}-TYPE-NNNN.ext
 * 4. Sube el buffer a R2
 *
 * @returns { url, key, seq } — URL pública, key en R2, y correlativo usado
 */
export async function uploadInspectionFile(
  sessionId: string,
  buffer: Buffer,
  contentType: string,
  fileType: InspectionFileType,
  ext: string
): Promise<{ url: string; key: string; seq: number }> {
  const ctx = await resolveInspectionStorageContext(sessionId);
  const seq = await nextFileSeq(ctx.claimActionId, fileType);

  const key =
    fileType === "DOC"
      ? inspectionDocumentPath(ctx.actionCode, ctx.liquidationNumber, seq, ext)
      : inspectionImagePath(ctx.actionCode, ctx.liquidationNumber, fileType, seq, ext);

  const url = await uploadToR2(buffer, key, contentType);

  logger.info("Archivo de inspección subido", {
    component: "inspection-upload",
    action: "inspection.file.upload",
    metadata: { sessionId, actionCode: ctx.actionCode, fileType, seq, key, size: buffer.length },
  });

  return { url, key, seq };
}
