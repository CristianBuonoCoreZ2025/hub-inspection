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

type FieldConfigViejo = {
  show?: string[];
  hide?: string[];
  labels?: Record<string, string>;
};

type FieldConfigNuevo = {
  show?: string[];
  hide?: string[];
  labels?: Record<string, string | Record<string, string>>;
};

export interface ResolvedFieldConfig {
  visible: Set<string>;
  labelFor: (key: string) => string;
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
    cfg?.show?.forEach((f) => visible.add(f));
    cfg?.hide?.forEach((f) => visible.delete(f));

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

    return { visible, labelFor };
  }

  // ── Modelo viejo (fallback): merge classConfig + destConfig ──
  const classConfig = classification?.field_config as FieldConfigViejo | undefined;
  const destConfig = destination?.field_config as FieldConfigViejo | undefined;

  const visible = new Set<string>(ALWAYS_VISIBLE_FIELDS);
  classConfig?.show?.forEach((f) => visible.add(f));
  destConfig?.show?.forEach((f) => visible.add(f));
  classConfig?.hide?.forEach((f) => visible.delete(f));
  destConfig?.hide?.forEach((f) => visible.delete(f));

  const labelFor = (key: string): string =>
    classConfig?.labels?.[key] || destConfig?.labels?.[key] || DEFAULT_LABELS[key] || key;

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
