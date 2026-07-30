/**
 * Lógica de dibujo de figuras geométricas con drag-to-create.
 *
 * Reproduce las herramientas del canvas raster original (línea, rectángulo,
 * círculo, triángulo) pero sobre objetos vectoriales de Fabric: al presionar
 * se crea una figura temporal; al arrastrar se actualiza su tamaño; al soltar
 * se finaliza. El resultado es un objeto persistente y seleccionable, no un
 * trazo bitmap.
 */

import * as fabric from "fabric";
import type { SketchMode } from "./sketch-types";

/** Crea una figura temporal vacía en el punto inicial. */
export function createShape(
  mode: Extract<SketchMode, "line" | "rectangle" | "circle" | "triangle">,
  x: number,
  y: number,
  color: string,
  lineWidth: number
): fabric.Object {
  const common = { stroke: color, strokeWidth: lineWidth, fill: "transparent" };
  switch (mode) {
    case "line":
      return new fabric.Line([x, y, x, y], { ...common, strokeLineCap: "round" });
    case "rectangle":
      return new fabric.Rect({ left: x, top: y, width: 0, height: 0, ...common });
    case "circle":
      return new fabric.Circle({ left: x, top: y, radius: 0, originX: "left", originY: "top", ...common });
    case "triangle":
      return new fabric.Triangle({ left: x, top: y, width: 0, height: 0, ...common });
  }
}

/** Actualiza la figura temporal según el punto actual del puntero. */
export function updateShape(
  obj: fabric.Object,
  mode: Extract<SketchMode, "line" | "rectangle" | "circle" | "triangle">,
  start: { x: number; y: number },
  current: { x: number; y: number }
) {
  switch (mode) {
    case "line": {
      const line = obj as fabric.Line;
      line.set({ x2: current.x, y2: current.y });
      break;
    }
    case "rectangle": {
      const rect = obj as fabric.Rect;
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      rect.set({ left, top, width, height });
      break;
    }
    case "circle": {
      const circle = obj as fabric.Circle;
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const radius = Math.sqrt(dx * dx + dy * dy) / 2;
      // Centrar el círculo entre el start y el current.
      circle.set({
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        radius,
      });
      break;
    }
    case "triangle": {
      const tri = obj as fabric.Triangle;
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      tri.set({ left, top, width, height });
      break;
    }
  }
}
