// Tipos compartidos del ScreenBuilder
// El ancho de columna permite layout multi-columna en el canvas

export type FieldWidth = "full" | "half" | "third" | "quarter" | "fifth" | "sixth";

export type FieldCategory = "own" | "simple_entity" | "complex_entity";

export interface DateValidation {
  type:
    | "greater_than"
    | "less_than"
    | "equal_to"
    | "greater_or_equal"
    | "less_or_equal"
    | "greater_than_today"
    | "less_than_today"
    | "equal_today";
  compareField?: string;
  label?: string;
}

export interface SubField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  editable: boolean;
  column?: string;
  formula?: string;
  options?: string;
}

export interface GeneralField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  editable: boolean;
  options?: string;
}

// Regla de visibilidad / obligatoriedad condicional
// Permite que un campo se muestre o sea obligatorio solo cuando otro campo
// del formulario tiene un valor específico (árbol de decisión configurable).
export interface VisibilityRule {
  field: string;                    // ID del campo controlador
  operator: "equals" | "not_equals" | "in" | "not_in";
  value: string | string[];
}

export interface ScreenField {
  id: string;
  category: FieldCategory;
  type: string;
  label: string;
  required?: boolean;
  width?: FieldWidth;

  // Reglas condicionales (genéricas para todas las pantallas dinámicas)
  visibilityRule?: VisibilityRule;   // cuándo mostrar el campo (si no se cumple, no se renderiza)
  requiredRule?: VisibilityRule;     // cuándo el campo es obligatorio (override de required)

  // Campos propios de texto
  inputType?: "alphanumeric" | "numeric";
  maxLength?: number;
  placeholder?: string;
  rows?: number;

  // Campos propios de fecha
  dateType?: "date" | "datetime";
  dateValidation?: DateValidation;

  // Select / multiselect
  options?: { value: string; label: string }[];

  // Tabla
  columns?: string[];

  // Sub-campos de entidades complejas (reserva, ajuste, etc.)
  fields?: SubField[];
  general_fields?: GeneralField[];

  // Configuración específica por tipo de campo complejo
  // (ej: toggles para inspection_coordination, opciones de claim_document_receipt)
  config?: Record<string, boolean | string | number>;
}

// Catálogos de campos disponibles

export const OWN_FIELD_BASIC_TYPES: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "text", label: "Texto", icon: "Aa", desc: "Nombre, título, referencia" },
  { code: "textarea", label: "Descripción", icon: "¶", desc: "Texto largo" },
  { code: "number", label: "Número", icon: "#", desc: "Montos, cantidades" },
  { code: "date", label: "Fecha", icon: "📅", desc: "Calendario con validaciones" },
  { code: "select", label: "Selección", icon: "▼", desc: "Lista desplegable" },
  { code: "checkbox", label: "Checkbox", icon: "✓", desc: "Casilla" },
  { code: "table", label: "Tabla", icon: "⊞", desc: "Tabla con columnas" },
  { code: "section", label: "Sección", icon: "§", desc: "Separador visual" },
];

export const OWN_FIELD_COORD_TYPES: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "coord_inspection_type", label: "Tipo Inspección", icon: "▼", desc: "Presencial/Remota (coordinación)" },
  { code: "coord_inspector", label: "Inspector", icon: "👤", desc: "Selector de inspector (coordinación)" },
  { code: "coord_fecha", label: "Fecha/Hora Inspección", icon: "📅", desc: "Fecha y hora de la inspección (coordinación)" },
  { code: "coord_ubicacion", label: "Aclaración Dirección", icon: "📍", desc: "Detalle adicional de la dirección (coordinación)" },
  { code: "coord_contacto", label: "Otros Contactos", icon: "📞", desc: "Contacto alternativo (coordinación, no obligatorio)" },
  { code: "coord_comentarios", label: "Comentarios", icon: "¶", desc: "Comentarios finales (coordinación)" },
  { code: "coord_result", label: "Resultado Coordinación", icon: "▾", desc: "Coordinada / Fallida / Desistida (coordinación)" },
  { code: "coord_motivo", label: "Motivo", icon: "✎", desc: "Motivo de falla o desistimiento (coordinación)" },
  { code: "coord_fecha_recoord", label: "Fecha Re-coordinación", icon: "📅", desc: "Fecha tentativa de próxima coordinación (coordinación)" },
  { code: "coord_agendar", label: "Estado Inspección", icon: "✓", desc: "Panel informativo del estado de la inspección (coordinación)" },
];

