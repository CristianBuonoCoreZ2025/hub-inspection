"use server";

// ──────────────────────────────────────────────────────────────
// Renderizado de plantillas de e-mail
// Soporta placeholders en formato <placeholder>, [PLACEHOLDER] y {{placeholder}}
// ──────────────────────────────────────────────────────────────

const PLACEHOLDER_REGEX = /(?:<([a-zA-Z0-9_.]+)>|\[([A-Z][A-Z0-9_.]*)\]|\{\{([a-zA-Z0-9_.]+)\}\})/g;

export interface EmailTemplateData {
  subject: string;
  body: string;
  detected_placeholders: string[];
  placeholder_mapping: Record<string, string>;
}

/**
 * Extrae todos los placeholders de un texto.
 * Devuelve un array sin duplicados, conservando el formato original.
 */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset regex
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const key = match[1] || match[2] || match[3];
    if (key) found.add(key);
  }
  return [...found];
}

/**
 * Renderiza subject y body reemplazando placeholders por valores reales.
 * Los placeholders se resuelven case-insensitive contra `data`.
 * Si no hay valor, se reemplaza por string vacío.
 */
export function renderEmailTemplate(
  template: { subject: string; body: string; placeholder_mapping?: Record<string, string> },
  data: Record<string, unknown>
): { subject: string; body: string } {
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[\[\]<>{}]/g, "").trim();

  const dataMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(data)) {
    dataMap.set(normalizeKey(k), v);
  }

  const mapping = template.placeholder_mapping || {};

  const replaceIn = (text: string): string => {
    return text.replace(PLACEHOLDER_REGEX, (full, angle, square, curly) => {
      const key = angle || square || curly;
      const normalized = normalizeKey(key);
      // 1. Aplicar mapeo explícito si existe
      const mapped = mapping[key] || mapping[normalized];
      if (mapped) {
        const mappedNormalized = normalizeKey(mapped);
        const val = dataMap.get(mappedNormalized);
        if (val === undefined || val === null) return "";
        return String(val);
      }
      // 2. Buscar directamente en data
      const val = dataMap.get(normalized);
      if (val === undefined || val === null) return "";
      return String(val);
    });
  };

  return {
    subject: replaceIn(template.subject),
    body: replaceIn(template.body),
  };
}

/**
 * Detecta placeholders en subject + body y retorna array único.
 */
export function detectEmailTemplatePlaceholders(template: { subject: string; body: string }): string[] {
  const fromSubject = extractPlaceholders(template.subject);
  const fromBody = extractPlaceholders(template.body);
  return [...new Set([...fromSubject, ...fromBody])];
}
