/**
 * Numeración automática de entidades.
 *
 * Asigna nombres automáticos usando el label completo del catálogo:
 * "Dormitorio 1", "Dormitorio 2", "Baño 1", "Muro 1", "Puerta 1"...
 * El usuario nunca está obligado a escribir un nombre.
 *
 * Reglas:
 *  - El nombre usa el label completo del catálogo (def.label), no la
 *    abreviación (def.defaultLabel). Así el plano es autoexplicativo.
 *  - Si hay una sola entidad de ese tipo, no se agrega número ("Cocina",
 *    no "Cocina 1"). Excepto tipos que típicamente aparecen múltiples
 *    veces (dormitorio, baño, muro, puerta, ventana, estacionamiento),
 *    que siempre llevan número desde el primero.
 *  - Si defaultLabel es vacío (anotaciones), el nombre es el texto que
 *    el usuario ingresó al soltar la entidad.
 */

import type * as fabric from "fabric";
import { getEntityMeta, getEntityDefinition } from "./entity-renderer";

/** Tipos que siempre llevan número desde el primero (aparecen múltiples veces). */
const ALWAYS_NUMBERED = new Set([
  "dormitorio", "bano", "muro", "puerta", "ventana", "estacionamiento",
]);

/**
 * Genera el nombre automático para una nueva entidad.
 *
 * @param entityId ID de la definición en el catálogo.
 * @param canvas Lienzo Fabric para contar entidades existentes del mismo tipo.
 * @returns Nombre automático (ej: "Dormitorio 1", "Baño 1", "Cocina", "Muro 1").
 */
export function generateAutoName(
  entityId: string,
  canvas: fabric.Canvas
): string {
  const def = getEntityDefinition(entityId);
  if (!def) return "";

  // Anotaciones: sin nombre automático (el usuario escribe el texto).
  if (!def.defaultLabel) return "";

  // Contar cuántas entidades del mismo catalogId ya existen.
  const existing = canvas.getObjects().filter((obj) => {
    const meta = getEntityMeta(obj);
    return meta?.catalogId === entityId;
  });

  const count = existing.length + 1;

  // Si no es siempre numerado y es la primera, sin número.
  if (count === 1 && !ALWAYS_NUMBERED.has(entityId)) {
    return def.label;
  }

  return `${def.label} ${count}`;
}

/**
 * Renumera todas las entidades del mismo tipo después de eliminar una.
 * Ej: si eliminas "Dormitorio 2", "Dormitorio 3" pasa a ser "Dormitorio 2".
 */
export function renumberEntities(
  entityId: string,
  canvas: fabric.Canvas,
  onUpdateName: (obj: fabric.Object, newName: string) => void
): void {
  const def = getEntityDefinition(entityId);
  if (!def || !def.defaultLabel) return;

  const objects = canvas.getObjects().filter((obj) => {
    const meta = getEntityMeta(obj);
    return meta?.catalogId === entityId;
  });

  objects.forEach((obj, index) => {
    const count = index + 1;
    const newName = count === 1 && !ALWAYS_NUMBERED.has(entityId)
      ? def.label
      : `${def.label} ${count}`;
    onUpdateName(obj, newName);
  });
}
