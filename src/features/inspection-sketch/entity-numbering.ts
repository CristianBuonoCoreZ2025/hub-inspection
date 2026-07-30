/**
 * Numeración automática de entidades.
 *
 * Asigna nombres automáticos (D1, D2, B1, C, M1, P1, V1...) basándose en el
 * defaultLabel del catálogo y cuántas entidades del mismo tipo ya existen en
 * el lienzo. El usuario nunca está obligado a escribir un nombre.
 *
 * Reglas:
 *  - Si defaultLabel es vacío (anotaciones), el nombre es el texto que el
 *    usuario ingresó al soltar la entidad.
 *  - Si defaultLabel no es vacío, el nombre es defaultLabel + número correlativo.
 *  - Excepción: si solo hay una entidad de ese tipo y el defaultLabel es de
 *    una sola letra, no se agrega número (ej: "C" para cocina, no "C1").
 *    Para tipos que típicamente aparecen múltiples veces (dormitorio, baño,
 *    muro, puerta, ventana), siempre se agrega número desde el primero.
 */

import type * as fabric from "fabric";
import { getEntityMeta } from "./entity-renderer";
import { getEntityDefinition } from "./entity-renderer";

/** Tipos que siempre llevan número desde el primero (aparecen múltiples veces). */
const ALWAYS_NUMBERED = new Set([
  "dormitorio", "bano", "muro", "puerta", "ventana", "estacionamiento",
]);

/**
 * Genera el nombre automático para una nueva entidad.
 *
 * @param entityId ID de la definición en el catálogo.
 * @param canvas Lienzo Fabric para contar entidades existentes del mismo tipo.
 * @returns Nombre automático (ej: "D1", "B1", "C", "M1").
 */
export function generateAutoName(
  entityId: string,
  canvas: fabric.Canvas
): string {
  const def = getEntityDefinition(entityId);
  if (!def || !def.defaultLabel) return "";

  // Contar cuántas entidades del mismo catalogId ya existen.
  const existing = canvas.getObjects().filter((obj) => {
    const meta = getEntityMeta(obj);
    return meta?.catalogId === entityId;
  });

  const count = existing.length + 1;

  // Si no es siempre numerado y es la primera, sin número.
  if (count === 1 && !ALWAYS_NUMBERED.has(entityId)) {
    return def.defaultLabel;
  }

  return `${def.defaultLabel}${count}`;
}

/**
 * Renumera todas las entidades del mismo tipo después de eliminar una.
 * Ej: si eliminas D2, D3 pasa a ser D2.
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
      ? def.defaultLabel
      : `${def.defaultLabel}${count}`;
    onUpdateName(obj, newName);
  });
}
