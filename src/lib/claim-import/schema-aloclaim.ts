// Campos de AloClaim (59 campos)

export type ClaimFieldType = "text" | "date" | "time" | "number" | "boolean" | "ref";

export interface ClaimField {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
  description?: string;
  type?: ClaimFieldType;
}

export const ALOCLAIM_FIELDS: ClaimField[] = [
  {
    key: "clientReference",
    label: "Referencia",
    required: true,
    synonyms: ["referencia", "ref", "reference", "client reference", "client_reference", "n referencia"],
  },
  {
    key: "claimNumber",
    label: "N° Siniestro",
    required: true,
    synonyms: ["no siniestro compañia", "no siniestro compañía", "n siniestro", "n° siniestro", "numero siniestro", "siniestro", "claim number", "claim_number", "num siniestro"],
  },
  {
    key: "insuranceCompany",
    label: "Compañía",
    required: true,
    synonyms: ["compañía", "compania", "compañia", "compañia de seguros", "compania de seguros", "cia seguros", "aseguradora", "insurance company", "empresa"],
  },
  {
    key: "claimType",
    label: "Tipo Siniestro",
    required: false,
    synonyms: ["tipo siniestro", "tipo de siniestro", "claim type", "claim_type", "categoria", "categoría", "tipo"],
  },
  {
    key: "businessLine",
    label: "Línea Negocio",
    required: false,
    synonyms: ["linea negocio", "línea negocio", "linea de negocio", "línea de negocio", "business line", "business_line", "ramo negocio"],
  },
  {
    key: "insuranceProduct",
    label: "Ramo/Producto",
    required: true,
    synonyms: ["ramo producto", "ramo/producto", "producto", "insurance product", "ramo", "producto seguros"],
  },
  {
    key: "event",
    label: "Evento",
    required: false,
    synonyms: ["evento", "event", "event_id", "tipo evento", "causa evento"],
  },
  {
    key: "claimDate",
    label: "Fecha Siniestro",
    required: true,
    type: "date",
    synonyms: ["fecha siniestro", "fecha del siniestro", "claim date", "claim_date", "fecha ocurrencia", "f siniestro"],
  },
  {
    key: "reportDate",
    label: "Fecha Denuncio",
    required: false,
    type: "date",
    synonyms: ["fecha denuncio", "fecha denuncia", "report date", "report_date", "denuncio", "f denuncio"],
  },
  {
    key: "assignmentDate",
    label: "Fecha Asignación",
    required: false,
    type: "date",
    synonyms: ["fecha asignacion", "fecha asignación", "assignment date", "assignment_date", "asignacion", "asignación", "f asignacion"],
  },
  {
    key: "currency",
    label: "Moneda Siniestro",
    required: false,
    synonyms: ["moneda siniestro", "moneda", "currency", "currency_id", "tipo moneda"],
  },
  {
    key: "claimCause",
    label: "Causal Siniestro",
    required: false,
    synonyms: ["causa ingresada", "causal ingresada", "causa", "causal", "claim cause", "claim_cause", "motivo", "origen"],
  },
  {
    key: "summary",
    label: "Resumen Siniestro",
    required: false,
    synonyms: ["resumen siniestro", "resumen", "descripción", "descripcion", "summary", "descripcion siniestro", "descripción siniestro", "detalle"],
  },
  {
    key: "rut",
    label: "RUT Asegurado",
    required: false,
    synonyms: ["rut asegurado", "rut", "rut_asegurado", "documento", "identificacion", "rut del asegurado"],
  },
  {
    key: "insuredName",
    label: "Nombre Asegurado",
    required: true,
    synonyms: ["nombre asegurado", "nombre", "asegurado", "insured name", "insured_name", "nombre del asegurado", "titular"],
  },
  {
    key: "lastName",
    label: "Apellido Asegurado",
    required: false,
    synonyms: ["apellido asegurado", "apellido", "apellidos", "last name", "last_name", "apellido del asegurado"],
  },
  {
    key: "insuredEmail",
    label: "E-mail Asegurado",
    required: false,
    synonyms: ["email asegurado", "e-mail asegurado", "correo asegurado", "email", "correo", "insured email", "insured_email", "e-mail", "mail asegurado"],
  },
  {
    key: "insuredPhone",
    label: "Teléfono Asegurado",
    required: false,
    synonyms: ["telefono asegurado", "teléfono asegurado", "fono asegurado", "teléfono", "telefono", "fono", "insured phone", "insured_phone", "celular asegurado", "celular", "móvil", "movil", "cell phone", "cell_phone"],
  },
  {
    key: "insuredAddress",
    label: "Dirección Asegurado",
    required: false,
    synonyms: ["direccion asegurado", "dirección asegurado", "domicilio asegurado", "direccion del asegurado", "dirección del asegurado", "calle asegurado"],
  },
  {
    key: "insuredCountry",
    label: "País Asegurado",
    required: false,
    synonyms: ["pais asegurado", "país asegurado", "país", "pais", "pais del asegurado"],
  },
  {
    key: "insuredRegion",
    label: "Región Asegurado",
    required: false,
    synonyms: ["region asegurado", "región asegurado", "región", "region", "provincia", "region del asegurado"],
  },
  {
    key: "insuredCity",
    label: "Ciudad Asegurado",
    required: false,
    synonyms: ["ciudad asegurado", "ciudad", "localidad", "poblacion", "ciudad del asegurado"],
  },
  {
    key: "insuredCommune",
    label: "Comuna Asegurado",
    required: false,
    synonyms: ["comuna asegurado", "comuna", "commune", "comuna del asegurado"],
  },
  {
    key: "policyNumber",
    label: "Número Póliza",
    required: true,
    synonyms: ["numero poliza", "numero póliza", "n poliza", "n póliza", "n° poliza", "n° póliza", "poliza", "póliza", "policy number", "policy_number", "num poliza", "nro poliza"],
  },
  {
    key: "policyStartDate",
    label: "Fecha Inicio Póliza",
    required: false,
    type: "date",
    synonyms: ["fecha inicio poliza", "fecha inicio póliza", "inicio poliza", "inicio póliza", "policy start date", "policy_start_date", "vigencia inicio", "f inicio poliza"],
  },
  {
    key: "policyEndDate",
    label: "Fecha Fin Póliza",
    required: false,
    type: "date",
    synonyms: ["fecha fin poliza", "fecha fin póliza", "fin poliza", "fin póliza", "policy end date", "policy_end_date", "vigencia fin", "f fin poliza", "vencimiento poliza"],
  },
  {
    key: "policyCurrency",
    label: "Moneda Póliza",
    required: false,
    synonyms: ["moneda poliza", "moneda póliza", "policy currency", "policy_currency", "moneda de poliza", "moneda de póliza"],
  },
  {
    key: "policyPremium",
    label: "Prima Anual",
    required: false,
    type: "number",
    synonyms: ["prima anual", "prima", "policy premium", "policy_premium", "prima poliza", "prima póliza", "valor prima"],
  },
  {
    key: "inspector",
    label: "Inspector",
    required: false,
    synonyms: ["inspector", "nombre inspector", "inspector name", "inspector_id", "id inspector", "inspectora"],
  },
  {
    key: "contractorRut",
    label: "RUT Contratante",
    required: false,
    synonyms: ["rut contratante", "rut del contratante", "contractor rut", "contractor_rut"],
  },
  {
    key: "contractorName",
    label: "Nombre Contratante",
    required: false,
    synonyms: ["nombre contratante", "contratante", "nombre del contratante", "contractor name", "contractor_name"],
  },
  {
    key: "contractorLastName",
    label: "Apellido Contratante",
    required: false,
    synonyms: ["apellido contratante", "apellido del contratante", "contractor last name", "contractor_last_name"],
  },
  {
    key: "contractorEmail",
    label: "E-mail Contratante",
    required: false,
    synonyms: ["email contratante", "e-mail contratante", "correo contratante", "mail contratante", "contractor email", "contractor_email"],
  },
  {
    key: "contractorPhone",
    label: "Teléfono Contratante",
    required: false,
    synonyms: ["telefono contratante", "teléfono contratante", "fono contratante", "contractor phone", "contractor_phone", "celular contratante", "móvil contratante", "movil contratante", "contractor cell phone", "contractor_cell_phone"],
  },
  {
    key: "contractorAddress",
    label: "Dirección Contratante",
    required: false,
    synonyms: ["direccion contratante", "dirección contratante", "domicilio contratante", "contractor address", "contractor_address", "direccion del contratante", "dirección del contratante"],
  },
  {
    key: "contractorCountry",
    label: "País Contratante",
    required: false,
    synonyms: ["pais contratante", "país contratante", "contractor country", "contractor_country", "pais del contratante"],
  },
  {
    key: "contractorRegion",
    label: "Región Contratante",
    required: false,
    synonyms: ["region contratante", "región contratante", "contractor region", "contractor_region", "region del contratante"],
  },
  {
    key: "contractorCity",
    label: "Ciudad Contratante",
    required: false,
    synonyms: ["ciudad contratante", "contractor city", "contractor_city", "ciudad del contratante"],
  },
  {
    key: "contractorCommune",
    label: "Comuna Contratante",
    required: false,
    synonyms: ["comuna contratante", "contractor commune", "contractor_commune", "comuna del contratante"],
  },
  {
    key: "beneficiaryRut",
    label: "RUT Beneficiario",
    required: false,
    synonyms: ["rut beneficiario", "rut_beneficiario", "documento beneficiario", "rut del beneficiario"],
  },
  {
    key: "beneficiaryName",
    label: "Nombre Beneficiario",
    required: false,
    synonyms: ["nombre beneficiario", "beneficiario", "beneficiary name", "beneficiary_name", "nombre del beneficiario"],
  },
  {
    key: "beneficiaryLastName",
    label: "Apellido Beneficiario",
    required: false,
    synonyms: ["apellido beneficiario", "beneficiary last name", "beneficiary_last_name", "apellido del beneficiario"],
  },
  {
    key: "beneficiaryEmail",
    label: "E-mail Beneficiario",
    required: false,
    synonyms: ["e-mail beneficiario", "email beneficiario", "correo beneficiario", "beneficiary email", "beneficiary_email", "mail beneficiario"],
  },
  {
    key: "beneficiaryPhone",
    label: "Teléfono Beneficiario",
    required: false,
    synonyms: ["telefono beneficiario", "teléfono beneficiario", "fono beneficiario", "beneficiary phone", "beneficiary_phone", "celular beneficiario", "móvil beneficiario", "movil beneficiario", "beneficiary cell phone", "beneficiary_cell_phone"],
  },
  {
    key: "beneficiaryAddress",
    label: "Dirección Beneficiario",
    required: false,
    synonyms: ["direccion beneficiario", "dirección beneficiario", "beneficiary address", "beneficiary_address", "domicilio beneficiario", "direccion del beneficiario", "dirección del beneficiario"],
  },
  {
    key: "beneficiaryCountry",
    label: "País Beneficiario",
    required: false,
    synonyms: ["pais beneficiario", "país beneficiario", "beneficiary country", "beneficiary_country", "pais del beneficiario"],
  },
  {
    key: "beneficiaryRegion",
    label: "Región Beneficiario",
    required: false,
    synonyms: ["region beneficiario", "región beneficiario", "beneficiary region", "beneficiary_region", "region del beneficiario"],
  },
  {
    key: "beneficiaryCity",
    label: "Ciudad Beneficiario",
    required: false,
    synonyms: ["ciudad beneficiario", "beneficiary city", "beneficiary_city", "ciudad del beneficiario"],
  },
  {
    key: "beneficiaryCommune",
    label: "Comuna Beneficiario",
    required: false,
    synonyms: ["comuna beneficiario", "beneficiary commune", "beneficiary_commune", "comuna del beneficiario"],
  },
  {
    key: "claimAddress",
    label: "Dirección Siniestro",
    required: false,
    synonyms: ["direccion siniestro", "dirección siniestro", "lugar siniestro", "domicilio siniestro", "ubicacion siniestro", "ubicación siniestro", "calle siniestro"],
  },
  {
    key: "claimCountry",
    label: "País Siniestro",
    required: false,
    synonyms: ["pais siniestro", "país siniestro", "claim country", "claim_country", "pais del siniestro"],
  },
  {
    key: "claimRegion",
    label: "Región Siniestro",
    required: false,
    synonyms: ["region siniestro", "región siniestro", "claim region", "claim_region", "region del siniestro"],
  },
  {
    key: "claimCity",
    label: "Ciudad Siniestro",
    required: false,
    synonyms: ["ciudad siniestro", "claim city", "claim_city", "ciudad del siniestro"],
  },
  {
    key: "claimCommune",
    label: "Comuna Siniestro",
    required: false,
    synonyms: ["comuna siniestro", "claim commune", "claim_commune", "comuna del siniestro"],
  },
  {
    key: "constructionType",
    label: "Tipo Construcción",
    required: false,
    synonyms: ["tipo construccion", "tipo construcción", "construction type", "construction_type", "tipo de construccion"],
  },
  {
    key: "destination",
    label: "Destino",
    required: false,
    synonyms: ["destino", "destination", "destino vivienda", "uso", "tipo destino"],
  },
  {
    key: "damageClassification",
    label: "Clasif. Daño",
    required: false,
    synonyms: ["clasif daño", "clasif dano", "clasificacion daño", "clasificación daño", "damage classification", "damage_classification", "grado daño", "nivel daño", "clasif daños"],
  },
  {
    key: "isHabitable",
    label: "Es Habitable?",
    required: false,
    type: "boolean",
    synonyms: ["es habitable", "habitable", "is habitable", "is_habitable", "habitabilidad"],
  },
  {
    key: "ownerSameAsInsured",
    label: "Propietario / Asegurado",
    required: false,
    type: "boolean",
    synonyms: ["propietario asegurado", "propietario/asegurado", "owner same as insured", "owner_same_as_insured", "es propietario", "mismo propietario", "propietario"],
  },
];

