import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// ──────────────────────────────────────────────────────────────
// docxtemplater utilities (server-only — no importar desde cliente)
// ──────────────────────────────────────────────────────────────

/**
 * Extrae todos los placeholders de un .docx sin renderizar.
 *
 * Soporta DOS formatos de delimitadores:
 *  - <placeholder>   (angle brackets — delimiters nativos de docxtemplater)
 *  - [PLACEHOLDER]   (corchetes cuadrados — formato común en plantillas chilenas)
 *
 * Para [PLACEHOLDER] solo se detectan nombres en MAYÚSCULAS con _ (ej: NUM_LIQ)
 * para evitar falsos positivos con texto normal entre corchetes.
 */
export function extractPlaceholdersFromDocx(buffer: Uint8Array | ArrayBuffer): string[] {
  const content = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const zip = new PizZip(content);

  // 1. Intentar con docxtemplater getTags() para <placeholder>
  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "<", end: ">" },
    });
    // @ts-expect-error: getTags existe en runtime pero no en todas las defs de tipos
    const tags = doc.getTags?.();
    if (tags && typeof tags === "object") {
      const angleTags = collectTagKeys(tags);
      // 2. También extraer [PLACEHOLDER] del XML
      const squareTags = extractSquarePlaceholdersFromXml(content);
      return [...new Set([...angleTags, ...squareTags])];
    }
  } catch {
    // fallback abajo
  }

  // Fallback: extraer ambos formatos directamente del XML
  const angleTags = extractPlaceholdersFromXml(content);
  const squareTags = extractSquarePlaceholdersFromXml(content);
  return [...new Set([...angleTags, ...squareTags])];
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
      // Filtrar tags XML comunes del docx (w:t, w:p, w:r, etc.)
      if (/^(w:|xml:|r:|\/)/.test(tag)) continue;
      if (tag.includes(" ") || tag.includes("=")) continue; // tags XML con atributos
      placeholders.add(tag);
    }
  }
  return [...placeholders];
}

/**
 * Extrae [PLACEHOLDER] del XML del docx.
 * Solo detecta nombres en MAYÚSCULAS con _ y números (ej: NUM_LIQ, FEC_SINIESTRO_2)
 * para evitar falsos positivos con texto normal entre corchetes.
 */
function extractSquarePlaceholdersFromXml(content: Uint8Array): string[] {
  const zip = new PizZip(content);
  const placeholders = new Set<string>();
  const filesToScan = [
    "word/document.xml",
    ...Object.keys(zip.files).filter((f) => f.match(/^word\/(header|footer)\d*\.xml$/)),
  ];
  // [PLACEHOLDER] donde PLACEHOLDER es solo MAYÚSCULAS, números y _
  const regex = /\[([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*)\]/g;
  for (const filePath of filesToScan) {
    const file = zip.files[filePath];
    if (!file) continue;
    const xml = file.asText();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      placeholders.add(match[1].trim());
    }
  }
  return [...placeholders];
}

/**
 * Renderiza un .docx reemplazando los placeholders con los datos proporcionados.
 * Devuelve el buffer del .docx generado.
 *
 * Soporta placeholders en formato <placeholder> y [PLACEHOLDER].
 * Los [PLACEHOLDER] se convierten a <placeholder> (minúsculas) antes de renderizar.
 * También elimina los Content Controls (SDT) de Word conservando su contenido,
 * para que docxtemplater pueda acceder a los placeholders dentro de ellos.
 */
