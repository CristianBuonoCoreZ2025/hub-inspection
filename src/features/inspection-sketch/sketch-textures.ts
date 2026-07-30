/**
 * Texturas visuales para espacios.
 *
 * Las texturas NO representan materiales. Sirven únicamente para distinguir
 * visualmente sectores y mejorar la lectura del croquis.
 *
 * Cada textura se implementa como un patrón de Fabric (PatternBrush o fill
 * con Pattern). Se aplican como overlay sobre el rectángculo del espacio.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 12 (Texturas configurables).
 */

import * as fabric from "fabric";
import type { TextureId } from "./entity-types";

/** Colores de textura (suaves, no representan materialidad). */
const TEXTURE_COLORS: Record<string, string> = {
  dots: "#94a3b8",
  lines: "#94a3b8",
  grid: "#94a3b8",
  tiles: "#94a3b8",
};

/** Crea un patrón de puntos. */
function createDotsPattern(): fabric.Pattern {
  const tile = new fabric.StaticCanvas(undefined, { width: 16, height: 16, backgroundColor: "transparent" });
  const dot = new fabric.Circle({ radius: 1.5, fill: TEXTURE_COLORS.dots, left: 7, top: 7, selectable: false, evented: false });
  tile.add(dot);
  return new fabric.Pattern({ source: tile.getElement(), repeat: "repeat" });
}

/** Crea un patrón de líneas diagonales. */
function createLinesPattern(): fabric.Pattern {
  const tile = new fabric.StaticCanvas(undefined, { width: 12, height: 12, backgroundColor: "transparent" });
  const line = new fabric.Line([0, 12, 12, 0], { stroke: TEXTURE_COLORS.lines, strokeWidth: 1, selectable: false, evented: false });
  tile.add(line);
  return new fabric.Pattern({ source: tile.getElement(), repeat: "repeat" });
}

/** Crea un patrón de cuadrícula. */
function createGridPattern(): fabric.Pattern {
  const tile = new fabric.StaticCanvas(undefined, { width: 16, height: 16, backgroundColor: "transparent" });
  const h = new fabric.Line([0, 8, 16, 8], { stroke: TEXTURE_COLORS.grid, strokeWidth: 0.8, selectable: false, evented: false });
  const v = new fabric.Line([8, 0, 8, 16], { stroke: TEXTURE_COLORS.grid, strokeWidth: 0.8, selectable: false, evented: false });
  tile.add(h, v);
  return new fabric.Pattern({ source: tile.getElement(), repeat: "repeat" });
}

/** Crea un patrón de baldosas. */
function createTilesPattern(): fabric.Pattern {
  const tile = new fabric.StaticCanvas(undefined, { width: 20, height: 20, backgroundColor: "transparent" });
  const rect = new fabric.Rect({ width: 20, height: 20, fill: "transparent", stroke: TEXTURE_COLORS.tiles, strokeWidth: 0.8, selectable: false, evented: false });
  tile.add(rect);
  return new fabric.Pattern({ source: tile.getElement(), repeat: "repeat" });
}

/** Cache de patrones por textura (se crean una sola vez). */
const patternCache: Partial<Record<TextureId, fabric.Pattern>> = {};

/** Devuelve el patrón de Fabric para una textura, o null si es "none". */
export function getTexturePattern(texture: TextureId): fabric.Pattern | null {
  if (texture === "none") return null;
  if (patternCache[texture]) return patternCache[texture]!;

  let pattern: fabric.Pattern;
  switch (texture) {
    case "dots": pattern = createDotsPattern(); break;
    case "lines": pattern = createLinesPattern(); break;
    case "grid": pattern = createGridPattern(); break;
    case "tiles": pattern = createTilesPattern(); break;
    default: return null;
  }
  patternCache[texture] = pattern;
  return pattern;
}

/** Lista de texturas disponibles para el selector de propiedades. */
export const TEXTURE_OPTIONS: { id: TextureId; label: string }[] = [
  { id: "none", label: "Sin textura" },
  { id: "dots", label: "Textura A" },
  { id: "lines", label: "Textura B" },
  { id: "grid", label: "Textura C" },
  { id: "tiles", label: "Textura D" },
];