export const REQUIRED_FIELDS = ALOCLAIM_FIELDS.filter((f) => f.required);
export const OPTIONAL_FIELDS = ALOCLAIM_FIELDS.filter((f) => !f.required);

// ═══════════════════════════════════════════════════════════════
// Normalización de strings para comparación
// ═══════════════════════════════════════════════════════════════

/** Normaliza un string: lowercase, sin acentos, sin puntuación, sin espacios extra */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[°º·.,;:!?¿¡'"`´()\-_]/g, " ") // quita puntuación
    .replace(/\s+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// Autodetección de mapeo columna → campo
// ═══════════════════════════════════════════════════════════════

export interface ColumnMapping {
  /** key del campo del sistema (ClaimField.key) o null si no está mapeado */
  fieldKey: string | null;
  /** Header original del Excel (preserva mayúsculas/acentos para mostrar) */
  excelHeader: string;
  /** Si se autodetectó (vs mapeo manual del usuario) */
  autoDetected: boolean;
  /** Score de similitud [0..1] para sugerencias fuzzy */
  confidence: number;
}

/**
 * Mapeo aprendido de una empresa: excel_header → field_key
 */
export interface LearnedFieldMapping {
  excel_header: string;
  field_key: string;
  times_used: number;
}

/**
 * Dado los headers del Excel, produce un mapeo inicial autodetectando
 * qué columna corresponde a qué campo del sistema.
 *
 * Estrategia:
 *  0. PRIMERO usa los mapeos aprendidos de la empresa (si existen)
 *  1. Para cada campo, busca match exacto (normalizado) con algún sinónimo
 *  2. Si no hay match exacto, busca el header más similar (fuzzy) y lo marca
 *     como sugerencia con confidence < 1 (el usuario debe confirmar)
 *  3. Un header solo puede mapear a un campo (el primero que matchee)
 */
export function autoDetectMapping(
  excelHeaders: string[],
  learnedMappings?: LearnedFieldMapping[]
): Record<string, ColumnMapping> {
  const normalizedHeaders = excelHeaders.map((h) => ({ original: h, normalized: normalize(h) }));
  const usedHeaders = new Set<string>(); // headers ya asignados a un campo
  const mapping: Record<string, ColumnMapping> = {};

  // ── Pasada 0: mapeos aprendidos de la empresa (confianza máxima) ──
  if (learnedMappings && learnedMappings.length > 0) {
    // Ordenar por times_used descendente para usar el más frecuente primero
    const sorted = [...learnedMappings].sort((a, b) => b.times_used - a.times_used);
    for (const learned of sorted) {
      // Buscar el header en el Excel que coincida (case-insensitive)
      const match = normalizedHeaders.find(
        ({ original, normalized }) =>
          !usedHeaders.has(original) &&
          (original === learned.excel_header || normalized === normalize(learned.excel_header))
      );
      if (match) {
        // Verificar que el field_key sea válido
        const field = ALOCLAIM_FIELDS.find((f) => f.key === learned.field_key);
        if (field) {
          mapping[field.key] = {
            fieldKey: field.key,
            excelHeader: match.original,
            autoDetected: true,
            confidence: 1, // Aprendido = confianza máxima
          };
          usedHeaders.add(match.original);
        }
      }
    }
  }

  // Pasada 1: match exacto de sinónimos (solo para campos no ya mapeados por aprendizaje)
  for (const field of ALOCLAIM_FIELDS) {
    if (mapping[field.key]) continue; // Ya mapeado por aprendizaje
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
  for (const field of ALOCLAIM_FIELDS) {
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

// ═══════════════════════════════════════════════════════════════
// Similitud fuzzy
// ═══════════════════════════════════════════════════════════════

/**
 * Mejor score de similitud entre un string y una lista de sinónimos.
 * Usa combinación de:
 *  - substring (contiene o está contenido)
 *  - Jaccard de tokens (palabras)
 *  - Levenshtein normalizado
 * Retorna [0..1]
 */
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

  // Substring: si uno contiene al otro, alta similitud
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.7 + 0.3 * (shorter / longer);
  }

  // Jaccard de tokens (palabras)
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Levenshtein normalizado
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);

  // Ponderar: 50% jaccard, 50% levenshtein
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
// Validación con errores claros y accionables
// ═══════════════════════════════════════════════════════════════

export interface RowError {
  /** Campo del sistema afectado (ClaimField.key) */
  fieldKey: string;
  /** Label humano del campo */
  fieldLabel: string;
  /** Mensaje claro y accionable */
  message: string;
  /** Tipo de error para clasificación */
  kind: "missing_column" | "empty_value" | "invalid_value";
}

export interface ParsedRow {
  rowNum: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: RowError[];
}

/**
 * Valida una fila usando el mapeo activo.
 * Produce errores claros que distinguen entre:
 *  - missing_column: el campo no tiene columna mapeada (el usuario debe mapear)
 *  - empty_value: la columna está mapeada pero la celda está vacía
 *  - invalid_value: el valor existe pero no es válido (ej: fecha mal formada)
 */
export function validateRowWithMapping(
  row: Record<string, unknown>,
  mapping: Record<string, ColumnMapping>
): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  for (const field of ALOCLAIM_FIELDS) {
    if (!field.required) continue;

    const m = mapping[field.key];
    const value = row[field.key];

    if (!m || !m.fieldKey || !m.excelHeader) {
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "missing_column",
        message: `Falta "${field.label}" — no hay columna mapeada. Asigna una columna del Excel en el panel de mapeo, o agrega una columna llamada "${field.label}" en tu Excel.`,
      });
      continue;
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "empty_value",
        message: `Falta "${field.label}" — la columna "${m.excelHeader}" está vacía en esta fila.`,
      });
      continue;
    }

    // Validaciones específicas por tipo de campo
    if (field.key === "claimDate") {
      const parsed = parseDate(String(value));
      if (!parsed) {
        errors.push({
          fieldKey: field.key,
          fieldLabel: field.label,
          kind: "invalid_value",
          message: `"${field.label}" inválido: "${value}" no es una fecha reconocida. Usa formato DD-MM-AAAA o AAAA-MM-DD.`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Intenta parsear una fecha en varios formatos comunes. Retorna ISO o null. */
export function parseDate(value: string): string | null {
  const s = value.trim();
  if (!s) return null;

  // DD-MM-AAAA o DD/MM/AAAA
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // AAAA-MM-DD (ISO)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Intentar con Date nativo (para fechas de Excel que vienen como números)
  const n = Number(s);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    // Serial date de Excel (días desde 1900-01-01)
    const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const date = new Date(s);
  if (!isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Aplica el mapeo a una fila cruda del Excel, extrayendo los valores
 * de las columnas correctas y normalizándolos a las keys del sistema.
 */
export function applyMappingToRow(
  raw: Record<string, string | number | null>,
  mapping: Record<string, ColumnMapping>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of ALOCLAIM_FIELDS) {
    const m = mapping[field.key];
    if (m && m.excelHeader) {
      const val = raw[m.excelHeader];
      data[field.key] = val !== undefined && val !== null ? String(val).trim() : "";
    } else {
      data[field.key] = "";
    }
  }

  // Fallbacks de compatibilidad
  if (!data.city && data.commune) data.city = data.commune;
  if (!data.country) data.country = "Chile";

  // Normalizar fecha si viene en otro formato
  if (data.claimDate && typeof data.claimDate === "string") {
    const parsed = parseDate(data.claimDate);
    if (parsed) data.claimDate = parsed;
  }
  if (data.reportDate && typeof data.reportDate === "string") {
    const parsed = parseDate(data.reportDate);
    if (parsed) data.reportDate = parsed;
  }
  if (data.assignmentDate && typeof data.assignmentDate === "string") {
    const parsed = parseDate(data.assignmentDate);
    if (parsed) data.assignmentDate = parsed;
  }
  if (data.policyStartDate && typeof data.policyStartDate === "string") {
    const parsed = parseDate(data.policyStartDate);
    if (parsed) data.policyStartDate = parsed;
  }
  if (data.policyEndDate && typeof data.policyEndDate === "string") {
    const parsed = parseDate(data.policyEndDate);
    if (parsed) data.policyEndDate = parsed;
  }
  if (data.createdAt && typeof data.createdAt === "string") {
    const parsed = parseDate(data.createdAt);
    if (parsed) data.createdAt = parsed;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
// Aliases para compatibilidad con carga-aloclaim/page.tsx
// ═══════════════════════════════════════════════════════════════

export function autoDetectAloClaimMapping(
  excelHeaders: string[],
  learnedMappings?: LearnedFieldMapping[],
): Record<string, ColumnMapping> {
  return autoDetectMapping(excelHeaders, learnedMappings);
}

export function validateAloClaimRow(
  row: Record<string, unknown>,
  mapping: Record<string, ColumnMapping>,
): { valid: boolean; errors: RowError[] } {
  return validateRowWithMapping(row, mapping);
}

export function applyAloClaimMapping(
  raw: Record<string, string | number | null>,
  mapping: Record<string, ColumnMapping>,
): Record<string, unknown> {
  return applyMappingToRow(raw, mapping);
}

export type LearnedAloClaimFieldMapping = LearnedFieldMapping;
