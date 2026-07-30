/**
 * Catálogo de bloques predefinidos del editor de croquis.
 *
 * Cada bloque se instancia como objeto Fabric al soltarlo en el canvas.
 * Los colores usan variables del tema (CSS vars) donde sea posible, pero los
 * objetos Fabric requieren valores concretos en runtime, por eso se definen
 * hex aquí. El fondo del canvas y la UI sí heredan el tema del consumidor.
 */

import type { BlockDefinition, BlockId } from "./sketch-types";

/**
 * Paleta de habitaciones. Tonos suaves para no competir con el trazado.
 * El inspector puede cambiar el color después de soltar el bloque.
 */
export const ROOM_BLOCKS: BlockDefinition[] = [
  {
    id: "living",
    label: "Living",
    fabricType: "rect",
    defaultWidth: 180,
    defaultHeight: 140,
    fill: "#dbeafe",
    stroke: "#3b82f6",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "comedor",
    label: "Comedor",
    fabricType: "rect",
    defaultWidth: 160,
    defaultHeight: 120,
    fill: "#fef3c7",
    stroke: "#f59e0b",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "bano",
    label: "Baño",
    fabricType: "rect",
    defaultWidth: 100,
    defaultHeight: 100,
    fill: "#cffafe",
    stroke: "#06b6d4",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "cocina",
    label: "Cocina",
    fabricType: "rect",
    defaultWidth: 140,
    defaultHeight: 110,
    fill: "#fce7f3",
    stroke: "#ec4899",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "dormitorio",
    label: "Dormitorio",
    fabricType: "rect",
    defaultWidth: 170,
    defaultHeight: 150,
    fill: "#ede9fe",
    stroke: "#8b5cf6",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "garage",
    label: "Garage",
    fabricType: "rect",
    defaultWidth: 200,
    defaultHeight: 160,
    fill: "#f1f5f9",
    stroke: "#64748b",
    strokeWidth: 2,
    opacity: 0.85,
  },
  {
    id: "oficina",
    label: "Oficina",
    fabricType: "rect",
    defaultWidth: 130,
    defaultHeight: 110,
    fill: "#dcfce7",
    stroke: "#22c55e",
    strokeWidth: 2,
    opacity: 0.85,
  },
];

/**
 * Elementos estructurales. Los muros son líneas gruesas; puertas, ventanas y
 * escaleras se modelan como grupos de líneas para mayor legibilidad.
 */
export const STRUCTURE_BLOCKS: BlockDefinition[] = [
  {
    id: "muro",
    label: "Muro",
    fabricType: "line",
    defaultWidth: 200,
    defaultHeight: 0,
    fill: "transparent",
    stroke: "#1f2937",
    strokeWidth: 8,
    opacity: 1,
  },
  {
    id: "puerta",
    label: "Puerta",
    fabricType: "group",
    defaultWidth: 80,
    defaultHeight: 40,
    fill: "transparent",
    stroke: "#92400e",
    strokeWidth: 3,
    opacity: 1,
  },
  {
    id: "ventana",
    label: "Ventana",
    fabricType: "group",
    defaultWidth: 120,
    defaultHeight: 24,
    fill: "transparent",
    stroke: "#0ea5e9",
    strokeWidth: 3,
    opacity: 1,
  },
  {
    id: "escalera",
    label: "Escalera",
    fabricType: "group",
    defaultWidth: 80,
    defaultHeight: 120,
    fill: "transparent",
    stroke: "#475569",
    strokeWidth: 2,
    opacity: 1,
  },
];

/** Catálogo completo ordenado: primero habitaciones, luego estructuras. */
export const ALL_BLOCKS: BlockDefinition[] = [...ROOM_BLOCKS, ...STRUCTURE_BLOCKS];

/** Lookup rápido por id. */
export const BLOCK_BY_ID: Record<BlockId, BlockDefinition> = ALL_BLOCKS.reduce(
  (acc, block) => {
    acc[block.id] = block;
    return acc;
  },
  {} as Record<BlockId, BlockDefinition>
);
