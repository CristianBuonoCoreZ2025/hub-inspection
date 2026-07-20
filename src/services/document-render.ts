import { renderDocx, extractPlaceholdersFromDocx } from "./document-templates-docx";
import type { DocumentFileType } from "./claim-action-documents";

// ──────────────────────────────────────────────────────────────
// Servicio unificado de renderizado de documentos de ofimática
// Soporta: .docx (docxtemplater), .xlsx (xlsx-template), .pptx (node-pptx-templater)
// ──────────────────────────────────────────────────────────────

/**
 * Renderiza un documento de ofimática reemplazando placeholders con datos.
 * Dispatcher según el tipo de archivo.
 */
export async function renderDocument(
  buffer: Uint8Array | ArrayBuffer,
  data: Record<string, unknown>,
  fileType: DocumentFileType
): Promise<Uint8Array> {
  switch (fileType) {
    case "docx":
      return renderDocx(buffer, data);
    case "xlsx":
      return renderXlsx(buffer, data);
    case "pptx":
      return renderPptx(buffer, data);
    case "pdf":
      throw new Error("No se puede renderizar un PDF — los PDFs se generan por conversión, no por templating");
  }
}

/**
 * Extrae los placeholders de un documento.
 * Dispatcher según el tipo de archivo.
 */
export async function extractPlaceholders(
  buffer: Uint8Array | ArrayBuffer,
  fileType: DocumentFileType
): Promise<string[]> {
  switch (fileType) {
    case "docx":
      return extractPlaceholdersFromDocx(buffer);
    case "xlsx":
      return extractPlaceholdersFromXlsx(buffer);
    case "pptx":
      return extractPlaceholdersFromPptx(buffer);
    case "pdf":
      return []; // los PDFs no tienen placeholders
  }
}

// ──────────────────────────────────────────────────────────────
// Excel (.xlsx) — xlsx-template
// ──────────────────────────────────────────────────────────────

async function renderXlsx(buffer: Uint8Array | ArrayBuffer, data: Record<string, unknown>): Promise<Uint8Array> {
  const XlsxTemplate = (await import("xlsx-template")).default;
  const buf = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(buffer);
  const template = new XlsxTemplate(buf) as any;

  // xlsx-template usa ${name} como delimitador por defecto
  // substitute(sheetNameOrIndex, data) — aplicar a todas las hojas
  // La instancia tiene template.workbook.Sheets o similar
  try {
    const sheets = template.workbook?.Sheets || template.sheets || [];
    for (const sheet of sheets) {
      const sheetId = sheet?.id ?? sheet?.name ?? sheet;
      try {
        template.substitute(sheetId, data);
      } catch {
        // hoja sin placeholders
      }
    }
  } catch {
    // fallback: substituteAll si existe
    if (typeof template.substituteAll === "function") {
      template.substituteAll(data);
    }
  }

  const result = template.generate();
  return new Uint8Array(result);
}

async function extractPlaceholdersFromXlsx(buffer: Uint8Array | ArrayBuffer): Promise<string[]> {
  try {
    const XlsxTemplate = (await import("xlsx-template")).default;
    const buf = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(buffer);
    const template = new XlsxTemplate(buf);
    // xlsx-template no expone getTags, así que extraemos del XML
    const PizZip = (await import("pizzip")).default;
    const zip = new PizZip(buf);
    const placeholders = new Set<string>();

    // Escanear todas las hojas (sheet1.xml, sheet2.xml, etc.)
    const sheetFiles = Object.keys(zip.files).filter((f) => f.match(/^xl\/worksheets\/sheet\d+\.xml$/));
    // También sharedStrings.xml (donde están los strings compartidos)
    const sharedStrings = zip.files["xl/sharedStrings.xml"];
    const filesToScan = [...sheetFiles];
    if (sharedStrings) filesToScan.push("xl/sharedStrings.xml");

    // Patrones: ${name}, [PLACEHOLDER], <placeholder>
    const regexSquare = /\[([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*)\]/g;
    const regexDollar = /\$\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g;
    const regexAngle = /<([a-zA-Z_][a-zA-Z0-9_.]*)>/g;

    for (const filePath of filesToScan) {
      const file = zip.files[filePath];
      if (!file) continue;
      const xml = file.asText();
      let match: RegExpExecArray | null;
      while ((match = regexSquare.exec(xml)) !== null) placeholders.add(match[1].trim());
      while ((match = regexDollar.exec(xml)) !== null) placeholders.add(match[1].trim());
      while ((match = regexAngle.exec(xml)) !== null) placeholders.add(match[1].trim());
    }

    return [...placeholders];
  } catch (e) {
    console.error("Error extrayendo placeholders de xlsx:", e);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// PowerPoint (.pptx) — node-pptx-templater
// ──────────────────────────────────────────────────────────────

async function renderPptx(buffer: Uint8Array | ArrayBuffer, data: Record<string, unknown>): Promise<Uint8Array> {
  const { PPTXTemplater } = await import("node-pptx-templater");
  const buf = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(buffer);

  // node-pptx-templater usa {{placeholder}} por defecto
  // Cargar desde buffer
  const ppt = (await PPTXTemplater.load(buf)) as any;

  // Construir mapa de reemplazos {{key}} → value
  const replacements: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      replacements[`{{${key}}}`] = "";
    } else if (typeof value === "object") {
      replacements[`{{${key}}}`] = JSON.stringify(value);
    } else {
      replacements[`{{${key}}}`] = String(value);
    }
  }

  // Aplicar reemplazos en todas las slides
  try {
    if (typeof ppt.useAllSlides === "function") {
      ppt.useAllSlides().replaceMultiple(replacements);
    } else if (typeof ppt.getSlides === "function") {
      const slides = await ppt.getSlides();
      const slideCount = Array.isArray(slides) ? slides.length : 1;
      for (let i = 1; i <= slideCount; i++) {
        try {
          ppt.useSlide(i).replaceMultiple(replacements);
        } catch {
          // algunas slides pueden no tener placeholders
        }
      }
    } else {
      // último fallback: slide 1
      try {
        ppt.useSlide(1).replaceMultiple(replacements);
      } catch {
        // sin placeholders
      }
    }
  } catch {
    // sin placeholders
  }

  const result = typeof ppt.toBuffer === "function" ? await ppt.toBuffer() : await ppt.export();
  return new Uint8Array(result);
}

async function extractPlaceholdersFromPptx(buffer: Uint8Array | ArrayBuffer): Promise<string[]> {
  try {
    const PizZip = (await import("pizzip")).default;
    const buf = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(buffer);
    const zip = new PizZip(buf);
    const placeholders = new Set<string>();

    // Escanear todas las slides (slide1.xml, slide2.xml, etc.)
    const slideFiles = Object.keys(zip.files).filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/));

    // Patrones: {{name}}, [PLACEHOLDER], <placeholder>
    const regexDouble = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
    const regexSquare = /\[([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)*)\]/g;
    const regexAngle = /<([a-zA-Z_][a-zA-Z0-9_.]*)>/g;

    for (const filePath of slideFiles) {
      const file = zip.files[filePath];
      if (!file) continue;
      const xml = file.asText();
      let match: RegExpExecArray | null;
      while ((match = regexDouble.exec(xml)) !== null) placeholders.add(match[1].trim());
      while ((match = regexSquare.exec(xml)) !== null) placeholders.add(match[1].trim());
      while ((match = regexAngle.exec(xml)) !== null) placeholders.add(match[1].trim());
    }

    return [...placeholders];
  } catch (e) {
    console.error("Error extrayendo placeholders de pptx:", e);
    return [];
  }
}
