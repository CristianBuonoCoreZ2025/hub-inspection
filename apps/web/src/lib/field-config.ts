import type {
  PropertyClassification,
  HousingDestination,
  ClassificationDestination,
} from "@/types";

export const ALWAYS_VISIBLE_FIELDS = ["age_years", "owner_name", "worker_resident_count"];

export const DEFAULT_LABELS: Record<string, string> = {
  age_years: "Antigüedad del Inmueble",
  owner_name: "Nombre Propietario(s)",
  worker_resident_count: "N° Habitantes",
  apartment_number: "N° Dpto / Oficina",
  floor_count: "N° Pisos",
  built_surface: "Superficie Construida (m²)",
  room_count: "Cantidad Espacios",
  bathroom_count: "Cantidad Baños",
  is_habitable: "¿Se encuentra habitable?",
  office_count: "N° Oficinas",
  warehouse_count: "N° Bodegas",
  branch_count: "Sucursales",
  business_line: "Rubro de la Empresa",
};

// Orden de los campos en el formulario y reporte.
// Los campos siempre visibles (ALWAYS_VISIBLE_FIELDS) se ordenan primero.
// Cambiar estos números reordena los campos en toda la app.
export const FIELD_ORDER: Record<string, number> = {
  age_years: 1,
  owner_name: 2,
  worker_resident_count: 3,
  apartment_number: 4,
  floor_count: 5,
  built_surface: 6,
  room_count: 7,
  bathroom_count: 8,
  is_habitable: 9,
  office_count: 10,
  warehouse_count: 11,
  branch_count: 12,
  business_line: 13,
};

// Todos los campos dinámicos (excluyendo los selects fijos destino/clasificacion)
export const DYNAMIC_FIELDS = [
  "age_years",
  "owner_name",
  "worker_resident_count",
  "apartment_number",
  "floor_count",
  "built_surface",
  "room_count",
  "bathroom_count",
  "is_habitable",
  "office_count",
  "warehouse_count",
  "branch_count",
  "business_line",
] as const;

// Retorna los campos visibles ordenados por FIELD_ORDER (o order del config si se pasa)
export function getSortedVisibleFields(visible: Set<string>, customOrder?: Record<string, number>): string[] {
  const orderMap = customOrder ? { ...FIELD_ORDER, ...customOrder } : FIELD_ORDER;
  return DYNAMIC_FIELDS
    .filter((key) => visible.has(key))
    .sort((a, b) => (orderMap[a] ?? 99) - (orderMap[b] ?? 99));
}

type FieldConfigViejo = {
  show?: string[] | Record<string, string[]>;
  hide?: string[] | Record<string, string[]>;
  labels?: Record<string, string | Record<string, string>>;
};

type FieldConfigNuevo = {
  // show puede ser array (viejo) o objeto {residential: [...], commercial: [...]} (nuevo)
  show?: string[] | Record<string, string[]>;
  hide?: string[] | Record<string, string[]>;
  labels?: Record<string, string | Record<string, string>>;
  order?: Record<string, number>;
};

export interface ResolvedFieldConfig {
  visible: Set<string>;
  labelFor: (key: string) => string;
  order?: Record<string, number>;
}

/**
 * Resuelve la configuración de campos visible + labels usando dual-read:
 *
 * - Modelo nuevo (destination_type existe en el destino):
 *   visible = classification.show (sin merge)
 *   labels  = classification.labels[field][destination_type] o fallback
 *
 * - Modelo viejo (destination_type es NULL):
 *   visible = ALWAYS_VISIBLE + classConfig.show + destConfig.show - hides
 *   labels  = classConfig.labels > destConfig.labels > default
 */
