// ═══════════════════════════════════════════════════════════════
// Esquema de campos para Carga de Casos (sistema distinto)
// ═══════════════════════════════════════════════════════════════
// Define los 30 campos del Excel de Casos con sus sinónimos
// para autodetección de columnas. Reutiliza las funciones de
// normalización y matching del schema genérico.
// ═══════════════════════════════════════════════════════════════

import {
  type ClaimField,
  type ColumnMapping,
  type RowError,
  normalize,
  parseDate,
} from "./schema";

// Re-exportar tipos que la página necesita
export type { ColumnMapping, RowError };

// ═══════════════════════════════════════════════════════════════
// Campos del Excel de Casos
// ═══════════════════════════════════════════════════════════════

export const CASOS_FIELDS: ClaimField[] = [
  // ── Requeridos ──
  {
    key: "clientReference",
    label: "Referencia",
    required: true,
    description: "N° de referencia del cliente",
    synonyms: ["referencia", "ref", "reference", "client reference", "client_reference"],
  },
  {
    key: "insuranceCompany",
    label: "Compañía de Seguros",
    required: true,
    description: "Nombre de la compañía de seguros (se resuelve por nombre en catálogo)",
    synonyms: ["compañia seguro", "compania seguro", "compañía seguro", "cia seguro", "compañia de seguro", "compañía de seguro", "insurance company"],
  },
  {
    key: "claimNumber",
    label: "N° Siniestro",
    required: true,
    description: "Número del siniestro",
    synonyms: ["numero siniestro", "n siniestro", "nro siniestro", "num siniestro", "n° siniestro", "siniestro", "claim number", "claim_number"],
  },
  {
    key: "insuredName",
    label: "Nombre Asegurado",
    required: true,
    description: "Nombre del asegurado (usar ASEG_NOMBRE, no ASEGURADO completo)",
    synonyms: ["aseg nombre", "aseg_nombre", "nombre asegurado", "asegurado", "nombre", "insured name"],
  },
  {
    key: "claimDate",
    label: "Fecha Siniestro",
    required: true,
    type: "date",
    description: "Fecha del siniestro (serial Excel o fecha)",
    synonyms: ["fecha siniestro", "f siniestro", "fecha del siniestro", "claim date", "claim_date"],
  },
  {
    key: "claimAddress",
    label: "Dirección Siniestro",
    required: true,
    description: "Dirección del siniestro",
    synonyms: ["direccion siniestro", "dirección siniestro", "domicilio siniestro", "lugar siniestro", "claim address", "claim_address"],
  },
  {
    key: "commune",
    label: "Comuna",
    required: true,
    description: "Comuna del siniestro (se resuelve jerarquía completa: ciudad, región, país)",
    synonyms: ["comuna", "commune", "comuna siniestro", "comuna del siniestro"],
  },
  // ── Opcionales ──
  {
    key: "policyNumber",
    label: "N° Póliza",
    required: false,
    description: "Número de póliza. Si está vacío se setea 'SIN NUMERO'",
    synonyms: ["numero poliza", "n poliza", "nro poliza", "num poliza", "n° poliza", "poliza", "póliza", "policy number", "policy_number"],
  },
  {
    key: "broker",
    label: "Corredor",
    required: false,
    description: "Nombre del corredor (se resuelve a broker_id)",
    synonyms: ["corredor", "broker", "broker name", "nombre corredor"],
  },
  {
    key: "rut",
    label: "RUT Asegurado",
    required: false,
    synonyms: ["rut asegurado", "rut", "rut_asegurado", "documento"],
  },
  {
    key: "insuredAddress",
    label: "Dirección Asegurado",
    required: false,
    description: "Si está vacía, se usa la dirección del siniestro",
    synonyms: ["direccion asegurado", "dirección asegurado", "domicilio asegurado", "insured address", "insured_address"],
  },
  {
    key: "beneficiaryName",
    label: "Beneficiario",
    required: false,
    description: "Nombre del beneficiario (se replica desde asegurado si está vacío)",
    synonyms: ["beneficiario", "beneficiary", "beneficiary name", "nombre beneficiario"],
  },
  {
    key: "city",
    label: "Ciudad",
    required: false,
    description: "Ciudad (se ignora si no coincide con la de la comuna)",
    synonyms: ["ciudad", "city"],
  },
  {
    key: "insuredPhone",
    label: "Teléfono",
    required: false,
    synonyms: ["fono", "telefono", "teléfono", "phone", "tel", "fono asegurado"],
  },
  {
    key: "insuredEmail",
    label: "E-mail Asegurado",
    required: false,
    synonyms: ["mail asegurado", "email asegurado", "e-mail asegurado", "correo asegurado", "mail", "email", "observaciones"],
  },
  {
    key: "businessLine",
    label: "Ramo",
    required: false,
    description: "Línea de negocio (se resuelve a business_line_id)",
    synonyms: ["ramo", "linea negocio", "línea negocio", "business line", "business_line"],
  },
  {
    key: "insuranceProduct",
    label: "Ramo/Producto",
    required: false,
    description: "Producto de seguro (se resuelve a insurance_product_id)",
    synonyms: ["ramo producto", "ramo/producto", "producto", "insurance product", "insurance_product", "producto seguro"],
  },
  {
    key: "adjuster",
    label: "Ajustador/Liquidador",
    required: false,
    description: "Nombre del ajustador/liquidador (se resuelve a adjuster_id via profiles)",
    synonyms: ["ajustador", "liquidador", "adjuster", "nombre ajustador", "nombre liquidador"],
  },
  {
    key: "claimType",
    label: "Tipo Riesgo",
    required: false,
    description: "Tipo de siniestro (ej: property)",
    synonyms: ["tip rie", "tipo rie", "tipo riesgo", "tipo siniestro", "claim type", "claim_type"],
  },
  {
    key: "area",
    label: "Área",
    required: false,
    description: "Área (ej: RAMOS VARIOS). Va a notes.",
    synonyms: ["area", "área"],
  },
  {
    key: "inspector",
    label: "Inspector",
    required: false,
    description: "Nombre del inspector (se resuelve a inspector_id via profiles)",
    synonyms: ["inspector", "nombre inspector"],
  },
  {
    key: "event",
    label: "Evento Catastrófico",
    required: false,
    description: "Nombre del evento (se resuelve a event_id)",
    synonyms: ["evento cat", "evento", "event", "evento catastrofico", "evento catastrófico"],
  },
  {
    key: "summary",
    label: "Resumen",
    required: false,
    synonyms: ["resumen", "summary", "descripcion", "descripción", "detalle"],
  },
  {
    key: "currency",
    label: "Moneda",
    required: false,
    description: "Moneda (UF, CLP, etc.) — se resuelve a currency_id",
    synonyms: ["moneda", "currency", "tipo moneda"],
  },
  {
    key: "reportDate",
    label: "Fecha Denuncio",
    required: false,
    type: "date",
    synonyms: ["fecha denuncio", "fecha denuncia", "f denuncio", "report date", "report_date"],
  },
  {
    key: "assignmentDate",
    label: "Fecha Asignación",
    required: false,
    type: "date",
    description: "Si está vacía, se usa la fecha de denuncio",
    synonyms: ["fecha asignacion", "fecha asignación", "f asignacion", "assignment date", "assignment_date"],
  },
  {
    key: "policyPremium",
    label: "Prima",
    required: false,
    type: "number",
    synonyms: ["prima", "policy premium", "policy_premium", "valor prima"],
  },
  {
    key: "contactName",
    label: "Nombre Contacto",
    required: false,
    description: "Nombre del contacto/siniestrado",
    synonyms: ["nombre contacto", "contacto", "contact name", "contact_name"],
  },
  {
    key: "policyStartDate",
    label: "Vigencia Inicial",
    required: false,
    type: "date",
    synonyms: ["vigencia inicial", "vigencia inicio", "policy start date", "policy_start_date", "inicio vigencia"],
  },
  {
    key: "policyEndDate",
    label: "Vigencia Final",
    required: false,
    type: "date",
    synonyms: ["vigencia final", "vigencia fin", "policy end date", "policy_end_date", "fin vigencia", "vencimiento"],
  },
  {
    key: "lastName",
    label: "Apellido Asegurado",
    required: false,
    description: "Apellido del asegurado (usar ASEG_APELLIDO)",
    synonyms: ["aseg apellido", "aseg_apellido", "apellido asegurado", "apellido", "apellidos", "last name", "last_name"],
  },
  {
    key: "claimCause",
    label: "Causal Ingresada",
    required: false,
    description: "Causal del siniestro (se resuelve a claim_cause_id)",
    synonyms: ["causa ingresada", "causal ingresada", "causa", "causal", "claim cause", "claim_cause"],
  },
  {
    key: "estado",
    label: "Estado",
    required: false,
    description: "Estado del siniestro (ej: Liquidacion). Si viene, se usa para setear el status_id directamente.",
    synonyms: ["estado", "status", "state"],
  },
];

