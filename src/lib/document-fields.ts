/**
 * Catálogo de campos disponibles para plantillas de documentos (.docx).
 *
 * Este archivo es importable tanto desde cliente como servidor (solo contiene
 * tipos, constantes y funciones puras — sin acceso a DB ni secrets).
 *
 * Cada campo define:
 * - key: el nombre canónico del placeholder (ej: "claim_number")
 * - label: etiqueta legible para la UI
 * - group: agrupación para la UI
 * - resolve: función que extrae el valor desde un objeto de datos del siniestro
 *
 * En el Word el usuario escribe <claim_number>, <insured_name>, etc.
 * Si el usuario usa un nombre distinto (ej: <N_Siniestro>), puede mapearlo
 * manualmente vía placeholder_mapping a uno de estos campos canónicos.
 */

export interface ParticipantData {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  rut?: string;
  email?: string;
  phone?: string;
  cell_phone?: string;
  address?: string;
  country?: string;
  region?: string;
  city?: string;
  commune?: string;
  notes?: string;
}

export interface UserData {
  full_name?: string;
  display_name?: string;
  email?: string;
}

export interface CatalogRef {
  id?: string;
  name?: string;
  code?: string;
}

export interface DocumentData {
  // Claim plano (todos los campos crudos)
  claim?: Record<string, unknown>;
  // Joins ya resueltos a strings
  company?: CatalogRef | null;
  insurance_company?: CatalogRef | null;
  broker?: CatalogRef | null;
  advisor?: CatalogRef | null;
  claim_type?: CatalogRef | null;
  business_line?: CatalogRef | null;
  insurance_product?: CatalogRef | null;
  claim_cause?: CatalogRef | null;
  event?: CatalogRef | null;
  country?: CatalogRef | null;
  region?: CatalogRef | null;
  city?: CatalogRef | null;
  commune?: CatalogRef | null;
  status?: CatalogRef & { code?: string } | null;
  currency?: CatalogRef & { code?: string } | null;
  // lookup_catalog FKs
  construction_type?: CatalogRef | null;
  destination_housing?: CatalogRef | null;
  damage_classification?: CatalogRef | null;
  habitability?: CatalogRef | null;
  claim_category?: CatalogRef | null; // type_id
  service_type?: CatalogRef | null;
  billing_type?: CatalogRef | null;
  // Participantes (todos los tipos)
  insured?: ParticipantData | null;
  contractor?: ParticipantData | null;
  beneficiary?: ParticipantData | null;
  executive?: ParticipantData | null;
  contact?: ParticipantData | null;
  // Usuarios asignados
  adjuster?: UserData | null;
  inspector?: UserData | null;
  auditor?: UserData | null;
  dispatcher?: UserData | null;
  assistant?: UserData | null;
  // Fechas formateadas
  today?: string;
}

export interface DocumentField {
  key: string;
  label: string;
  group: string;
  resolve: (data: DocumentData) => string;
}

