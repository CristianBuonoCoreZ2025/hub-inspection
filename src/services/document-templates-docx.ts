import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// ──────────────────────────────────────────────────────────────
// docxtemplater utilities (server-only — no importar desde cliente)
// ──────────────────────────────────────────────────────────────

/**
 * Extrae todos los placeholders <xxx> de un .docx sin renderizar.
 * Usa docxtemplater en modo "dry run" capturando los placeholders.
 */
export function extractPlaceholdersFromDocx(buffer: Uint8Array | ArrayBuffer): string[] {
  const content = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<", end: ">" },
  });

  // docxtemplater expone los placeholders detectados vía .getTags() (v3.69+)
  try {
    // @ts-expect-error: getTags existe en runtime pero no en todas las defs de tipos
    const tags = doc.getTags?.();
    if (tags && typeof tags === "object") {
      return collectTagKeys(tags);
    }
  } catch {
    // fallback abajo
  }

  // Fallback: extraer placeholders directamente del XML del docx
  return extractPlaceholdersFromXml(content);
}

/** Recorre el árbol de tags de docxtemplater y devuelve las claves hoja */
function collectTagKeys(tags: unknown, prefix = ""): string[] {
  const keys: string[] = [];
  if (!tags || typeof tags !== "object") return keys;
  for (const [k, v] of Object.entries(tags as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectTagKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Fallback: extrae <placeholders> directamente del XML del docx */
function extractPlaceholdersFromXml(content: Uint8Array): string[] {
  const zip = new PizZip(content);
  const placeholders = new Set<string>();
  // Escanear document.xml + headers + footers
  const filesToScan = [
    "word/document.xml",
    ...Object.keys(zip.files).filter((f) => f.match(/^word\/(header|footer)\d*\.xml$/)),
  ];
  const regex = /<([^<>]+)>/g;
  for (const filePath of filesToScan) {
    const file = zip.files[filePath];
    if (!file) continue;
    const xml = file.asText();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      const tag = match[1].trim();
      // Filtrar delimitadores de loops/condicionales de docxtemplater
      if (tag.startsWith("#") || tag.startsWith("/") || tag.startsWith("^")) continue;
      if (tag.startsWith("<") || tag.endsWith(">")) continue;
      placeholders.add(tag);
    }
  }
  return [...placeholders];
}

/**
 * Renderiza un .docx reemplazando los placeholders con los datos proporcionados.
 * Devuelve el buffer del .docx generado.
 */
export function renderDocx(
  buffer: Uint8Array | ArrayBuffer,
  data: Record<string, unknown>
): Uint8Array {
  const content = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<", end: ">" },
    nullGetter: () => "",
  });
  doc.render(data);
  const out = doc.getZip().generate({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return out as unknown as Uint8Array;
}
