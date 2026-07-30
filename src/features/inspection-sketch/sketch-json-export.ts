/**
 * Exportación estructurada del croquis a JSON.
 *
 * Serializa todas las entidades del lienzo a una estructura de datos
 * organizada para que una IA pueda leerla sin interpretar la imagen.
 *
 * Hoy el backend sigue recibiendo solo el PNG (sketch-export.ts). Esta
 * estructura queda disponible en el editor para cuando se decida enviarla
 * al endpoint. No requiere rediseñar el editor.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 18 (Estructura de datos).
 */

import type * as fabric from "fabric";
import { getEntityMeta } from "./entity-renderer";
import { getEntityDefinition } from "./entity-renderer";
import type { EntityCategory } from "./entity-types";

/** Representación de una entidad en el JSON exportado. */
export interface SketchEntityData {
  /** ID de la definición en el catálogo. */
  catalogId: string;
  /** Categoría. */
  category: EntityCategory;
  /** Nombre visible (D1, B1, M1, P1, etc. o texto de anotación). */
  name: string;
  /** Etiqueta del catálogo (Dormitorio, Baño, Muro...). */
  label: string;
  /** Posición X en px. */
  x: number;
  /** Posición Y en px. */
  y: number;
  /** Ancho en px. */
  width: number;
  /** Alto en px. */
  height: number;
  /** Ángulo de rotación en grados. */
  angle: number;
  /** Textura (para espacios). */
  texture: string;
  /** Propiedades editables (medidas, tipo, destino, etc.). */
  properties: Record<string, string | number | null>;
  /** ID de la entidad a la que está asociada (ej: puerta -> muro). */
  attachedTo: string | null;
  /** Color de anotación (solo para annotations). */
  annotationColor: string | null;
}

/** Estructura completa del croquis exportado. */
export interface SketchExportData {
  /** Versión del formato. */
  version: number;
  /** Fecha de exportación (ISO). */
  exportedAt: string;
  /** Entidades del plano, agrupadas por categoría. */
  entities: SketchEntityData[];
  /** Resumen por categoría (conteo). */
  summary: Record<EntityCategory, number>;
}

/**
 * Exporta todas las entidades del lienzo a una estructura JSON organizada.
 *
 * @param canvas Lienzo Fabric.
 * @returns Estructura de datos lista para serializar a JSON.
 */
export function exportSketchToJson(canvas: fabric.Canvas): SketchExportData {
  const entities: SketchEntityData[] = [];
  const summary: Record<EntityCategory, number> = {
    spaces: 0,
    structure: 0,
    objects: 0,
    equipment: 0,
    annotations: 0,
  };

  for (const obj of canvas.getObjects()) {
    const meta = getEntityMeta(obj);
    if (!meta) continue;

    const def = getEntityDefinition(meta.catalogId);
    const center = obj.getCenterPoint();

    entities.push({
      catalogId: meta.catalogId,
      category: meta.category,
      name: meta.name,
      label: def?.label ?? meta.catalogId,
      x: Math.round(center.x),
      y: Math.round(center.y),
      width: Math.round(obj.width ?? 0),
      height: Math.round(obj.height ?? 0),
      angle: Math.round(obj.angle ?? 0),
      texture: meta.texture,
      properties: meta.properties,
      attachedTo: meta.attachedTo ?? null,
      annotationColor: meta.annotationColor ?? null,
    });

    summary[meta.category]++;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    summary,
  };
}

/**
 * Serializa el croquis a string JSON.
 *
 * @param canvas Lienzo Fabric.
 * @returns JSON string con la estructura del plano.
 */
export function exportSketchToJsonString(canvas: fabric.Canvas): string {
  return JSON.stringify(exportSketchToJson(canvas), null, 2);
}
