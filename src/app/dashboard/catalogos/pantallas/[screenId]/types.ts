// Tipos compartidos del ScreenBuilder
// El ancho de columna permite layout multi-columna en el canvas

export type FieldWidth = "full" | "half" | "third" | "quarter";

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

export interface ScreenField {
  id: string;
  category: FieldCategory;
  type: string;
  label: string;
  required?: boolean;
  width?: FieldWidth;

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
}

// Catálogos de campos disponibles

export const OWN_FIELD_TYPES: {
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

export const CLAIM_ENTITIES: {
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
  // Datos de la reserva (para pantalla de ajuste — solo lectura)
  { code: "reserve_number", label: "N° Reserva", icon: "#", desc: "Número de la reserva origen" },
  { code: "reserve_currency", label: "Moneda Reserva", icon: "$", desc: "Moneda de la reserva (no editable)" },
  { code: "reserve_payment_date", label: "Fecha Pago Reserva", icon: "📅", desc: "Fecha de pago de la reserva (no editable)" },
];

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
  { code: "claim_participants", label: "Participantes", icon: "👥", desc: "Personas del siniestro", hasSubFields: false },
  { code: "claim_history", label: "Historial", icon: "📋", desc: "Gestiones anteriores", hasSubFields: false },
];

export const ALL_SYSTEM_CODES = new Set([
  ...CLAIM_ENTITIES.map((e) => e.code),
  ...ACTION_ENTITIES.map((e) => e.code),
  ...COMPLEX_ENTITIES.map((e) => e.code),
]);

// Utilidad: ancho de columna → clases Tailwind
export function widthClass(width: FieldWidth = "full"): string {
  switch (width) {
    case "full":
      return "col-span-12";
    case "half":
      return "col-span-6";
    case "third":
      return "col-span-4";
    case "quarter":
      return "col-span-3";
    default:
      return "col-span-12";
  }
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
