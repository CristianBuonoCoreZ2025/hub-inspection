import { logger } from "@/lib/logger";

// ──────────────────────────────────────────────────────────────
// Conversión de documentos de ofimática a PDF
// Usa Gotenberg (self-hosted, open source) por defecto.
// Alternativa: LibreOffice headless.
// ──────────────────────────────────────────────────────────────

/**
 * Convierte un documento de ofimática (Word/Excel/PowerPoint) a PDF
 * usando Gotenberg.
 *
 * Gotenberg API: POST {GOTENBERG_URL}/forms/libreoffice/convert
 * Body: multipart/form-data con campo "files" (el archivo a convertir)
 * Response: el PDF como binario
 *
 * @param buffer — contenido del archivo original
 * @param fileName — nombre del archivo original (con extensión)
 * @returns — buffer del PDF generado
 */
export async function convertToPdf(buffer: Uint8Array, fileName: string): Promise<Uint8Array> {
  const gotenbergUrl = process.env.GOTENBERG_URL;

  if (!gotenbergUrl) {
    throw new Error(
      "GOTENBERG_URL no está configurada. Para convertir a PDF, desplegá Gotenberg (Docker) y configurá la variable de entorno."
    );
  }

  const url = `${gotenbergUrl.replace(/\/$/, "")}/forms/libreoffice/convert`;
  logger.info("Convirtiendo documento a PDF via Gotenberg", {
    component: "pdf-conversion",
    action: "convert",
    metadata: { url, fileName, size: buffer.byteLength },
  });

  // Construir multipart/form-data manualmente (sin dependencias extra)
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
  const fileBuffer = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(buffer);

  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n`),
    Buffer.from("Content-Type: application/octet-stream\r\n\r\n"),
    fileBuffer,
    Buffer.from("\r\n"),
    Buffer.from(`--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(parts);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Gotenberg error ${response.status}: ${errorText}`);
  }

  const pdfBuffer = await response.arrayBuffer();
  return new Uint8Array(pdfBuffer);
}
