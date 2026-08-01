/**
 * Definición de propiedades editables por entidad.
 *
 * El panel de propiedades (doble clic) lee esta definición para saber qué
 * campos mostrar. Cada propiedad tiene un tipo de input y una etiqueta.
 * Nunca se muestran formularios largos: solo las propiedades mínimas.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 5 (categorías) y § 10 (propiedades).
 */

import type { PropertyName, WallType } from "./entity-types";

/** Tipo de input para una propiedad. */
export type PropertyInputType =
  | "text"
  | "number"
  | "select"
  | "texture"
  | "color";

/** Definición de una propiedad editable. */
export interface PropertyField {
  name: PropertyName;
  label: string;
  inputType: PropertyInputType;
  /** Opciones para select (si aplica). */
  options?: { value: string; label: string }[];
  /** Sufijo a mostrar junto al valor (ej: "m" para metros). */
  suffix?: string;
  /** Si true, el campo puede estar vacío (no se muestra sobre el plano). */
  optional?: boolean;
}

/** Opciones de tipo de muro. */
const WALL_TYPE_OPTIONS: { value: WallType; label: string }[] = [
  { value: "interior", label: "Interior" },
  { value: "exterior", label: "Exterior" },
  { value: "medianero", label: "Medianero" },
];

/** Mapa de propiedades por nombre (definición reutilizable). */
const FIELD_DEFS: Record<PropertyName, PropertyField> = {
  name: { name: "name", label: "Nombre", inputType: "text" },
  width: { name: "width", label: "Ancho", inputType: "number", optional: true },
  height: { name: "height", label: "Alto", inputType: "number", optional: true },
  length: { name: "length", label: "Longitud", inputType: "number", optional: true },
  wallType: { name: "wallType", label: "Tipo", inputType: "select", options: WALL_TYPE_OPTIONS },
  destination: { name: "destination", label: "Destino", inputType: "text", optional: true },
  text: { name: "text", label: "Texto", inputType: "text" },
  color: { name: "color", label: "Color", inputType: "color" },
};

/**
 * Devuelve las propiedades editables para una entidad, en el orden correcto.
 *
 * @param propertyNames Lista de nombres de propiedad del catálogo.
 * @returns Campos de propiedades para el panel.
 */
export function getPropertyFields(propertyNames: PropertyName[]): PropertyField[] {
  return propertyNames.map((name) => FIELD_DEFS[name]).filter(Boolean);
}

/** Valores iniciales para las propiedades de una entidad. */
export function getDefaultProperties(
  propertyNames: PropertyName[],
  autoName: string
): Record<string, string | number | null> {
  const props: Record<string, string | number | null> = {};
  for (const name of propertyNames) {
    switch (name) {
      case "name": props[name] = autoName; break;
      case "color": props[name] = "yellow"; break;
      default: props[name] = null; break;
    }
  }
  return props;
}
