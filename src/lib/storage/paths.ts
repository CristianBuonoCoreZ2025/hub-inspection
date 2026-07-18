/**
 * Estructura de carpetas en R2 para archivos del sistema.
 *
 * Ver PLAN.md para la estructura completa.
 *
 * Reglas:
 * - Los nombres de archivo se renombran al código (no se guarda el nombre original).
 * - El nombre original se guarda en la BD solo como referencia.
 * - Si se pierde la BD, los archivos se identifican por su nombre.
 */

// ═══ Sanitización ═══

export function sanitizeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// ═══ Configuración: plantillas de gestiones ═══

/**
 * Path para una plantilla de gestión en configuración.
 *
 * @param compositeCode — Código compuesto (línea + característica), ej: "HILI", "PCA"
 * @param templateSeq — Correlativo del template (5 dígitos), ej: "00001"
 * @param ext — Extensión del archivo, ej: ".docx"
 * @returns ej: "configuracion/gestiones/HILI/HILI-00001.docx"
 */
export function gestionTemplatePath(
  compositeCode: string,
  templateSeq: string,
  ext: string
): string {
  const code = sanitizeCode(compositeCode);
  const seq = templateSeq.padStart(5, "0");
  const filename = `${code}-${seq}${ext.startsWith(".") ? ext : "." + ext}`;
  return `configuracion/gestiones/${code}/${filename}`;
}

// ═══ Siniestros: documentos del siniestro ═══

/**
 * Path para un documento del siniestro (no de una gestión).
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param docSeq — Correlativo de documento (6 dígitos), ej: "000001"
 * @param ext — Extensión, ej: ".pdf"
 * @returns ej: "siniestros/L-000000001/documentos/L-000000001-DOC-000001.pdf"
 */
export function claimDocumentPath(
  liquidationNumber: string,
  docSeq: string,
  ext: string
): string {
  const seq = docSeq.padStart(6, "0");
  const filename = `${liquidationNumber}-DOC-${seq}${ext.startsWith(".") ? ext : "." + ext}`;
  return `siniestros/${liquidationNumber}/documentos/${filename}`;
}

// ═══ Siniestros: gestiones ═══

/**
 * Genera el código de una instancia de gestión dentro de un siniestro.
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param compositeCode — Código compuesto de la gestión, ej: "HINS", "HILI"
 * @param instanceSeq — Correlativo de la instancia (4 dígitos), ej: "0001"
 * @returns ej: "L-000000001-HINS-0001"
 */
export function gestionInstanceCode(
  liquidationNumber: string,
  compositeCode: string,
  instanceSeq: string
): string {
  const code = sanitizeCode(compositeCode);
  const seq = instanceSeq.padStart(4, "0");
  return `${liquidationNumber}-${code}-${seq}`;
}

/**
 * Path base para una instancia de gestión dentro de un siniestro.
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param compositeCode — ej: "HINS"
 * @param instanceSeq — ej: "0001"
 * @returns ej: "siniestros/L-000000001/gestiones/L-000000001-HINS-0001"
 */
export function gestionInstanceBasePath(
  liquidationNumber: string,
  compositeCode: string,
  instanceSeq: string
): string {
  const instanceCode = gestionInstanceCode(liquidationNumber, compositeCode, instanceSeq);
  return `siniestros/${liquidationNumber}/gestiones/${instanceCode}`;
}

/**
 * Path para el documento principal generado desde template en una gestión.
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param compositeCode — ej: "HILI"
 * @param instanceSeq — ej: "0001"
 * @param ext — ej: ".docx"
 * @returns ej: "siniestros/L-000000001/gestiones/L-000000001-HILI-0001/L-000000001-HILI-0001.docx"
 */
export function gestionDocumentPath(
  liquidationNumber: string,
  compositeCode: string,
  instanceSeq: string,
  ext: string
): string {
  const base = gestionInstanceBasePath(liquidationNumber, compositeCode, instanceSeq);
  const instanceCode = gestionInstanceCode(liquidationNumber, compositeCode, instanceSeq);
  const filename = `${instanceCode}${ext.startsWith(".") ? ext : "." + ext}`;
  return `${base}/${filename}`;
}

/**
 * Path para un documento extra subido a una gestión (no desde template).
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param compositeCode — ej: "HINS"
 * @param instanceSeq — ej: "0001"
 * @param docSeq — Correlativo de doc extra (4 dígitos), ej: "0001"
 * @param ext — ej: ".pdf"
 * @returns ej: "siniestros/L-000000001/gestiones/L-000000001-HINS-0001/documentos/L-000000001-HINS-0001-DOC-0001.pdf"
 */
export function gestionExtraDocumentPath(
  liquidationNumber: string,
  compositeCode: string,
  instanceSeq: string,
  docSeq: string,
  ext: string
): string {
  const base = gestionInstanceBasePath(liquidationNumber, compositeCode, instanceSeq);
  const instanceCode = gestionInstanceCode(liquidationNumber, compositeCode, instanceSeq);
  const seq = docSeq.padStart(4, "0");
  const filename = `${instanceCode}-DOC-${seq}${ext.startsWith(".") ? ext : "." + ext}`;
  return `${base}/documentos/${filename}`;
}