export function renderDocx(
  buffer: Uint8Array | ArrayBuffer,
  data: Record<string, unknown>
): Uint8Array {
  let content = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Pre-procesar: eliminar SDTs, convertir [PLACEHOLDER] → <placeholder>
  content = preprocessDocxForRender(content, data);

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

/**
 * Pre-procesa el .docx antes de renderizar:
 * 1. Elimina los Content Controls (SDT) de Word conservando su contenido
 *    (para que docxtemplater pueda acceder a los placeholders dentro de ellos)
 * 2. Convierte [PLACEHOLDER] → &lt;placeholder&gt; (entidades XML escapadas)
 *    para TODOS los placeholders detectados, no solo los mapeados.
 *    Los que no estén en `data` se agregan con valor "" para que
 *    docxtemplater los reemplace con string vacío (nullGetter) en vez
 *    de dejarlos literalmente como [PLACEHOLDER] en el documento final.
 */
function preprocessDocxForRender(
  content: Uint8Array,
  data: Record<string, unknown>
): Uint8Array {
  const zip = new PizZip(content);

  // Mapa case-insensitive: UPPER_KEY → canonicalKey (ej: LIQUIDATION_NUMBER → liquidation_number)
  const dataKeysLower = new Map<string, string>();
  for (const k of Object.keys(data)) {
    dataKeysLower.set(k.toUpperCase(), k);
  }

  const filesToPatch = [
    "word/document.xml",
    ...Object.keys(zip.files).filter((f) => f.match(/^word\/(header|footer)\d*\.xml$/)),
  ];

  // Set de placeholders (en UPPER) que aparecen en el .docx pero NO están en data.
  // Los agregaremos a data con "" para que docxtemplater los reemplace con vacío.
  const unresolvedPlaceholders = new Set<string>();

  let modified = false;
  for (const filePath of filesToPatch) {
    const file = zip.files[filePath];
    if (!file) continue;
    let xml = file.asText();

    // 1. Eliminar SDTs (Content Controls) conservando el contenido
    xml = unwrapSdts(xml);

    // 2. Convertir [PLACEHOLDER] → &lt;key&gt; (entidades XML escapadas)
    //    - Si PLACEHOLDER (UPPER) corresponde a una key de data → usa la key canónica
    //    - Si no corresponde a ninguna key de data → usa el nombre tal cual (UPPER)
    //      y lo agrega a data con "" para que quede vacío en el render.
    xml = xml.replace(
      /\[([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*)\]/g,
      (full, key: string) => {
        const canonical = dataKeysLower.get(key);
        if (canonical) {
          return `&lt;${canonical}&gt;`;
        }
        // No está en data → agregar con "" y usar el key tal cual
        unresolvedPlaceholders.add(key);
        return `&lt;${key}&gt;`;
      }
    );

    zip.file(filePath, xml);
    modified = true;
  }

  // 3. Agregar placeholders no resueltos a data con "" para que docxtemplater
  //    los reemplace con string vacío (gracias a nullGetter) en vez de dejarlos
  //    literalmente como [PLACEHOLDER] en el documento final.
  for (const key of unresolvedPlaceholders) {
    if (!(key in data)) {
      data[key] = "";
    }
  }

  if (!modified) return content;
  return zip.generate({ type: "uint8array", compression: "DEFLATE" }) as unknown as Uint8Array;
}

/**
 * Elimina los Content Controls (SDT) de Word del XML, conservando
 * el contenido de <w:sdtContent>.
 *
 * Un SDT tiene la estructura:
 *   <w:sdt>
 *     <w:sdtPr>...propiedades...</w:sdtPr>
 *     <w:sdtContent>...contenido a conservar...</w:sdtContent>
 *   </w:sdt>
 *
 * Después del unwrap queda solo el contenido del sdtContent.
 * Maneja SDTs anidados repitiendo hasta que no queden más.
 */
function unwrapSdts(xml: string): string {
  let prev: string;
  do {
    prev = xml;
    xml = xml.replace(
      /<w:sdt>([\s\S]*?)<\/w:sdt>/g,
      (full, inner: string) => {
        const contentMatch = inner.match(/<w:sdtContent>([\s\S]*?)<\/w:sdtContent>/);
        return contentMatch ? contentMatch[1] : "";
      }
    );
  } while (xml !== prev);
  return xml;
}
