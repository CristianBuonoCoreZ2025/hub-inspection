/**
 * Catálogo de bloques predefinidos del editor de croquis.
 *
 * Cubre los escenarios de inspección de la plataforma:
 *  - Habitaciones (vivienda)
 *  - Oficina (escritorios, sillas, archivadores, sala de reunión, recepción)
 *  - Estacionamiento (vehículos, plazas, rampas, bicicletas)
 *  - Maquinaria (motores, tanques, paneles, equipos)
 *  - Negocio (mostradores, estanterías, cajas, exhibidores)
 *  - Exterior (árboles, jardín, veredas, portones)
 *  - Estructura (muros, puertas, ventanas, escaleras)
 *
 * Los colores usan hex concretos porque los objetos Fabric requieren valores
 * en runtime. El fondo del canvas y la UI sí heredan el tema del consumidor.
 */

import type { BlockDefinition } from "./sketch-types";

/** Habitaciones de vivienda. */
export const ROOM_BLOCKS: BlockDefinition[] = [
  { id: "living", label: "Living", category: "habitaciones", fabricType: "rect", defaultWidth: 180, defaultHeight: 140, fill: "#dbeafe", stroke: "#3b82f6", strokeWidth: 2, opacity: 0.85 },
  { id: "comedor", label: "Comedor", category: "habitaciones", fabricType: "rect", defaultWidth: 160, defaultHeight: 120, fill: "#fef3c7", stroke: "#f59e0b", strokeWidth: 2, opacity: 0.85 },
  { id: "bano", label: "Baño", category: "habitaciones", fabricType: "rect", defaultWidth: 100, defaultHeight: 100, fill: "#cffafe", stroke: "#06b6d4", strokeWidth: 2, opacity: 0.85 },
  { id: "cocina", label: "Cocina", category: "habitaciones", fabricType: "rect", defaultWidth: 140, defaultHeight: 110, fill: "#fce7f3", stroke: "#ec4899", strokeWidth: 2, opacity: 0.85 },
  { id: "dormitorio", label: "Dormitorio", category: "habitaciones", fabricType: "rect", defaultWidth: 170, defaultHeight: 150, fill: "#ede9fe", stroke: "#8b5cf6", strokeWidth: 2, opacity: 0.85 },
  { id: "garage", label: "Garage", category: "habitaciones", fabricType: "rect", defaultWidth: 200, defaultHeight: 160, fill: "#f1f5f9", stroke: "#64748b", strokeWidth: 2, opacity: 0.85 },
  { id: "oficina-room", label: "Oficina", category: "habitaciones", fabricType: "rect", defaultWidth: 160, defaultHeight: 130, fill: "#dcfce7", stroke: "#22c55e", strokeWidth: 2, opacity: 0.85 },
];

/** Mobiliario y zonas de oficina. */
export const OFFICE_BLOCKS: BlockDefinition[] = [
  { id: "escritorio", label: "Escritorio", category: "oficina", fabricType: "rect", defaultWidth: 120, defaultHeight: 60, fill: "#fef3c7", stroke: "#a16207", strokeWidth: 2, opacity: 0.9 },
  { id: "silla", label: "Silla", category: "oficina", fabricType: "rect", defaultWidth: 44, defaultHeight: 44, fill: "#e0e7ff", stroke: "#6366f1", strokeWidth: 2, opacity: 0.9 },
  { id: "archivador", label: "Archivador", category: "oficina", fabricType: "rect", defaultWidth: 50, defaultHeight: 80, fill: "#fee2e2", stroke: "#dc2626", strokeWidth: 2, opacity: 0.9 },
  { id: "reunion", label: "Sala Reunión", category: "oficina", fabricType: "rect", defaultWidth: 160, defaultHeight: 90, fill: "#dbeafe", stroke: "#2563eb", strokeWidth: 2, opacity: 0.85 },
  { id: "recepcion", label: "Recepción", category: "oficina", fabricType: "rect", defaultWidth: 140, defaultHeight: 50, fill: "#f5f5f4", stroke: "#78716c", strokeWidth: 2, opacity: 0.9 },
];

/** Elementos de estacionamiento. */
export const PARKING_BLOCKS: BlockDefinition[] = [
  { id: "vehiculo", label: "Vehículo", category: "estacionamiento", fabricType: "rect", defaultWidth: 90, defaultHeight: 50, fill: "#cbd5e1", stroke: "#475569", strokeWidth: 2, opacity: 0.85 },
  { id: "plaza", label: "Plaza", category: "estacionamiento", fabricType: "rect", defaultWidth: 100, defaultHeight: 55, fill: "transparent", stroke: "#16a34a", strokeWidth: 2, opacity: 1 },
  { id: "rampa", label: "Rampa", category: "estacionamiento", fabricType: "group", defaultWidth: 120, defaultHeight: 60, fill: "transparent", stroke: "#92400e", strokeWidth: 3, opacity: 1 },
  { id: "bicicleta", label: "Bicicleta", category: "estacionamiento", fabricType: "circle", defaultWidth: 50, defaultHeight: 50, fill: "#dcfce7", stroke: "#15803d", strokeWidth: 2, opacity: 0.9 },
];

