// ──────────────────────────────────────────────────────────────
// Renderizado de plantillas de e-mail
// Soporta placeholders en formato <placeholder>, [PLACEHOLDER] y {{placeholder}}
// Soporta body_format: 'plain' (texto plano) o 'html' (rico con logos, imágenes, estilos)
//
// En HTML, los placeholders se reemplazan escapando el valor para evitar
// inyección HTML. Las URLs y emails se mantienen sin escapar cuando se
// usan en atributos href/src (el caller debe marcarlos como seguros).
// ──────────────────────────────────────────────────────────────

const PLACEHOLDER_REGEX = /(?:<([a-zA-Z0-9_.]+)>|\[([A-Z][A-Z0-9_.]*)\]|\{\{([a-zA-Z0-9_.]+)\}\}|&lt;([a-zA-Z0-9_.]+)&gt;)/g;

/**
 * Conjunto de nombres de tags HTML que NO deben tratarse como placeholders.
 * El regex de placeholders usa el formato `<name>` que colisiona con tags HTML
 * sin atributos (ej: `<p>`, `<strong>`, `<br>`). Sin este filtro, el render
 * borraría todos los tags HTML sin atributos del cuerpo del correo.
 */
const HTML_TAGS = new Set([
  // Block
  "p", "div", "section", "article", "header", "footer", "main", "aside", "nav",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "hr", "address", "figure", "figcaption",
  // List
  "ul", "ol", "li", "dl", "dt", "dd",
  // Table
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  // Inline
  "span", "a", "strong", "b", "em", "i", "u", "s", "strike", "del", "ins",
  "sub", "sup", "small", "big", "mark", "code", "kbd", "samp", "var",
  "q", "cite", "abbr", "time", "data", "wbr", "br",
  // Media
  "img", "picture", "source", "video", "audio", "iframe", "embed", "object",
  // Form (raro en emails pero por seguridad)
  "form", "input", "button", "label", "select", "option", "textarea",
  // Otros
  "details", "summary", "dialog", "template", "slot",
]);

export type EmailBodyFormat = "plain" | "html";

export interface EmailTemplateData {
  subject: string;
  body: string;
  body_format: EmailBodyFormat;
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
  // Reset regex (es global y con estado)
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const key = match[1] || match[2] || match[3] || match[4];
    // Saltar tags HTML (ej: <p>, <strong>, <br>) — no son placeholders
    if (key && !HTML_TAGS.has(key.toLowerCase())) found.add(key);
  }
  return [...found];
}

/**
 * Elimina etiquetas HTML, devolviendo texto plano.
 * Usado para el subject de e-mail, que no admite HTML según RFC 2822.
 */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/**
 * Escapa caracteres HTML para evitar inyección al insertar valores
 * en una plantilla HTML.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convierte saltos de línea de texto plano a <br> para HTML.
 */
function plainToHtmlLineBreaks(value: string): string {
  return value.replace(/\r?\n/g, "<br>");
}

/**
 * Renderiza subject y body reemplazando placeholders por valores reales.
 * Los placeholders se resuelven case-insensitive contra `data`.
 * Si no hay valor, se reemplaza por string vacío.
 *
 * En modo HTML, los valores se escapan para evitar inyección.
 * En modo plain, los valores se insertan tal cual.
 */
export function renderEmailTemplate(
  template: {
    subject: string;
    body: string;
    body_format?: EmailBodyFormat;
    placeholder_mapping?: Record<string, string>;
  },
  data: Record<string, unknown>
): { subject: string; body: string; body_format: EmailBodyFormat } {
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[\[\]<>{}]/g, "").trim();

  const dataMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(data)) {
    dataMap.set(normalizeKey(k), v);
  }

  const mapping = template.placeholder_mapping || {};
  const format: EmailBodyFormat = template.body_format ?? "plain";

  const resolveValue = (key: string): string => {
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
  };

  const replaceIn = (text: string, escape: boolean): string => {
    return text.replace(PLACEHOLDER_REGEX, (full: string, angle: string, square: string, curly: string, escaped: string) => {
      const key = angle || square || curly || escaped;
      // Saltar tags HTML (ej: <p>, <strong>, <br>) — devolverlos sin modificar
      if (key && HTML_TAGS.has(key.toLowerCase())) return full;
      const raw = resolveValue(key);
      if (raw === "") return "";
      // Caso especial: <company_logo> en HTML → renderizar como <img>
      // El usuario inserta el placeholder en el cuerpo y al renderizar
      // se reemplaza por la etiqueta <img> con la URL del logo de la empresa.
      if (escape && /^company_logo$/i.test(key) && /^https?:\/\//i.test(raw)) {
        return `<img src="${escapeHtml(raw)}" alt="Logo" style="max-height:80px;max-width:220px;display:block;" />`;
      }
      if (escape) {
        // En HTML, escapar valor y convertir saltos de línea a <br>
        return plainToHtmlLineBreaks(escapeHtml(raw));
      }
      return raw;
    });
  };

  // El asunto de un e-mail no admite HTML según los RFCs de correo.
  // Reemplazamos placeholders y luego removemos cualquier tag HTML residual
  // para que el cliente de correo reciba texto plano y no muestre tags crudos.
  const subject = stripHtml(replaceIn(template.subject, true));
  const body = format === "html" ? replaceIn(template.body, true) : replaceIn(template.body, false);

  return { subject, body, body_format: format };
}

/**
 * Detecta placeholders en subject + body y retorna array único.
 */
export function detectEmailTemplatePlaceholders(template: { subject: string; body: string }): string[] {
  const fromSubject = extractPlaceholders(template.subject);
  const fromBody = extractPlaceholders(template.body);
  return [...new Set([...fromSubject, ...fromBody])];
}

/**
 * Envuelve un body HTML con la estructura de email premium: doctype, html, head,
 * body con estilos cuidados (tipografía, sombras suaves, espaciado, footer).
 * Si el body ya tiene <html>, se devuelve tal cual.
 *
 * El logo y los datos de la empresa van dentro del body como placeholders
 * (<company_logo>, <company_address>, etc.) que ya fueron reemplazados
 * antes de llamar esta función.
 */
export { wrapHtmlEmail } from "@/lib/email-wrapper";
