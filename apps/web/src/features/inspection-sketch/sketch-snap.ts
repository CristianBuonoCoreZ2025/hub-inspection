/**
 * Motor de Snap — asociación automática por proximidad.
 *
 * El snap es un comportamiento del motor, no de cada entidad. Soporta:
 *  - Puertas y ventanas se asocian a muros por proximidad.
 *  - Muros conectan extremos con otros muros.
 *  - Espacios alinean bordes con otros espacios.
 *  - Guías de alineación visuales al arrastrar objetos.
 *
 * Si un muro se mueve, las puertas y ventanas asociadas se reubican para
 * mantener la relación. No quedan flotando.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 13 (Snap) y § 14 (Relaciones).
 */

import type * as fabric from "fabric";
import { getEntityMeta, setEntityMeta } from "./entity-renderer";

/** Umbral de proximidad en px para asociar puerta/ventana a muro. */
const SNAP_THRESHOLD = 30;

/** Umbral de alineación en px para guías visuales. */
const ALIGN_THRESHOLD = 8;

/** Resultado de un cálculo de snap. */
export interface SnapResult {
  /** Objeto al que se asoció (muro), o null si no hubo snap. */
  attachedTo: fabric.Object | null;
  /** ID del objeto al que se asoció (para persistencia). */
  attachedToId: string | null;
  /** Posición ajustada después del snap. */
  left: number;
  top: number;
}

/**
 * Busca el muro más cercano a una posición dada.
 *
 * @param canvas Lienzo Fabric.
 * @param x Posición X del centro de la entidad a asociar.
 * @param y Posición Y del centro de la entidad a asociar.
 * @returns El muro más cercano dentro del umbral, o null.
 */
function findNearestWall(
  canvas: fabric.Canvas,
  x: number,
  y: number
): fabric.Object | null {
  let nearest: fabric.Object | null = null;
  let minDist = SNAP_THRESHOLD;

  for (const obj of canvas.getObjects()) {
    const meta = getEntityMeta(obj);
    if (meta?.catalogId !== "muro") continue;

    // Calcular distancia del punto al centro del muro.
    const objCenter = obj.getCenterPoint();
    const dist = Math.sqrt(
      (x - objCenter.x) ** 2 + (y - objCenter.y) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = obj;
    }
  }
  return nearest;
}

/**
 * Asocia una entidad (puerta/ventana) al muro más cercano por proximidad.
 *
 * @param canvas Lienzo Fabric.
 * @param obj Entidad a asociar (puerta o ventana).
 * @returns Resultado del snap con la posición ajustada y el muro asociado.
 */
export function snapToWall(
  canvas: fabric.Canvas,
  obj: fabric.Object
): SnapResult {
  const center = obj.getCenterPoint();
  const wall = findNearestWall(canvas, center.x, center.y);

  if (!wall) {
    return { attachedTo: null, attachedToId: null, left: obj.left ?? 0, top: obj.top ?? 0 };
  }

  // Asociar: guardar el ID del muro en la metadata de la entidad.
  const wallMeta = getEntityMeta(wall);
  const wallId = wallMeta?.name ?? "";
  setEntityMeta(obj, { attachedTo: wallId });

  // Ajustar posición: centrar la puerta/ventana sobre el muro.
  const wallCenter = wall.getCenterPoint();
  const adjustedLeft = wallCenter.x - (obj.width ?? 0) / 2;
  const adjustedTop = wallCenter.y - (obj.height ?? 0) / 2;

  return { attachedTo: wall, attachedToId: wallId, left: adjustedLeft, top: adjustedTop };
}

/**
 * Reubica las entidades asociadas a un muro cuando el muro se mueve.
 *
 * @param canvas Lienzo Fabric.
 * @param wall Muro que se movió.
 */
export function updateAttachedEntities(
  canvas: fabric.Canvas,
  wall: fabric.Object
): void {
  const wallMeta = getEntityMeta(wall);
  if (!wallMeta) return;
  const wallName = wallMeta.name;

  for (const obj of canvas.getObjects()) {
    const meta = getEntityMeta(obj);
    if (!meta || meta.attachedTo !== wallName) continue;

    // Mantener la entidad centrada sobre el muro.
    const wallCenter = wall.getCenterPoint();
    obj.set({
      left: wallCenter.x - (obj.width ?? 0) / 2,
      top: wallCenter.y - (obj.height ?? 0) / 2,
    });
    obj.setCoords();
  }
  canvas.requestRenderAll();
}

/** Líneas guía para alineación visual al arrastrar. */
export interface AlignGuides {
  vertical: number | null;
  horizontal: number | null;
}

/**
 * Calcula las guías de alineación para un objeto que se está arrastrando.
 *
 * Compara los bordes del objeto arrastrado con los bordes de los demás
 * objetos del lienzo. Si están dentro del umbral, devuelve la coordenada
 * de alineación.
 *
 * @param canvas Lienzo Fabric.
 * @param obj Objeto que se está arrastrando.
 * @returns Guías verticales y horizontales (o null si no hay alineación).
 */
export function calculateAlignGuides(
  canvas: fabric.Canvas,
  obj: fabric.Object
): AlignGuides {
  const center = obj.getCenterPoint();
  let vertical: number | null = null;
  let horizontal: number | null = null;

  for (const other of canvas.getObjects()) {
    if (other === obj) continue;
    const otherCenter = other.getCenterPoint();

    // Alineación vertical (mismo X).
    if (Math.abs(center.x - otherCenter.x) < ALIGN_THRESHOLD) {
      vertical = otherCenter.x;
    }
    // Alineación horizontal (mismo Y).
    if (Math.abs(center.y - otherCenter.y) < ALIGN_THRESHOLD) {
      horizontal = otherCenter.y;
    }
  }
  return { vertical, horizontal };
}

/**
 * Aplica las guías de alineación ajustando la posición del objeto.
 *
 * @param obj Objeto a alinear.
 * @param guides Guías calculadas.
 */
export function applyAlignGuides(obj: fabric.Object, guides: AlignGuides): void {
  const center = obj.getCenterPoint();
  let dx = 0;
  let dy = 0;

  if (guides.vertical !== null) {
    dx = guides.vertical - center.x;
  }
  if (guides.horizontal !== null) {
    dy = guides.horizontal - center.y;
  }

  if (dx !== 0 || dy !== 0) {
    obj.set({
      left: (obj.left ?? 0) + dx,
      top: (obj.top ?? 0) + dy,
    });
    obj.setCoords();
  }
}