/** Equipos de maquinaria industrial. */
export const MACHINERY_BLOCKS: BlockDefinition[] = [
  { id: "motor", label: "Motor", category: "maquinaria", fabricType: "circle", defaultWidth: 70, defaultHeight: 70, fill: "#fee2e2", stroke: "#b91c1c", strokeWidth: 2, opacity: 0.9 },
  { id: "tanque", label: "Tanque", category: "maquinaria", fabricType: "rect", defaultWidth: 80, defaultHeight: 100, fill: "#dbeafe", stroke: "#1d4ed8", strokeWidth: 2, opacity: 0.9 },
  { id: "panel", label: "Panel", category: "maquinaria", fabricType: "rect", defaultWidth: 120, defaultHeight: 40, fill: "#f1f5f9", stroke: "#0f172a", strokeWidth: 2, opacity: 0.9 },
  { id: "equipo", label: "Equipo", category: "maquinaria", fabricType: "rect", defaultWidth: 90, defaultHeight: 70, fill: "#fef3c7", stroke: "#a16207", strokeWidth: 2, opacity: 0.9 },
];

/** Mobiliario de negocio / comercio. */
export const BUSINESS_BLOCKS: BlockDefinition[] = [
  { id: "mostrador", label: "Mostrador", category: "negocio", fabricType: "rect", defaultWidth: 160, defaultHeight: 50, fill: "#f5f5f4", stroke: "#57534e", strokeWidth: 2, opacity: 0.9 },
  { id: "estanteria", label: "Estantería", category: "negocio", fabricType: "rect", defaultWidth: 140, defaultHeight: 40, fill: "#fef3c7", stroke: "#a16207", strokeWidth: 2, opacity: 0.9 },
  { id: "caja", label: "Caja", category: "negocio", fabricType: "rect", defaultWidth: 70, defaultHeight: 50, fill: "#dcfce7", stroke: "#15803d", strokeWidth: 2, opacity: 0.9 },
  { id: "exhibidor", label: "Exhibidor", category: "negocio", fabricType: "circle", defaultWidth: 80, defaultHeight: 80, fill: "#fce7f3", stroke: "#be185d", strokeWidth: 2, opacity: 0.9 },
];

/** Elementos de exterior / áreas comunes. */
export const OUTDOOR_BLOCKS: BlockDefinition[] = [
  { id: "arbol", label: "Árbol", category: "exterior", fabricType: "circle", defaultWidth: 60, defaultHeight: 60, fill: "#dcfce7", stroke: "#15803d", strokeWidth: 2, opacity: 0.9 },
  { id: "jardin", label: "Jardín", category: "exterior", fabricType: "rect", defaultWidth: 140, defaultHeight: 100, fill: "#dcfce7", stroke: "#16a34a", strokeWidth: 2, opacity: 0.6 },
  { id: "vereda", label: "Vereda", category: "exterior", fabricType: "rect", defaultWidth: 200, defaultHeight: 40, fill: "#e7e5e4", stroke: "#78716c", strokeWidth: 2, opacity: 0.8 },
  { id: "porton", label: "Portón", category: "exterior", fabricType: "group", defaultWidth: 120, defaultHeight: 60, fill: "transparent", stroke: "#475569", strokeWidth: 3, opacity: 1 },
];

/** Elementos estructurales: muros, puertas, ventanas, escaleras. */
export const STRUCTURE_BLOCKS: BlockDefinition[] = [
  { id: "muro", label: "Muro", category: "estructura", fabricType: "line", defaultWidth: 200, defaultHeight: 0, fill: "transparent", stroke: "#1f2937", strokeWidth: 8, opacity: 1 },
  { id: "puerta", label: "Puerta", category: "estructura", fabricType: "group", defaultWidth: 80, defaultHeight: 40, fill: "transparent", stroke: "#92400e", strokeWidth: 3, opacity: 1 },
  { id: "ventana", label: "Ventana", category: "estructura", fabricType: "group", defaultWidth: 120, defaultHeight: 24, fill: "transparent", stroke: "#0ea5e9", strokeWidth: 3, opacity: 1 },
  { id: "escalera", label: "Escalera", category: "estructura", fabricType: "group", defaultWidth: 80, defaultHeight: 120, fill: "transparent", stroke: "#475569", strokeWidth: 2, opacity: 1 },
];

/** Catálogo completo ordenado por categoría. */
export const ALL_BLOCKS: BlockDefinition[] = [
  ...ROOM_BLOCKS,
  ...OFFICE_BLOCKS,
  ...PARKING_BLOCKS,
  ...MACHINERY_BLOCKS,
  ...BUSINESS_BLOCKS,
  ...OUTDOOR_BLOCKS,
  ...STRUCTURE_BLOCKS,
];

/** Bloques agrupados por categoría (para la paleta). */
export const BLOCKS_BY_CATEGORY: Record<string, BlockDefinition[]> = {
  habitaciones: ROOM_BLOCKS,
  oficina: OFFICE_BLOCKS,
  estacionamiento: PARKING_BLOCKS,
  maquinaria: MACHINERY_BLOCKS,
  negocio: BUSINESS_BLOCKS,
  exterior: OUTDOOR_BLOCKS,
  estructura: STRUCTURE_BLOCKS,
};

/** Mapa rápido de bloque por id (para el factory). */
export const BLOCK_BY_ID: Record<string, BlockDefinition> = Object.fromEntries(
  ALL_BLOCKS.map((b) => [b.id, b])
);