// ═══════════════════════════════════════════════════════════════
// Options canónicas para tipos especiales (no traducibles)
// Usadas por el editor de reglas para mostrar un select en vez de
// un input de texto libre cuando el campo controlador es uno de estos.
// ═══════════════════════════════════════════════════════════════
export const SPECIAL_FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  coord_result: [
    { value: "coordinada", label: "Coordinada (contacto exitoso)" },
    { value: "fallida", label: "Fallida (no se pudo contactar)" },
    { value: "desistida", label: "Desistida (asegurado desiste)" },
  ],
};

export const OWN_FIELD_TYPES = [...OWN_FIELD_BASIC_TYPES, ...OWN_FIELD_COORD_TYPES];

// ═══ Datos generales del siniestro ═══
export const CLAIM_ENTITIES_GENERAL: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "claim_number", label: "N° Siniestro", icon: "#", desc: "Número del siniestro" },
  { code: "liquidation_number", label: "N° Liquidación", icon: "#", desc: "Número de liquidación" },
  { code: "claim_status", label: "Estado", icon: "▼", desc: "Estado actual" },
  { code: "claim_date", label: "Fecha Siniestro", icon: "📅", desc: "Fecha de ocurrencia" },
  { code: "policy_number", label: "N° Póliza", icon: "#", desc: "Número de póliza" },
  { code: "insured_name", label: "Asegurado", icon: "👤", desc: "Nombre del asegurado" },
  { code: "claimant_name", label: "Reclamante", icon: "👤", desc: "Nombre del reclamante" },
  { code: "broker_name", label: "Corredor", icon: "👤", desc: "Nombre del corredor" },
  { code: "adjuster_name", label: "Liquidador", icon: "👤", desc: "Liquidador asignado" },
  { code: "claim_address", label: "Dirección", icon: "📍", desc: "Dirección del siniestro" },
];

// ═══ Cards agrupadas del siniestro (readonly, se mueven como bloque, se pueden desagrupar) ═══
export const CLAIM_ENTITY_CARDS: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "claim_insured_card", label: "Card Asegurado", icon: "👤", desc: "Datos completos del asegurado (card agrupada, solo lectura)" },
  { code: "claim_address_card", label: "Card Dirección Siniestro", icon: "📍", desc: "Dirección completa del siniestro con país/región/ciudad/comuna (card agrupada, solo lectura)" },
  { code: "claim_contact_card", label: "Card Persona de Contacto", icon: "📞", desc: "Persona de contacto del siniestro (card agrupada, solo lectura)" },
];

// ═══ Campos individuales del Asegurado (readonly) ═══
export const CLAIM_ENTITIES_INSURED: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "insured_rut", label: "RUT Asegurado", icon: "#", desc: "RUT del asegurado" },
  { code: "insured_person_type", label: "Tipo Persona", icon: "👤", desc: "Persona Natural/Jurídica del asegurado" },
  { code: "insured_first_name", label: "Nombre Asegurado", icon: "👤", desc: "Nombre del asegurado" },
  { code: "insured_last_name", label: "Apellido Asegurado", icon: "👤", desc: "Apellido del asegurado" },
  { code: "insured_email", label: "Email Asegurado", icon: "✉", desc: "Email del asegurado" },
  { code: "insured_phone", label: "Teléfono Asegurado", icon: "📞", desc: "Teléfono del asegurado" },
  { code: "insured_address", label: "Dirección Asegurado", icon: "📍", desc: "Dirección del asegurado" },
  { code: "insured_country", label: "País Asegurado", icon: "🌍", desc: "País del asegurado" },
  { code: "insured_region", label: "Región Asegurado", icon: "🗺", desc: "Región del asegurado" },
  { code: "insured_city", label: "Ciudad Asegurado", icon: "🏙", desc: "Ciudad del asegurado" },
  { code: "insured_commune", label: "Comuna Asegurado", icon: "📍", desc: "Comuna del asegurado" },
];

// ═══ Campos individuales de la Dirección del Siniestro (readonly) ═══
export const CLAIM_ENTITIES_ADDRESS: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "claim_destination_housing", label: "Tipo Vivienda", icon: "🏠", desc: "Tipo de vivienda del siniestro" },
  { code: "claim_country", label: "País Siniestro", icon: "🌍", desc: "País del siniestro" },
  { code: "claim_region", label: "Región Siniestro", icon: "🗺", desc: "Región del siniestro" },
  { code: "claim_city", label: "Ciudad Siniestro", icon: "🏙", desc: "Ciudad del siniestro" },
  { code: "claim_commune", label: "Comuna Siniestro", icon: "📍", desc: "Comuna del siniestro" },
];

