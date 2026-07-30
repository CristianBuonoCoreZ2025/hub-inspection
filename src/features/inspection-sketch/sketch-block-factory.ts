/**
 * Fábrica de objetos Fabric a partir de definiciones de bloques.
 *
 * Cada bloque del catálogo (sketch-blocks.ts) se materializa en un objeto
 * Fabric con controles de selección/resize/rotación habilitados. Las
 * habitaciones y mobiliario son rectángculos o círculos; los muros son líneas
 * gruesas; las puertas, ventanas, escaleras, rampas y portones son grupos de
 * líneas para mayor legibilidad.
 */

import * as fabric from "fabric";
import { BLOCK_BY_ID } from "./sketch-blocks";
import type { BlockDefinition, BlockId } from "./sketch-types";

/** Configuración común de controles para todos los objetos creados. */
function applyCommonControls(obj: fabric.Object, def: BlockDefinition) {
  obj.set({
    cornerStyle: "circle",
    cornerColor: "#0095DA",
    cornerStrokeColor: "#ffffff",
    transparentCorners: false,
    borderScaleFactor: 1.5,
    padding: 4,
    hasRotatingPoint: true,
    rotatingPointOffset: 24,
    originX: "left",
    originY: "top",
  });
  (obj as fabric.Object & { blockId?: BlockId }).blockId = def.id;
}

/** Crea un rectángculo (habitación, mobiliario, tanque, etc.). */
function createRect(def: BlockDefinition, x: number, y: number): fabric.Rect {
  const rect = new fabric.Rect({
    left: x,
    top: y,
    width: def.defaultWidth,
    height: def.defaultHeight,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    opacity: def.opacity,
    rx: 4,
    ry: 4,
  });
  applyCommonControls(rect, def);
  return rect;
}

/** Crea un círculo (vehículo pequeño, motor, árbol, exhibidor, bicicleta). */
function createCircle(def: BlockDefinition, x: number, y: number): fabric.Circle {
  const radius = Math.min(def.defaultWidth, def.defaultHeight) / 2;
  const circle = new fabric.Circle({
    left: x,
    top: y,
    radius,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    opacity: def.opacity,
    originX: "left",
    originY: "top",
  });
  applyCommonControls(circle, def);
  return circle;
}

/** Crea una línea gruesa (muro). */
function createWall(def: BlockDefinition, x: number, y: number): fabric.Line {
  const line = new fabric.Line([x, y, x + def.defaultWidth, y], {
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    strokeLineCap: "round",
  });
  applyCommonControls(line, def);
  return line;
}

/** Crea un grupo que representa una puerta (hoja + arco de apertura). */
function createDoor(def: BlockDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const frame = new fabric.Line([0, h / 2, w, h / 2], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const leaf = new fabric.Line([0, h / 2, 0, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const arc = new fabric.Path(`M 0 0 Q ${w / 2} 0 ${w} ${h / 2}`, {
    stroke: def.stroke, strokeWidth: 1.5, fill: "transparent", strokeDashArray: [4, 3],
  });
  const group = new fabric.Group([frame, leaf, arc], { left: x, top: y });
  applyCommonControls(group, def);
  return group;
}

/** Crea un grupo que representa una ventana (rectángculo con línea central). */
function createWindow(def: BlockDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const top = new fabric.Line([0, 0, w, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const bottom = new fabric.Line([0, h, w, h], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const center = new fabric.Line([0, h / 2, w, h / 2], { stroke: def.stroke, strokeWidth: 1.5, strokeDashArray: [3, 3] });
  const group = new fabric.Group([top, bottom, center], { left: x, top: y });
  applyCommonControls(group, def);
  return group;
}

/** Crea un grupo que representa una escalera (líneas paralelas = peldaños). */
function createStairs(def: BlockDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const steps = 6;
  const objects: fabric.Object[] = [];
  objects.push(new fabric.Line([0, 0, w, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth }));
  objects.push(new fabric.Line([0, h, w, h], { stroke: def.stroke, strokeWidth: def.strokeWidth }));
  for (let i = 1; i < steps; i++) {
    const yStep = (h / steps) * i;
    objects.push(new fabric.Line([0, yStep, w, yStep], { stroke: def.stroke, strokeWidth: 1.5 }));
  }
  const group = new fabric.Group(objects, { left: x, top: y });
  applyCommonControls(group, def);
  return group;
}

/** Crea un grupo que representa una rampa (triángulo + flecha de pendiente). */
function createRamp(def: BlockDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const base = new fabric.Line([0, h, w, h], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const slope = new fabric.Line([0, h, w, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const arrow = new fabric.Path(`M ${w / 2} ${h / 2} L ${w / 2 + 8} ${h / 2 - 8} M ${w / 2} ${h / 2} L ${w / 2 - 6} ${h / 2 - 4}`, {
    stroke: def.stroke, strokeWidth: 2, fill: "transparent",
  });
  const group = new fabric.Group([base, slope, arrow], { left: x, top: y });
  applyCommonControls(group, def);
  return group;
}

/** Crea un grupo que representa un portón (líneas verticales = hojas). */
function createGate(def: BlockDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const frame = new fabric.Rect({ width: w, height: h, fill: "transparent", stroke: def.stroke, strokeWidth: def.strokeWidth });
  const slats = 5;
  const objects: fabric.Object[] = [frame];
  for (let i = 1; i < slats; i++) {
    const xSlat = (w / slats) * i;
    objects.push(new fabric.Line([xSlat, 0, xSlat, h], { stroke: def.stroke, strokeWidth: 1.5 }));
  }
  const group = new fabric.Group(objects, { left: x, top: y });
  applyCommonControls(group, def);
  return group;
}

/**
 * Instancia un bloque del catálogo en la posición dada del canvas.
 *
 * @param blockId Identificador del bloque (debe existir en BLOCK_BY_ID).
 * @param x Coordenada X (esquina superior izquierda) en el canvas.
 * @param y Coordenada Y (esquina superior izquierda) en el canvas.
 * @returns Objeto Fabric listo para agregar al canvas, o null si el id no existe.
 */
export function createBlock(
  blockId: BlockId,
  x: number,
  y: number
): fabric.Object | null {
  const def = BLOCK_BY_ID[blockId];
  if (!def) return null;

  switch (def.id) {
    case "muro":
      return createWall(def, x, y);
    case "puerta":
      return createDoor(def, x, y);
    case "ventana":
      return createWindow(def, x, y);
    case "escalera":
      return createStairs(def, x, y);
    case "rampa":
      return createRamp(def, x, y);
    case "porton":
      return createGate(def, x, y);
    default:
      // Círculos (motor, árbol, exhibidor, bicicleta).
      if (def.fabricType === "circle") return createCircle(def, x, y);
      // Rectángculos (habitaciones, mobiliario, tanque, panel, etc.).
      return createRect(def, x, y);
  }
}