/**
 * Path para una imagen de una gestión (evidencia, daño, firma).
 *
 * @param liquidationNumber — ej: "L-000000001"
 * @param compositeCode — ej: "HINS"
 * @param instanceSeq — ej: "0001"
 * @param type — Tipo de imagen: "EVI", "DAN", "FIR"
 * @param imgSeq — Correlativo (4 dígitos), ej: "0001"
 * @param ext — ej: ".jpg"
 * @returns ej: "siniestros/L-000000001/gestiones/L-000000001-HINS-0001/imagenes/L-000000001-HINS-0001-EVI-0001.jpg"
 */
export function gestionImagePath(
  liquidationNumber: string,
  compositeCode: string,
  instanceSeq: string,
  type: "EVI" | "DAN" | "FIR",
  imgSeq: string,
  ext: string
): string {
  const base = gestionInstanceBasePath(liquidationNumber, compositeCode, instanceSeq);
  const instanceCode = gestionInstanceCode(liquidationNumber, compositeCode, instanceSeq);
  const seq = imgSeq.padStart(4, "0");
  const filename = `${instanceCode}-${type}-${seq}${ext.startsWith(".") ? ext : "." + ext}`;
  return `${base}/imagenes/${filename}`;
}

// ═══ Pólizas: documentos ═══

/**
 * Path para un documento de una póliza.
 *
 * @param policyNumber — ej: "POL-2026-0001"
 * @param docSeq — Correlativo desde next_policy_doc_seq(), ej: 1
 * @param ext — ej: ".pdf"
 * @returns ej: "polizas/POL-2026-0001/documentos/POL-2026-0001-DOC-0001.pdf"
 */
export function policyDocumentPath(
  policyNumber: string,
  docSeq: number,
  ext: string
): string {
  const seq = String(docSeq).padStart(4, "0");
  const e = ext.startsWith(".") ? ext : "." + ext;
  const filename = `${policyNumber}-DOC-${seq}${e}`;
  return `polizas/${policyNumber}/documentos/${filename}`;
}

// ═══ Inspección: helpers que usan el actionCode completo del DB ═══
//
// El trigger set_claim_action_code() (migración 131) genera el código de la
// instancia con 3 dígitos de correlativo: "L-000000141-HINS-001".
// Estos helpers reciben ese código tal cual viene de la BD (sin re-padear)
// y construyen el path físico según el plan de PLAN.md.

/**
 * Path para una imagen de una gestión de inspección (evidencia, daño, firma).
 *
 * @param actionCode — Código de la gestión desde claim_actions.code, ej: "L-000000141-HINS-001"
 * @param liquidationNumber — ej: "L-000000141"
 * @param type — "EVI" | "DAN" | "FIR"
 * @param fileSeq — Correlativo desde next_file_seq(), ej: 1
 * @param ext — ej: ".jpg"
 * @returns ej: "siniestros/L-000000141/gestiones/L-000000141-HINS-001/imagenes/L-000000141-HINS-001-EVI-0001.jpg"
 */
export function inspectionImagePath(
  actionCode: string,
  liquidationNumber: string,
  type: "EVI" | "DAN" | "FIR",
  fileSeq: number,
  ext: string
): string {
  const seq = String(fileSeq).padStart(4, "0");
  const e = ext.startsWith(".") ? ext : "." + ext;
  const filename = `${actionCode}-${type}-${seq}${e}`;
  return `siniestros/${liquidationNumber}/gestiones/${actionCode}/imagenes/${filename}`;
}

/**
 * Path para un documento de una gestión de inspección (doc extra o croquis).
 *
 * @param actionCode — Código de la gestión desde claim_actions.code, ej: "L-000000141-HINS-001"
 * @param liquidationNumber — ej: "L-000000141"
 * @param docSeq — Correlativo desde next_file_seq(), ej: 1
 * @param ext — ej: ".png"
 * @param type — "DOC" (documento extra) o "CRO" (croquis). Default: "DOC"
 * @returns ej: "siniestros/L-000000141/gestiones/L-000000141-HINS-001/documentos/L-000000141-HINS-001-DOC-0001.png"
 *          o "siniestros/L-000000141/gestiones/L-000000141-HINS-001/documentos/L-000000141-HINS-001-CRO-0001.png"
 */
export function inspectionDocumentPath(
  actionCode: string,
  liquidationNumber: string,
  docSeq: number,
  ext: string,
  type: "DOC" | "CRO" = "DOC"
): string {
  const seq = String(docSeq).padStart(4, "0");
  const e = ext.startsWith(".") ? ext : "." + ext;
  const filename = `${actionCode}-${type}-${seq}${e}`;
  return `siniestros/${liquidationNumber}/gestiones/${actionCode}/documentos/${filename}`;
}

// ═══ Empresas ═══

/**
 * Path para el logo de una empresa/cliente.
 */
export function companyLogoPath(companyId: string, ext: string): string {
  const e = ext.startsWith(".") ? ext : "." + ext;
  return `empresas/${companyId}/logos/logo${e}`;
}