export const CASOS_REQUIRED_FIELDS = CASOS_FIELDS.filter((f) => f.required);
export const CASOS_OPTIONAL_FIELDS = CASOS_FIELDS.filter((f) => !f.required);

// ═══════════════════════════════════════════════════════════════
// Autodetección de mapeo (específica para Casos)
// ═══════════════════════════════════════════════════════════════

/**
 * Mapeo aprendido de una empresa: excel_header → field_key
 */
export interface LearnedCasosFieldMapping {
  excel_header: string;
  field_key: string;
  times_used: number;
}

/**
 * Dados los headers del Excel de Casos, autodetecta qué columna
 * mapea a qué campo del sistema usando los sinónimos definidos.
 * Si se pasan mapeos aprendidos, se usan primero (confianza máxima).
 */
export function autoDetectCasosMapping(
  excelHeaders: string[],
  learnedMappings?: LearnedCasosFieldMapping[],
): Record<string, ColumnMapping> {
  const normalizedHeaders = excelHeaders.map((h) => ({
    original: h,
    normalized: normalize(h),
  }));
  const usedHeaders = new Set<string>();
  const mapping: Record<string, ColumnMapping> = {};

  // ── Pasada 0: mapeos aprendidos de la empresa (confianza máxima) ──
  if (learnedMappings && learnedMappings.length > 0) {
    const sorted = [...learnedMappings].sort((a, b) => b.times_used - a.times_used);
    for (const learned of sorted) {
      const match = normalizedHeaders.find(
        ({ original, normalized }) =>
          !usedHeaders.has(original) &&
          (original === learned.excel_header || normalized === normalize(learned.excel_header))
      );
      if (match) {
        const field = CASOS_FIELDS.find((f) => f.key === learned.field_key);
        if (field) {
          mapping[field.key] = {
            fieldKey: field.key,
            excelHeader: match.original,
            autoDetected: true,
            confidence: 1,
          };
          usedHeaders.add(match.original);
        }
      }
    }
  }

  // Pasada 1: match exacto de sinónimos
  for (const field of CASOS_FIELDS) {
    const synonyms = field.synonyms.map(normalize);
    let bestMatch: { header: string; confidence: number } | null = null;

    for (const { original, normalized } of normalizedHeaders) {
      if (usedHeaders.has(original)) continue;
      if (synonyms.includes(normalized)) {
        bestMatch = { header: original, confidence: 1 };
        break;
      }
    }

    if (bestMatch) {
      mapping[field.key] = {
        fieldKey: field.key,
        excelHeader: bestMatch.header,
        autoDetected: true,
        confidence: bestMatch.confidence,
      };
      usedHeaders.add(bestMatch.header);
    }
  }

  // Pasada 2: fuzzy matching para campos sin match exacto
  for (const field of CASOS_FIELDS) {
    if (mapping[field.key]) continue;
    const synonyms = field.synonyms.map(normalize);
    let best: { header: string; score: number } | null = null;

    for (const { original, normalized } of normalizedHeaders) {
      if (usedHeaders.has(original)) continue;
      const score = bestSimilarity(normalized, synonyms);
      if (score > 0.6 && (!best || score > best.score)) {
        best = { header: original, score };
      }
    }

    if (best) {
      mapping[field.key] = {
        fieldKey: field.key,
        excelHeader: best.header,
        autoDetected: true,
        confidence: best.score,
      };
      usedHeaders.add(best.header);
    } else {
      mapping[field.key] = {
        fieldKey: null,
        excelHeader: "",
        autoDetected: false,
        confidence: 0,
      };
    }
  }

  return mapping;
}

