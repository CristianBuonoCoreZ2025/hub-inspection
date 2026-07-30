/**
 * Renderizador de entidades — crea objetos Fabric desde el catalog.json.
 *
 * Este es el puente entre la configuración declarativa (catalog.json) y el
 * lienzo Fabric. Cada renderer sabe cómo construir su representación visual:
 *  - block: rectángculo redimensionable con nombre dentro (espacios).
 *  - line: línea gruesa (muro).
 *  - group: grupo de líneas con forma propia (puerta, ventana, escalera...).
 *  - circle: círculo (pilar).
 *  - svg: path SVG con escalamiento proporcional (objetos, equipamiento).
 *  - annotation-label / annotation-comment: rectángculo con texto (anotaciones).
 *
 * El editor llama a createEntity() sin saber qué tipo de objeto recibe. Solo
 * sabe que cumple el contrato de EntityMetadata. Agregar un renderer nuevo =
 * agregar un case aquí + una definición en catalog.json. El editor no se toca.
 */

import * as fabric from "fabric";
import catalogData from "./catalog.json";
import type {
  Catalog,
  EntityDefinition,
  EntityMetadata,
  EntityRenderer,
} from "./entity-types";

/** Catálogo cargado desde JSON (tipado en runtime). */
const catalog = catalogData as Catalog;

/** Mapa rápido de definición por id. */
const ENTITY_BY_ID: Record<string, EntityDefinition> = Object.fromEntries(
  catalog.entities.map((e) => [e.id, e])
);

/** Devuelve todas las entidades del catálogo. */
export function getAllEntities(): EntityDefinition[] {
  return catalog.entities;
}

/** Devuelve entidades filtradas por categoría. */
export function getEntitiesByCategory(category: string): EntityDefinition[] {
  return catalog.entities.filter((e) => e.category === category);
}

/** Devuelve la definición de una entidad por id, o null si no existe. */
export function getEntityDefinition(id: string): EntityDefinition | null {
  return ENTITY_BY_ID[id] ?? null;
}

/** Busca entidades por texto (para el buscador de la biblioteca). */
export function searchEntities(query: string): EntityDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.entities.filter((e) => e.label.toLowerCase().includes(q));
}

/** Configuración común de controles para todos los objetos. */
function applyCommonControls(obj: fabric.Object, def: EntityDefinition, meta: EntityMetadata) {
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
  // Adjuntar metadata al objeto para serialización y exportación.
  (obj as fabric.Object & { entityMeta?: EntityMetadata }).entityMeta = meta;
}

/** Crea un bloque de espacio (rectángculo con nombre dentro). */
function createBlock(def: EntityDefinition, x: number, y: number, name: string): fabric.Group {
  const rect = new fabric.Rect({
    width: def.defaultWidth,
    height: def.defaultHeight,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    opacity: def.opacity,
    rx: 4,
    ry: 4,
  });

  const label = new fabric.Text(name, {
    fontSize: 14,
    fontFamily: "sans-serif",
    fill: "#1f2937",
    originX: "center",
    originY: "center",
    left: def.defaultWidth / 2,
    top: def.defaultHeight / 2,
    selectable: false,
    evented: false,
  });

  const group = new fabric.Group([rect, label], { left: x, top: y });
  return group;
}

/** Crea un muro (línea gruesa). */
function createWall(def: EntityDefinition, x: number, y: number): fabric.Line {
  return new fabric.Line([x, y, x + def.defaultWidth, y], {
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    strokeLineCap: "round",
  });
}