// ═══ Campos individuales de la Persona de Contacto (readonly) ═══
export const CLAIM_ENTITIES_CONTACT: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "contact_first_name", label: "Nombre Contacto", icon: "👤", desc: "Nombre de la persona de contacto" },
  { code: "contact_last_name", label: "Apellido Contacto", icon: "👤", desc: "Apellido de la persona de contacto" },
  { code: "contact_email", label: "Email Contacto", icon: "✉", desc: "Email de la persona de contacto" },
  { code: "contact_phone", label: "Teléfono Contacto", icon: "📞", desc: "Teléfono de la persona de contacto" },
];

// ═══ Datos de la reserva (para pantalla de ajuste — solo lectura) ═══
export const CLAIM_ENTITIES_RESERVE: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "reserve_number", label: "N° Reserva", icon: "#", desc: "Número de la reserva origen" },
  { code: "reserve_currency", label: "Moneda Reserva", icon: "$", desc: "Moneda de la reserva (no editable)" },
  { code: "reserve_payment_date", label: "Fecha Pago Reserva", icon: "📅", desc: "Fecha de pago de la reserva (no editable)" },
];

export const CLAIM_ENTITIES = [
  ...CLAIM_ENTITIES_GENERAL,
  ...CLAIM_ENTITY_CARDS,
  ...CLAIM_ENTITIES_INSURED,
  ...CLAIM_ENTITIES_ADDRESS,
  ...CLAIM_ENTITIES_CONTACT,
  ...CLAIM_ENTITIES_RESERVE,
];

// Mapa de cards agrupadas → campos individuales que las componen
// (usado por el botón "Desagrupar" en el editor)
export const CARD_FIELD_MAP: Record<string, { code: string; label: string; width: "full" | "half" | "third" | "quarter" }[]> = {
  claim_insured_card: [
    { code: "insured_rut", label: "RUT", width: "third" },
    { code: "insured_person_type", label: "Tipo Persona", width: "third" },
    { code: "insured_first_name", label: "Nombre", width: "third" },
    { code: "insured_last_name", label: "Apellido", width: "third" },
    { code: "insured_email", label: "Email", width: "third" },
    { code: "insured_phone", label: "Teléfono", width: "third" },
    { code: "insured_address", label: "Dirección", width: "full" },
    { code: "insured_country", label: "País", width: "quarter" },
    { code: "insured_region", label: "Región", width: "quarter" },
    { code: "insured_city", label: "Ciudad", width: "quarter" },
    { code: "insured_commune", label: "Comuna", width: "quarter" },
  ],
  claim_address_card: [
    { code: "claim_address", label: "Dirección", width: "third" },
    { code: "claim_destination_housing", label: "Tipo Vivienda", width: "third" },
    { code: "claim_country", label: "País", width: "third" },
    { code: "claim_region", label: "Región", width: "third" },
    { code: "claim_city", label: "Ciudad", width: "third" },
    { code: "claim_commune", label: "Comuna", width: "third" },
  ],
  claim_contact_card: [
    { code: "contact_first_name", label: "Nombre", width: "quarter" },
    { code: "contact_last_name", label: "Apellido", width: "quarter" },
    { code: "contact_email", label: "Email", width: "quarter" },
    { code: "contact_phone", label: "Teléfono", width: "quarter" },
  ],
};

export const ACTION_ENTITIES: {
  code: string;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { code: "action_name", label: "Acción", icon: "⚡", desc: "Nombre de la gestión" },
  { code: "action_issuer", label: "Emisor", icon: "👤", desc: "Quien emite" },
  { code: "action_reviewer", label: "Revisor", icon: "👤", desc: "Quien revisa" },
  { code: "action_approver", label: "Aprobador", icon: "👤", desc: "Quien aprueba" },
  { code: "action_created_at", label: "Creación", icon: "📅", desc: "Fecha de creación" },
  { code: "action_updated_at", label: "Actualización", icon: "📅", desc: "Última actualización" },
  { code: "action_expected_date", label: "Fecha Esperada", icon: "📅", desc: "Fecha esperada" },
];