const fmtDate = (v: unknown): string => {
  if (!v || typeof v !== "string") return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateTime = (v: unknown): string => {
  if (!v || typeof v !== "string") return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtMoney = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
};

const fmtBool = (v: unknown): string => {
  if (v === true) return "Sí";
  if (v === false) return "No";
  return "";
};

const get = (obj: Record<string, unknown> | undefined, key: string): unknown =>
  obj ? obj[key] : undefined;

// Helper para participantes: extrae un campo del participante
const pget = (p: ParticipantData | null | undefined, key: keyof ParticipantData): string => {
  if (!p) return "";
  const v = p[key];
  return v ?? "";
};

export const DOCUMENT_FIELDS: DocumentField[] = [
  // ─── Siniestro ───
  { key: "claim_number", label: "N° Siniestro (Cía)", group: "Siniestro", resolve: (d) => String(get(d.claim, "claim_number") ?? "") },
  { key: "internal_number", label: "N° Interno", group: "Siniestro", resolve: (d) => String(get(d.claim, "internal_number") ?? "") },
  { key: "client_reference", label: "N° Ref. Cliente", group: "Siniestro", resolve: (d) => String(get(d.claim, "client_reference") ?? "") },
  { key: "company_report_number", label: "N° Reporte Cía", group: "Siniestro", resolve: (d) => String(get(d.claim, "company_report_number") ?? "") },
  { key: "liquidation_number", label: "N° Liquidación", group: "Siniestro", resolve: (d) => String(get(d.claim, "liquidation_number") ?? "") },
  { key: "claim_date", label: "Fecha Siniestro", group: "Siniestro", resolve: (d) => fmtDate(get(d.claim, "claim_date")) },
  { key: "report_date", label: "Fecha Denuncio", group: "Siniestro", resolve: (d) => fmtDate(get(d.claim, "report_date")) },
  { key: "assignment_date", label: "Fecha Asignación", group: "Siniestro", resolve: (d) => fmtDate(get(d.claim, "assignment_date")) },
  { key: "summary", label: "Resumen", group: "Siniestro", resolve: (d) => String(get(d.claim, "summary") ?? "") },
  { key: "notes", label: "Notas del Siniestro", group: "Siniestro", resolve: (d) => String(get(d.claim, "notes") ?? "") },
  { key: "claim_address", label: "Dirección del Siniestro", group: "Siniestro", resolve: (d) => String(get(d.claim, "claim_address") ?? "") },
  { key: "is_special_claim", label: "Siniestro Especial", group: "Siniestro", resolve: (d) => fmtBool(get(d.claim, "is_special_claim")) },
  { key: "owner_same_as_insured", label: "Propietario = Asegurado", group: "Siniestro", resolve: (d) => fmtBool(get(d.claim, "owner_same_as_insured")) },
  { key: "created_at", label: "Fecha Creación", group: "Siniestro", resolve: (d) => fmtDateTime(get(d.claim, "created_at")) },
  { key: "today", label: "Fecha de hoy", group: "Siniestro", resolve: (d) => d.today ?? fmtDate(new Date().toISOString()) },

  // ─── Estado / Clasificación ───
  { key: "status_name", label: "Estado del Siniestro", group: "Clasificación", resolve: (d) => d.status?.name ?? "" },
  { key: "status_code", label: "Código Estado", group: "Clasificación", resolve: (d) => d.status?.code ?? "" },
  { key: "claim_type", label: "Tipo de Siniestro", group: "Clasificación", resolve: (d) => d.claim_type?.name ?? "" },
  { key: "business_line", label: "Línea de Negocio", group: "Clasificación", resolve: (d) => d.business_line?.name ?? "" },
  { key: "insurance_product", label: "Ramo/Producto", group: "Clasificación", resolve: (d) => d.insurance_product?.name ?? "" },
  { key: "claim_cause", label: "Causal", group: "Clasificación", resolve: (d) => d.claim_cause?.name ?? "" },
  { key: "event", label: "Evento", group: "Clasificación", resolve: (d) => d.event?.name ?? "" },
  { key: "claim_category", label: "Categoría", group: "Clasificación", resolve: (d) => d.claim_category?.name ?? "" },
  { key: "construction_type", label: "Tipo Construcción", group: "Clasificación", resolve: (d) => d.construction_type?.name ?? "" },
  { key: "destination_housing", label: "Destino Vivienda", group: "Clasificación", resolve: (d) => d.destination_housing?.name ?? "" },
  { key: "damage_classification", label: "Clasificación Daños", group: "Clasificación", resolve: (d) => d.damage_classification?.name ?? "" },
  { key: "habitability", label: "Habitabilidad", group: "Clasificación", resolve: (d) => d.habitability?.name ?? "" },
  { key: "service_type", label: "Tipo Servicio", group: "Clasificación", resolve: (d) => d.service_type?.name ?? "" },
  { key: "billing_type", label: "Tipo Facturación", group: "Clasificación", resolve: (d) => d.billing_type?.name ?? "" },

  // ─── Póliza ───
  { key: "policy_number", label: "N° Póliza", group: "Póliza", resolve: (d) => String(get(d.claim, "policy_number") ?? "") },
  { key: "policy_item", label: "Item Póliza", group: "Póliza", resolve: (d) => String(get(d.claim, "policy_item") ?? "") },
  { key: "policy_amount", label: "Monto Asegurado", group: "Póliza", resolve: (d) => fmtMoney(get(d.claim, "policy_amount")) },
  { key: "policy_premium", label: "Prima", group: "Póliza", resolve: (d) => fmtMoney(get(d.claim, "policy_premium")) },
  { key: "policy_start_date", label: "Inicio Vigencia", group: "Póliza", resolve: (d) => fmtDate(get(d.claim, "policy_start_date")) },
  { key: "policy_end_date", label: "Término Vigencia", group: "Póliza", resolve: (d) => fmtDate(get(d.claim, "policy_end_date")) },
  { key: "currency", label: "Moneda", group: "Póliza", resolve: (d) => d.currency?.name ?? "" },
  { key: "currency_code", label: "Código Moneda", group: "Póliza", resolve: (d) => d.currency?.code ?? "" },

  // ─── Recovery ───
  { key: "recovery_type_legal", label: "Recovery Legal", group: "Recovery", resolve: (d) => fmtBool(get(d.claim, "recovery_type_legal")) },
  { key: "recovery_type_material", label: "Recovery Material", group: "Recovery", resolve: (d) => fmtBool(get(d.claim, "recovery_type_material")) },
  { key: "recovery_comments", label: "Comentarios Recovery", group: "Recovery", resolve: (d) => String(get(d.claim, "recovery_comments") ?? "") },

  // ─── Empresas ───
  { key: "company", label: "Empresa (Cliente)", group: "Empresas", resolve: (d) => d.company?.name ?? "" },
  { key: "insurance_company", label: "Compañía de Seguros", group: "Empresas", resolve: (d) => d.insurance_company?.name ?? "" },
  { key: "broker", label: "Corredor", group: "Empresas", resolve: (d) => d.broker?.name ?? "" },
  { key: "advisor", label: "Asesor", group: "Empresas", resolve: (d) => d.advisor?.name ?? "" },
  { key: "broker_executive", label: "Ejecutivo Corredor", group: "Empresas", resolve: (d) => String(get(d.claim, "broker_executive") ?? "") },

  // ─── Geografía del Siniestro ───
  { key: "country", label: "País del Siniestro", group: "Geografía Siniestro", resolve: (d) => d.country?.name ?? "" },
  { key: "region", label: "Región del Siniestro", group: "Geografía Siniestro", resolve: (d) => d.region?.name ?? "" },
  { key: "city", label: "Ciudad del Siniestro", group: "Geografía Siniestro", resolve: (d) => d.city?.name ?? "" },
  { key: "commune", label: "Comuna del Siniestro", group: "Geografía Siniestro", resolve: (d) => d.commune?.name ?? "" },

  // ─── Asegurado ───
  { key: "insured_name", label: "Nombre Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "full_name") },
  { key: "insured_first_name", label: "Nombre", group: "Asegurado", resolve: (d) => pget(d.insured, "first_name") },
  { key: "insured_last_name", label: "Apellido", group: "Asegurado", resolve: (d) => pget(d.insured, "last_name") },
  { key: "insured_rut", label: "RUT Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "rut") },
  { key: "insured_email", label: "Email Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "email") },
  { key: "insured_phone", label: "Teléfono Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "phone") },
  { key: "insured_cellphone", label: "Celular Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "cell_phone") },
  { key: "insured_address", label: "Dirección Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "address") },
  { key: "insured_country", label: "País Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "country") },
  { key: "insured_region", label: "Región Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "region") },
  { key: "insured_city", label: "Ciudad Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "city") },
  { key: "insured_commune", label: "Comuna Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "commune") },
  { key: "insured_notes", label: "Notas Asegurado", group: "Asegurado", resolve: (d) => pget(d.insured, "notes") },

  // ─── Contratista ───
  { key: "contractor_name", label: "Nombre Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "full_name") },
  { key: "contractor_first_name", label: "Nombre", group: "Contratista", resolve: (d) => pget(d.contractor, "first_name") },
  { key: "contractor_last_name", label: "Apellido", group: "Contratista", resolve: (d) => pget(d.contractor, "last_name") },
  { key: "contractor_rut", label: "RUT Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "rut") },
  { key: "contractor_email", label: "Email Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "email") },
  { key: "contractor_phone", label: "Teléfono Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "phone") },
  { key: "contractor_cellphone", label: "Celular Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "cell_phone") },
  { key: "contractor_address", label: "Dirección Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "address") },
  { key: "contractor_country", label: "País Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "country") },
  { key: "contractor_region", label: "Región Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "region") },
  { key: "contractor_city", label: "Ciudad Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "city") },
  { key: "contractor_commune", label: "Comuna Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "commune") },
  { key: "contractor_notes", label: "Notas Contratista", group: "Contratista", resolve: (d) => pget(d.contractor, "notes") },

  // ─── Beneficiario ───
  { key: "beneficiary_name", label: "Nombre Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "full_name") },
  { key: "beneficiary_first_name", label: "Nombre", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "first_name") },
  { key: "beneficiary_last_name", label: "Apellido", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "last_name") },
  { key: "beneficiary_rut", label: "RUT Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "rut") },
  { key: "beneficiary_email", label: "Email Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "email") },
  { key: "beneficiary_phone", label: "Teléfono Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "phone") },
  { key: "beneficiary_cellphone", label: "Celular Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "cell_phone") },
  { key: "beneficiary_address", label: "Dirección Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "address") },
  { key: "beneficiary_country", label: "País Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "country") },
  { key: "beneficiary_region", label: "Región Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "region") },
  { key: "beneficiary_city", label: "Ciudad Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "city") },
  { key: "beneficiary_commune", label: "Comuna Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "commune") },
  { key: "beneficiary_notes", label: "Notas Beneficiario", group: "Beneficiario", resolve: (d) => pget(d.beneficiary, "notes") },

  // ─── Ejecutivo / Contacto ───
  { key: "executive_name", label: "Nombre Ejecutivo", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.executive, "full_name") },
  { key: "executive_rut", label: "RUT Ejecutivo", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.executive, "rut") },
  { key: "executive_email", label: "Email Ejecutivo", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.executive, "email") },
  { key: "executive_phone", label: "Teléfono Ejecutivo", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.executive, "phone") },
  { key: "executive_cellphone", label: "Celular Ejecutivo", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.executive, "cell_phone") },
  { key: "contact_name", label: "Nombre Contacto", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.contact, "full_name") },
  { key: "contact_email", label: "Email Contacto", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.contact, "email") },
  { key: "contact_phone", label: "Teléfono Contacto", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.contact, "phone") },
  { key: "contact_cellphone", label: "Celular Contacto", group: "Ejecutivo / Contacto", resolve: (d) => pget(d.contact, "cell_phone") },

  // ─── Asignaciones ───
  { key: "adjuster_name", label: "Nombre Liquidador", group: "Asignaciones", resolve: (d) => d.adjuster?.full_name ?? d.adjuster?.display_name ?? "" },
  { key: "adjuster_email", label: "Email Liquidador", group: "Asignaciones", resolve: (d) => d.adjuster?.email ?? "" },
  { key: "inspector_name", label: "Nombre Inspector", group: "Asignaciones", resolve: (d) => d.inspector?.full_name ?? d.inspector?.display_name ?? "" },
  { key: "inspector_email", label: "Email Inspector", group: "Asignaciones", resolve: (d) => d.inspector?.email ?? "" },
  { key: "auditor_name", label: "Nombre Auditor", group: "Asignaciones", resolve: (d) => d.auditor?.full_name ?? d.auditor?.display_name ?? "" },
  { key: "dispatcher_name", label: "Nombre Despachador", group: "Asignaciones", resolve: (d) => d.dispatcher?.full_name ?? d.dispatcher?.display_name ?? "" },
  { key: "assistant_name", label: "Nombre Asistente", group: "Asignaciones", resolve: (d) => d.assistant?.full_name ?? d.assistant?.display_name ?? "" },
];

/** Mapa key -> DocumentField para resolución rápida */
export const FIELD_BY_KEY: Record<string, DocumentField> = Object.fromEntries(
  DOCUMENT_FIELDS.map((f) => [f.key, f])
);

/** Mapa UPPER(key) -> DocumentField para lookup case-insensitive */
export const FIELD_BY_KEY_UPPER: Record<string, DocumentField> = Object.fromEntries(
  DOCUMENT_FIELDS.map((f) => [f.key.toUpperCase(), f])
);

/**
 * Busca un campo canónico por key, case-insensitive.
 * Ej: "LIQUIDATION_NUMBER" → field con key "liquidation_number"
 *     "liquidation_number" → field con key "liquidation_number"
 *     "DEDUCIBLE" → undefined (no es canónico)
 */
export function findFieldByKeyInsensitive(key: string): DocumentField | undefined {
  return FIELD_BY_KEY[key] ?? FIELD_BY_KEY_UPPER[key.toUpperCase()];
}

/**
 * Construye el objeto de datos plano que se pasa a docxtemplater.
 * Resuelve todos los campos canónicos + aplica el mapeo manual del usuario.
 *
 * @param data datos del siniestro ya resueltos (joins como strings)
 * @param mapping mapeo manual { placeholder_en_word: campo_canonico }
 * @returns objeto { placeholder: valor } para docxtemplater
 */
export function buildTemplateData(
  data: DocumentData,
  mapping: Record<string, string> = {}
): Record<string, string> {
  // 1. Resolver todos los campos canónicos
  const result: Record<string, string> = {};
  for (const field of DOCUMENT_FIELDS) {
    result[field.key] = field.resolve(data);
  }

  // 2. Aplicar mapeo manual: el usuario escribió <N_Siniestro> o [N_SINIESTRO]
  //    en el Word y lo mapeó a "claim_number" → añadimos N_Siniestro = result.claim_number
  //    El mapeo es case-insensitive: si mapeó "DEDUCIBLE" → "policy_amount",
  //    añadimos DEDUCIBLE = result.policy_amount
  for (const [placeholder, canonicalKey] of Object.entries(mapping)) {
    const field = findFieldByKeyInsensitive(canonicalKey);
    if (field) {
      result[placeholder] = result[field.key] ?? "";
    }
  }

  return result;
}

/** Lista de grupos para la UI */
export const FIELD_GROUPS: string[] = [...new Set(DOCUMENT_FIELDS.map((f) => f.group))];