function bestSimilarity(s: string, synonyms: string[]): number {
  let max = 0;
  for (const syn of synonyms) {
    const score = similarity(s, syn);
    if (score > max) max = score;
  }
  return max;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.7 + 0.3 * (shorter / longer);
  }
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return 0.5 * jaccard + 0.5 * lev;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// ═══════════════════════════════════════════════════════════════
// Validación y aplicación de mapeo
// ═══════════════════════════════════════════════════════════════

/**
 * Valida una fila del Excel de Casos usando el mapeo activo.
 */
export function validateCasosRow(
  row: Record<string, unknown>,
  mapping: Record<string, ColumnMapping>,
): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  for (const field of CASOS_FIELDS) {
    if (!field.required) continue;

    const m = mapping[field.key];
    const value = row[field.key];

    if (!m || !m.fieldKey || !m.excelHeader) {
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "missing_column",
        message: `Falta "${field.label}" — no hay columna mapeada.`,
      });
      continue;
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      // clientReference y claimNumber: si están vacíos, setear a "0"
      if (field.key === "clientReference" || field.key === "claimNumber") {
        row[field.key] = "0";
        continue;
      }
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "empty_value",
        message: `Falta "${field.label}" — la columna "${m.excelHeader}" está vacía en esta fila.`,
      });
      continue;
    }

    if (field.key === "claimDate") {
      const parsed = parseDate(String(value));
      if (!parsed) {
        errors.push({
          fieldKey: field.key,
          fieldLabel: field.label,
          kind: "invalid_value",
          message: `"${field.label}" inválido: "${value}" no es una fecha reconocida.`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Aplica el mapeo a una fila cruda del Excel de Casos.
 */
export function applyCasosMapping(
  raw: Record<string, string | number | null>,
  mapping: Record<string, ColumnMapping>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of CASOS_FIELDS) {
    const m = mapping[field.key];
    if (m && m.excelHeader) {
      const val = raw[m.excelHeader];
      data[field.key] = val !== undefined && val !== null ? String(val).trim() : "";
    } else {
      data[field.key] = "";
    }
  }

  // Normalizar fechas (incluye conversión de serial Excel)
  for (const dateField of ["claimDate", "reportDate", "policyStartDate", "policyEndDate"]) {
    if (data[dateField] && typeof data[dateField] === "string") {
      const parsed = parseDate(data[dateField]);
      if (parsed) data[dateField] = parsed;
    }
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
// Separación de nombre y apellido
// ═══════════════════════════════════════════════════════════════

/**
 * Separa un nombre completo en (firstName, lastName).
 * Regla: las últimas 2 palabras son apellidos, el resto es nombre.
 *  - 1 palabra  → firstName=word, lastName=""
 *  - 2 palabras → firstName=word[0], lastName=word[1]
 *  - 3 palabras → firstName=word[0], lastName=word[1]+word[2]
 *  - 4+ palabras → firstName=word[0..n-3], lastName=word[n-2]+word[n-1]
 *
 * Si se pasa un override (ej: desde persons table), se usa ese directo.
 */
export function splitInsuredName(
  fullName: string,
  override?: { first_name: string | null; last_name: string | null } | null,
): { firstName: string; lastName: string } {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };

  // Si hay override desde persons table, usarlo
  if (override && (override.first_name || override.last_name)) {
    return {
      firstName: override.first_name || "",
      lastName: override.last_name || "",
    };
  }

  const words = trimmed.split(/\s+/);
  if (words.length === 1) return { firstName: words[0], lastName: "" };
  if (words.length === 2) return { firstName: words[0], lastName: words[1] };

  // 3+ palabras: últimas 2 = apellido, resto = nombre
  const lastName = words.slice(-2).join(" ");
  const firstName = words.slice(0, -2).join(" ");
  return { firstName, lastName };
}
