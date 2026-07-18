import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadToR2 } from "./r2-upload";
import { gestionTemplatePath } from "./paths";
import { optimizeFile } from "./optimize";
import { logger } from "@/lib/logger";

/**
 * Resuelve el código compuesto de un action_template.
 *
 * compositeCode = business_lines.code_letter + action_template.code
 * Ej: "H" + "INS" = "HINS", "H" + "ILI" = "HILI"
 * Si no tiene línea de negocio (aplica a todas), es solo el code: "PCA"
 *
 * @param actionTemplateId — UUID del action_template
 * @returns { compositeCode, templateCode } — ej: { compositeCode: "HINS", templateCode: "INS" }
 */
export async function resolveCompositeCode(
  actionTemplateId: string
): Promise<{ compositeCode: string; templateCode: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("action_template")
    .select(
      "id, code, business_lines:business_lines!action_template_line_business_id_fkey(code_letter)"
    )
    .eq("id", actionTemplateId)
    .single();

  if (error || !data) {
    throw new Error(
      `No se pudo resolver el action_template ${actionTemplateId}: ${error?.message ?? "no data"}`
    );
  }

  const templateCode = (data.code as string) || "GEN";
  const lineLetter = (data.business_lines as unknown as { code_letter: string } | null)?.code_letter;

  const compositeCode = lineLetter ? `${lineLetter}${templateCode}` : templateCode;

  return { compositeCode, templateCode };
}

/**
 * Sube un template de gestión a R2 con el path estructurado del plan.
 *
 * Path: config/actions/{CODIGO_COMPUESTO}/{CODIGO_COMPUESTO}-NNNNN.docx
 *
 * 1. Resuelve actionTemplateId → compositeCode
 * 2. Obtiene el siguiente correlativo NNNNN atómico desde la BD
 * 3. Construye el path físico
 * 4. Sube el buffer a R2
 *
 * @returns { url, key, seq, templateCode }
 */
export async function uploadGestionTemplate(
  actionTemplateId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<{ url: string; key: string; seq: number; templateCode: string }> {
  const { compositeCode } = await resolveCompositeCode(actionTemplateId);

  const supabase = createAdminClient();

  // 2. Obtener siguiente correlativo
  const { data: seq, error: seqError } = await supabase.rpc("next_template_seq", {
    p_composite_code: compositeCode,
  });

  if (seqError || seq === null || seq === undefined) {
    throw new Error(`No se pudo obtener correlativo de template: ${seqError?.message ?? "sin dato"}`);
  }

  const seqNum = seq as number;

  // 3. Optimizar el archivo antes de subir (imágenes se redimensionan y comprimen)
  // Para .docx el helper pasa sin cambios — solo optimiza imágenes
  const optimized = await optimizeFile(buffer, contentType, ext);

  // 4. Construir path
  const key = gestionTemplatePath(compositeCode, String(seqNum), optimized.ext);

  // 5. Subir a R2
  const url = await uploadToR2(optimized.buffer, key, optimized.mimeType);

  logger.info("Template de gestión subido", {
    component: "template-upload",
    action: "template.upload",
    metadata: {
      actionTemplateId,
      compositeCode,
      seq: seqNum,
      key,
      originalSize: buffer.length,
      optimizedSize: optimized.buffer.length,
    },
  });

  return { url, key, seq: seqNum, templateCode: compositeCode };
}
