import "server-only";
import { logger } from "@/lib/logger";

/**
 * Extrae el texto de las primeras N páginas de un PDF y genera un resumen.
 *
 * Usado al subir documentos como evidencia de inspección, para que el acta
 * impresa pueda mencionar el contenido del documento sin necesidad de links.
 *
 * @param buffer  Buffer del PDF
 * @param maxPages Máximo de páginas a analizar (default 10)
 * @returns { text, summary, pageCount } o null si no se pudo procesar
 */
export async function summarizePdf(
  buffer: Buffer,
  maxPages = 10
): Promise<{ text: string; summary: string; pageCount: number } | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const result = await parser.getText();

    const total = result.total || 0;
    const pages = result.pages || [];
    const analyzedPages = pages.slice(0, maxPages);
    const analyzedText = analyzedPages.map((p: { text: string }) => p.text).join("\n\n");

    const summary = buildSummary(analyzedText, total, maxPages);

    return {
      text: analyzedText,
      summary,
      pageCount: total,
    };
  } catch (err) {
    logger.warn("No se pudo procesar el PDF para resumen", {
      component: "pdf-summary",
      action: "summarize.pdf",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
}

/**
 * Genera un resumen extractivo simple del texto del PDF.
 *
 * Sin IA: toma las primeras líneas relevantes + busca palabras clave
 * típicas de documentos de seguros (póliza, cobertura, deducible, etc.)
 */
function buildSummary(text: string, totalPages: number, analyzedPages: number): string {
  if (!text || !text.trim()) {
    return "Documento sin texto extraíble (posiblemente escaneado).";
  }

  // Limpiar y dividir en líneas
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10);

  if (lines.length === 0) {
    return "Documento sin contenido legible.";
  }

  // Palabras clave típicas de documentos de seguros
  const keywords = [
    "póliza", "poliza", "cobertura", "deducible", "siniestro",
    "indemnización", "indemnizacion", "asegurado", "aseguradora",
    "vigencia", "prima", "capital", "riesgo", "exclusión", "exclusion",
    "límite", "limite", "subrogación", "subrogacion",
  ];

  // Encontrar líneas con palabras clave
  const keyLines = lines.filter((line) =>
    keywords.some((kw) => line.toLowerCase().includes(kw))
  );

  // Tomar las primeras 5 líneas significativas como introducción
  const intro = lines.slice(0, 5).join(" ");

  // Tomar hasta 5 líneas con palabras clave
  const relevant = keyLines.slice(0, 5).join(" | ");

  const pageNote = totalPages > analyzedPages
    ? ` (analizadas primeras ${analyzedPages} de ${totalPages} páginas)`
    : ` (${totalPages} ${totalPages === 1 ? "página" : "páginas"})`;

  let summary = intro;
  if (relevant && relevant !== intro) {
    summary += ` — Aspectos relevantes: ${relevant}`;
  }
  summary += pageNote;

  // Limitar a 500 caracteres
  if (summary.length > 500) {
    summary = summary.substring(0, 497) + "...";
  }

  return summary;
}
