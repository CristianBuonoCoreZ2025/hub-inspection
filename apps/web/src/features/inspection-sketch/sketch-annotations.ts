/**
 * Anotaciones — etiquetas y comentarios.
 *
 * Reemplazan al texto libre. Tienen formato visual propio:
 *  - Etiqueta: rectángculo con fondo, borde y texto centrado. Identifica
 *    sectores ("Zona inundada", "Acceso", "Segundo piso").
 *  - Comentario: rectángculo con barra lateral y texto. Explica situaciones.
 *
 * Al soltar una anotación, se solicita el texto al usuario (promptText=true
 * en el catálogo). El color se asigna desde la paleta reducida de 5 colores.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 5.5 (Anotaciones).
 */

import * as fabric from "fabric";
import { createEntity, setEntityMeta } from "./entity-renderer";
import { ANNOTATION_COLORS } from "./entity-types";
import type { AnnotationColor } from "./entity-types";

/** Mapa de color -> hex. */
const COLOR_HEX: Record<AnnotationColor, string> = Object.fromEntries(
  ANNOTATION_COLORS.map((c) => [c.id, c.hex])
) as Record<AnnotationColor, string>;

/**
 * Crea una etiqueta en el lienzo con texto y color.
 *
 * @param x Posición X.
 * @param y Posición Y.
 * @param text Texto de la etiqueta.
 * @param color Color de la paleta reducida.
 * @returns Objeto Fabric con la etiqueta.
 */
export function createLabel(
  x: number,
  y: number,
  text: string,
  color: AnnotationColor = "yellow"
): fabric.Object | null {
  const obj = createEntity("etiqueta", x, y, text);
  if (!obj) return null;

  const hex = COLOR_HEX[color];
  setEntityMeta(obj, { annotationColor: color });

  // Aplicar color al borde y fondo.
  if (obj instanceof fabric.Group) {
    const rect = obj.getObjects()[0];
    if (rect instanceof fabric.Rect) {
      rect.set({ stroke: hex, fill: `${hex}20` }); // fill con alpha
    }
  }

  return obj;
}

/**
 * Crea un comentario en el lienzo con texto y color.
 *
 * @param x Posición X.
 * @param y Posición Y.
 * @param text Texto del comentario.
 * @param color Color de la paleta reducida.
 * @returns Objeto Fabric con el comentario.
 */
export function createComment(
  x: number,
  y: number,
  text: string,
  color: AnnotationColor = "blue"
): fabric.Object | null {
  const obj = createEntity("comentario", x, y, text);
  if (!obj) return null;

  const hex = COLOR_HEX[color];
  setEntityMeta(obj, { annotationColor: color });

  // Aplicar color al borde y barra lateral.
  if (obj instanceof fabric.Group) {
    const rect = obj.getObjects()[0];
    const marker = obj.getObjects()[1];
    if (rect instanceof fabric.Rect) {
      rect.set({ stroke: hex, fill: `${hex}15` });
    }
    if (marker instanceof fabric.Rect) {
      marker.set({ fill: hex });
    }
  }

  return obj;
}

/**
 * Actualiza el texto de una anotación existente.
 *
 * @param obj Objeto Fabric de la anotación.
 * @param text Nuevo texto.
 */
export function updateAnnotationText(obj: fabric.Object, text: string): void {
  if (!(obj instanceof fabric.Group)) return;
  // El texto es el último objeto del grupo (índice 1 para label, 2 para comment).
  const objects = obj.getObjects();
  const textObj = objects[objects.length - 1];
  if (textObj instanceof fabric.Text) {
    textObj.set({ text });
  } else if (textObj instanceof fabric.Textbox) {
    textObj.set({ text });
  }
}

/**
 * Cambia el color de una anotación existente.
 *
 * @param obj Objeto Fabric de la anotación.
 * @param color Nuevo color de la paleta reducida.
 */
export function updateAnnotationColor(obj: fabric.Object, color: AnnotationColor): void {
  const hex = COLOR_HEX[color];
  setEntityMeta(obj, { annotationColor: color });

  if (!(obj instanceof fabric.Group)) return;
  const rect = obj.getObjects()[0];
  if (rect instanceof fabric.Rect) {
    rect.set({ stroke: hex, fill: `${hex}20` });
  }
  // Para comentarios, actualizar también la barra lateral.
  const marker = obj.getObjects()[1];
  if (marker instanceof fabric.Rect) {
    marker.set({ fill: hex });
  }
}
