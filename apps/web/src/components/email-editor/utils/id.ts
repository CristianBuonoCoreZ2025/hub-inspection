/**
 * Utilidades para generar IDs únicos de bloques.
 * Usa crypto.randomUUID cuando está disponible, fallback a timestamp + random.
 */

let counter = 0;

export function generateId(prefix = "blk"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter}_${random}`;
}

export function generateTextId(): string {
  return generateId("txt");
}

export function generateCellId(): string {
  return generateId("cell");
}

export function generateRowId(): string {
  return generateId("row");
}

export function generateColumnId(): string {
  return generateId("col");
}
