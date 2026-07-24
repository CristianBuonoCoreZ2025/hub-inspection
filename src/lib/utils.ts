import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LABEL_STOP_WORDS = new Set([
  "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde", "e",
  "el", "en", "entre", "hacia", "hasta", "la", "las", "los", "ni", "o",
  "para", "por", "que", "se", "sin", "sobre", "tras", "u", "un", "una",
  "unas", "unos", "y",
]);

/**
 * Capitalización inteligente para etiquetas/pantallas.
 * "Datos De La Póliza" → "Datos de la Póliza"
 * "Error En Creacion"  → "Error en Creacion"
 * Solo el primer carácter se fuerza; palabras comunes (preposiciones,
 * artículos, conjunciones) se mantienen en minúscula salvo si son la primera.
 */
export function toLabelCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      const normalized = word.toLowerCase();
      if (index > 0 && LABEL_STOP_WORDS.has(normalized)) {
        return normalized;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