export const COMPLEX_ENTITIES: {
  code: string;
  label: string;
  icon: string;
  desc: string;
  hasSubFields?: boolean;
}[] = [
  { code: "review_levels", label: "Niveles de Revisión", icon: "✓", desc: "Emisor/Revisor/Aprobador según config de la gestión", hasSubFields: false },
  { code: "claim_coverages", label: "Coberturas", icon: "⊞", desc: "Coberturas del siniestro", hasSubFields: false },
  { code: "claim_reserve", label: "Reserva (vista)", icon: "$", desc: "Reservas del siniestro (solo lectura)", hasSubFields: false },
  { code: "claim_reserve_form", label: "Reserva (editor)", icon: "✎", desc: "Editor de reserva por cobertura", hasSubFields: true },
  { code: "claim_adjustment_form", label: "Ajuste (editor)", icon: "⚖", desc: "Editor de ajuste por cobertura", hasSubFields: true },
  { code: "claim_documents", label: "Solicitud de Documentos", icon: "📄", desc: "Seleccionar documentos a solicitar según línea de negocio", hasSubFields: false },
  { code: "claim_document_receipt", label: "Recepción de Documentos", icon: "✓", desc: "Controlar recepción de documentos solicitados", hasSubFields: false },
  { code: "inspection_session_view", label: "Inspección", icon: "🔍", desc: "Ver estado y resultados de la inspección", hasSubFields: false },
  { code: "claim_participants", label: "Participantes", icon: "👥", desc: "Personas del siniestro", hasSubFields: false },
  { code: "claim_history", label: "Historial", icon: "📋", desc: "Gestiones anteriores", hasSubFields: false },
];

export const ALL_SYSTEM_CODES = new Set([
  ...CLAIM_ENTITIES.map((e) => e.code),
  ...ACTION_ENTITIES.map((e) => e.code),
  ...COMPLEX_ENTITIES.map((e) => e.code),
]);

// Utilidad: ancho de columna → clases Tailwind
// Usa grid de 60 columnas (LCM de 1,2,3,4,5,6) para soportar todos los anchos
export function widthClass(width: FieldWidth = "full"): string {
  switch (width) {
    case "full":
      return "col-span-[60]";
    case "half":
      return "col-span-[30]";
    case "third":
      return "col-span-[20]";
    case "quarter":
      return "col-span-[15]";
    case "fifth":
      return "col-span-[12]";
    case "sixth":
      return "col-span-[10]";
    default:
      return "col-span-[60]";
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers de reglas condicionales (visibilidad / obligatoriedad)
// ═══════════════════════════════════════════════════════════════

// Evalúa una regla contra los valores actuales del formulario
// Comparación case-insensitive (ej: "Coordinada" === "coordinada" → true)
export function evalRule(rule: VisibilityRule, values: Record<string, unknown>): boolean {
  const ctrlValue = String(values[rule.field] ?? "").toLowerCase();
  const ruleValue = rule.value;
  switch (rule.operator) {
    case "equals":
      return ctrlValue === String(ruleValue).toLowerCase();
    case "not_equals":
      return ctrlValue !== String(ruleValue).toLowerCase();
    case "in":
      return Array.isArray(ruleValue) && ruleValue.some(v => ctrlValue === String(v).toLowerCase());
    case "not_in":
      return Array.isArray(ruleValue) && !ruleValue.some(v => ctrlValue === String(v).toLowerCase());
    default:
      return true;
  }
}

// ¿El campo debe mostrarse según su visibilityRule?
export function isFieldVisible(field: ScreenField, values: Record<string, unknown>): boolean {
  if (!field.visibilityRule) return true;
  return evalRule(field.visibilityRule, values);
}

// ¿El campo es obligatorio? (requiredRule tiene prioridad sobre required)
export function isFieldRequired(field: ScreenField, values: Record<string, unknown>): boolean {
  if (field.requiredRule) return evalRule(field.requiredRule, values);
  return !!field.required;
}

// Utilidad: crear campo nuevo con defaults
export function createField(
  category: FieldCategory,
  type: string,
  label: string
): ScreenField {
  const base: ScreenField = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    type,
    label,
    required: false,
    width: "full",
  };

  if (type === "text") {
    base.inputType = "alphanumeric";
    base.maxLength = 100;
  }
  if (type === "textarea") {
    base.maxLength = 500;
    base.rows = 3;
  }
  if (type === "date") {
    base.dateType = "date";
  }
  if (type === "select") {
    base.options = [{ value: "1", label: "Opción 1" }];
  }
  if (type === "table") {
    base.columns = ["Columna 1", "Columna 2"];
  }
  if (category === "complex_entity") {
    // Entidades complejas siempre full width (tablas, editores)
    base.width = "full";
  }

  return base;
}