/** Crea una puerta (hoja + arco de apertura). */
function createDoor(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const frame = new fabric.Line([0, h / 2, w, h / 2], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const leaf = new fabric.Line([0, h / 2, 0, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const arc = new fabric.Path(`M 0 0 Q ${w / 2} 0 ${w} ${h / 2}`, {
    stroke: def.stroke, strokeWidth: 1.5, fill: "transparent", strokeDashArray: [4, 3],
  });
  return new fabric.Group([frame, leaf, arc], { left: x, top: y });
}

/** Crea una ventana (dos líneas paralelas + línea central punteada). */
function createWindow(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const top = new fabric.Line([0, 0, w, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const bottom = new fabric.Line([0, h, w, h], { stroke: def.stroke, strokeWidth: def.strokeWidth });
  const center = new fabric.Line([0, h / 2, w, h / 2], { stroke: def.stroke, strokeWidth: 1.5, strokeDashArray: [3, 3] });
  return new fabric.Group([top, bottom, center], { left: x, top: y });
}

/** Crea una escalera (líneas paralelas = peldaños). */
function createStairs(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const steps = 6;
  const objects: fabric.Object[] = [
    new fabric.Line([0, 0, w, 0], { stroke: def.stroke, strokeWidth: def.strokeWidth }),
    new fabric.Line([0, h, w, h], { stroke: def.stroke, strokeWidth: def.strokeWidth }),
  ];
  for (let i = 1; i < steps; i++) {
    objects.push(new fabric.Line([0, (h / steps) * i, w, (h / steps) * i], { stroke: def.stroke, strokeWidth: 1.5 }));
  }
  return new fabric.Group(objects, { left: x, top: y });
}

/** Crea un portón (frame + líneas verticales = hojas). */
function createGate(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const slats = 5;
  const objects: fabric.Object[] = [
    new fabric.Rect({ width: w, height: h, fill: "transparent", stroke: def.stroke, strokeWidth: def.strokeWidth }),
  ];
  for (let i = 1; i < slats; i++) {
    objects.push(new fabric.Line([(w / slats) * i, 0, (w / slats) * i, h], { stroke: def.stroke, strokeWidth: 1.5 }));
  }
  return new fabric.Group(objects, { left: x, top: y });
}

/** Crea una reja (grid 2x2). */
function createReja(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const objects: fabric.Object[] = [
    new fabric.Rect({ width: w, height: h, fill: "transparent", stroke: def.stroke, strokeWidth: def.strokeWidth }),
    new fabric.Line([w / 2, 0, w / 2, h], { stroke: def.stroke, strokeWidth: 1.5 }),
    new fabric.Line([0, h / 2, w, h / 2], { stroke: def.stroke, strokeWidth: 1.5 }),
  ];
  return new fabric.Group(objects, { left: x, top: y });
}

/** Crea un ascensor (cuadrado con flecha bidireccional). */
function createElevator(def: EntityDefinition, x: number, y: number): fabric.Group {
  const w = def.defaultWidth;
  const h = def.defaultHeight;
  const frame = new fabric.Rect({ width: w, height: h, fill: "transparent", stroke: def.stroke, strokeWidth: def.strokeWidth });
  const arrow = new fabric.Path(`M ${w / 2} 10 L ${w / 2} ${h - 10} M ${w / 2 - 8} 18 L ${w / 2} 10 L ${w / 2 + 8} 18 M ${w / 2 - 8} ${h - 18} L ${w / 2} ${h - 10} L ${w / 2 + 8} ${h - 18}`, {
    stroke: def.stroke, strokeWidth: 2, fill: "transparent",
  });
  return new fabric.Group([frame, arrow], { left: x, top: y });
}

/** Crea un objeto SVG (path con escalamiento proporcional). */
function createSvgObject(def: EntityDefinition, x: number, y: number): fabric.Path {
  return new fabric.Path(def.svgPath || "", {
    left: x,
    top: y,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    opacity: def.opacity,
  });
}

/** Crea un círculo (pilar). */
function createCircle(def: EntityDefinition, x: number, y: number): fabric.Circle {
  const radius = Math.min(def.defaultWidth, def.defaultHeight) / 2;
  return new fabric.Circle({
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
}

/** Crea una etiqueta (rectángulo con texto, fondo y borde). */
function createAnnotationLabel(def: EntityDefinition, x: number, y: number, text: string): fabric.Group {
  const textObj = new fabric.Text(text, {
    fontSize: 13,
    fontFamily: "sans-serif",
    fill: "#1f2937",
    originX: "center",
    originY: "center",
    left: def.defaultWidth / 2,
    top: def.defaultHeight / 2,
    selectable: false,
    evented: false,
  });
  const rect = new fabric.Rect({
    width: def.defaultWidth,
    height: def.defaultHeight,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    rx: 6,
    ry: 6,
  });
  return new fabric.Group([rect, textObj], { left: x, top: y });
}

/** Crea un comentario (rectángulo con marca visual distinta a la etiqueta). */
function createAnnotationComment(def: EntityDefinition, x: number, y: number, text: string): fabric.Group {
  const textObj = new fabric.Textbox(text, {
    fontSize: 12,
    fontFamily: "sans-serif",
    fill: "#1f2937",
    width: def.defaultWidth - 16,
    left: 8,
    top: 8,
    selectable: false,
    evented: false,
  });
  const rect = new fabric.Rect({
    width: def.defaultWidth,
    height: def.defaultHeight,
    fill: def.fill,
    stroke: def.stroke,
    strokeWidth: def.strokeWidth,
    rx: 4,
    ry: 4,
  });
  // Marca visual: barra izquierda más gruesa para distinguir del label.
  const marker = new fabric.Rect({
    width: 4,
    height: def.defaultHeight,
    fill: def.stroke,
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
  });
  return new fabric.Group([rect, marker, textObj], { left: x, top: y });
}

/** Despacha al renderer correcto según la definición del catálogo. */
function renderByType(
  renderer: EntityRenderer,
  def: EntityDefinition,
  x: number,
  y: number,
  name: string
): fabric.Object {
  switch (renderer) {
    case "block":
      return createBlock(def, x, y, name);
    case "line":
      return createWall(def, x, y);
    case "circle":
      return createCircle(def, x, y);
    case "svg":
      return createSvgObject(def, x, y);
    case "annotation-label":
      return createAnnotationLabel(def, x, y, name);
    case "annotation-comment":
      return createAnnotationComment(def, x, y, name);
    case "group":
      // Despachar grupos específicos de estructura por id.
      switch (def.id) {
        case "puerta": return createDoor(def, x, y);
        case "ventana": return createWindow(def, x, y);
        case "escalera": return createStairs(def, x, y);
        case "porton": return createGate(def, x, y);
        case "reja": return createReja(def, x, y);
        case "ascensor": return createElevator(def, x, y);
        default: return createDoor(def, x, y); // fallback razonable
      }
    default:
      return createBlock(def, x, y, name);
  }
}

/**
 * Instancia una entidad del catálogo en el lienzo.
 *
 * @param entityId ID de la definición en catalog.json.
 * @param x Coordenada X (esquina superior izquierda).
 * @param y Coordenada Y (esquina superior izquierda).
 * @param name Nombre visible (asignado por numeración automática o editado).
 * @returns Objeto Fabric con entityMeta adjunta, o null si el id no existe.
 */
export function createEntity(
  entityId: string,
  x: number,
  y: number,
  name: string
): fabric.Object | null {
  const def = getEntityDefinition(entityId);
  if (!def) return null;

  const meta: EntityMetadata = {
    catalogId: def.id,
    category: def.category,
    name,
    defaultLabel: def.defaultLabel,
    renderer: def.renderer,
    scaleMode: def.scaleMode,
    texture: def.texture,
    properties: {},
    annotationColor: def.category === "annotations" ? "yellow" : undefined,
  };

  const obj = renderByType(def.renderer, def, x, y, name);
  applyCommonControls(obj, def, meta);

  // Para objetos con escalamiento proporcional, bloquear el ratio.
  if (def.scaleMode === "proportional") {
    obj.set({ lockUniScaling: true });
  }

  return obj;
}

/** Recupera la metadata de entidad desde un objeto Fabric. */
export function getEntityMeta(obj: fabric.Object): EntityMetadata | null {
  const meta = (obj as fabric.Object & { entityMeta?: EntityMetadata }).entityMeta;
  return meta ?? null;
}

/** Actualiza la metadata de un objeto Fabric. */
export function setEntityMeta(obj: fabric.Object, meta: Partial<EntityMetadata>) {
  const current = getEntityMeta(obj);
  if (!current) return;
  const updated = { ...current, ...meta };
  (obj as fabric.Object & { entityMeta?: EntityMetadata }).entityMeta = updated;
}