export function resolveFieldConfig(
  riskClass: string,
  propertyType: string,
  classifications: PropertyClassification[],
  destinations: HousingDestination[],
): ResolvedFieldConfig {
  const classification = classifications.find((c) => c.name === riskClass);
  const destination = destinations.find((d) => d.name === propertyType);
  const destType = destination?.destination_type;

  // ── Modelo nuevo: el destino tiene destination_type ──
  if (destType) {
    const cfg = classification?.field_config as FieldConfigNuevo | undefined;
    const visible = new Set<string>(ALWAYS_VISIBLE_FIELDS);

    // show puede ser array (viejo) o objeto {residential: [...], commercial: [...]} (nuevo)
    const showRaw = cfg?.show;
    if (Array.isArray(showRaw)) {
      showRaw.forEach((f) => visible.add(f));
    } else if (showRaw && typeof showRaw === "object") {
      showRaw[destType]?.forEach((f) => visible.add(f));
    }

    const hideRaw = cfg?.hide;
    if (Array.isArray(hideRaw)) {
      hideRaw.forEach((f) => visible.delete(f));
    } else if (hideRaw && typeof hideRaw === "object") {
      hideRaw[destType]?.forEach((f) => visible.delete(f));
    }

    const labelFor = (key: string): string => {
      const raw = cfg?.labels?.[key];
      if (typeof raw === "object" && raw !== null) {
        // Labels en 2 columnas: {residential: "...", commercial: "..."}
        return raw[destType] || DEFAULT_LABELS[key] || key;
      }
      if (typeof raw === "string") {
        // Label plano (formato viejo aún no migrado)
        return raw;
      }
      return DEFAULT_LABELS[key] || key;
    };

    return { visible, labelFor, order: cfg?.order as Record<string, number> | undefined };
  }

  // ── Modelo viejo (fallback): merge classConfig + destConfig ──
  // Se activa cuando property_type es vacío o no coincide con ningún destino.
  // IMPORTANTE: después de la migración 346, classConfig.show puede ser
  // objeto {residential: [...], commercial: [...]} en vez de array.
  // Hay que manejar ambos formatos para no romper inspecciones viejas.
  const classConfig = classification?.field_config as FieldConfigViejo | undefined;
  const destConfig = destination?.field_config as FieldConfigViejo | undefined;

  const visible = new Set<string>(ALWAYS_VISIBLE_FIELDS);

  // show: puede ser array (viejo) u objeto (nuevo). Si es objeto, combinar ambos tipos.
  const classShow = classConfig?.show;
  if (Array.isArray(classShow)) {
    classShow.forEach((f) => visible.add(f));
  } else if (classShow && typeof classShow === "object") {
    [...(classShow.residential || []), ...(classShow.commercial || [])].forEach((f) => visible.add(f));
  }
  const destShow = destConfig?.show;
  if (Array.isArray(destShow)) {
    destShow.forEach((f) => visible.add(f));
  } else if (destShow && typeof destShow === "object") {
    [...(destShow.residential || []), ...(destShow.commercial || [])].forEach((f) => visible.add(f));
  }

  // hide: mismo tratamiento
  const classHide = classConfig?.hide;
  if (Array.isArray(classHide)) {
    classHide.forEach((f) => visible.delete(f));
  } else if (classHide && typeof classHide === "object") {
    [...(classHide.residential || []), ...(classHide.commercial || [])].forEach((f) => visible.delete(f));
  }
  const destHide = destConfig?.hide;
  if (Array.isArray(destHide)) {
    destHide.forEach((f) => visible.delete(f));
  } else if (destHide && typeof destHide === "object") {
    [...(destHide.residential || []), ...(destHide.commercial || [])].forEach((f) => visible.delete(f));
  }

  // labels: puede ser string (viejo) u objeto {residential: "...", commercial: "..."} (nuevo).
  // Si es objeto, preferir residential (fallback más común para inspecciones viejas sin destino).
  const labelFor = (key: string): string => {
    const classRaw = classConfig?.labels?.[key];
    if (typeof classRaw === "string") return classRaw;
    if (typeof classRaw === "object" && classRaw !== null) {
      return classRaw.residential || classRaw.commercial || DEFAULT_LABELS[key] || key;
    }
    const destRaw = destConfig?.labels?.[key];
    if (typeof destRaw === "string") return destRaw;
    if (typeof destRaw === "object" && destRaw !== null) {
      return destRaw.residential || destRaw.commercial || DEFAULT_LABELS[key] || key;
    }
    return DEFAULT_LABELS[key] || key;
  };

  return { visible, labelFor };
}

/**
 * Filtra las clasificaciones relacionadas con un destino específico.
 * Si no hay relaciones definidas, retorna todas (fallback).
 */
export function filterClassificationsByDestination(
  classifications: PropertyClassification[],
  destinations: HousingDestination[],
  relations: ClassificationDestination[],
  propertyType: string,
): PropertyClassification[] {
  const destination = destinations.find((d) => d.name === propertyType);
  if (!destination) return classifications;

  const relatedClassificationIds = relations
    .filter((r) => r.destination_id === destination.id)
    .map((r) => r.classification_id);

  // Si no hay relaciones definidas, mostrar todas (fallback)
  if (relatedClassificationIds.length === 0) return classifications;

  return classifications.filter((c) => relatedClassificationIds.includes(c.id));
}
