import "server-only";
import { logger } from "@/lib/logger";

/**
 * Optimización de archivos antes de subir a R2.
 *
 * - Imágenes (jpeg, png, webp, heif, tiff, gif, avif): se optimizan con sharp
 *   - Redimensiona a máximo 1920px en el lado más largo (mantiene aspect ratio)
 *   - Comprime con quality 80
 *   - Mantiene el formato original (no convierte)
 * - PDFs, videos, docx, xlsx, etc.: se devuelven tal cual (no se optimizan)
 *
 * Regla del sistema: todo archivo subido pasa por este proceso.
 * Si es una imagen, se optimiza. Si no, pasa sin cambios.
 *
 * NOTA: sharp se importa dinámicamente para evitar errores en entornos
 * donde no está disponible (ej: Vercel serverless sin el binary correcto).
 * Si sharp no carga, se devuelve el archivo original sin optimizar.
 */

/** Tamaño máximo del lado más largo de una imagen (px). */
const MAX_DIMENSION = 1920;

/** Calidad de compresión para formatos con lossy (jpeg, webp, avif). */
const QUALITY = 80;

/** Tipos MIME que sharp puede optimizar. */
const OPTIMIZABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heif",
  "image/heic",
  "image/tiff",
  "image/bmp",
]);

/** Extensiones que sharp puede optimizar. */
const OPTIMIZABLE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heif",
  ".heic",
  ".tif",
  ".tiff",
  ".bmp",
]);

/**
 * Determina si un archivo es optimizable (es una imagen que sharp puede procesar).
 */
export function isOptimizable(mimeType: string, ext: string): boolean {
  const normalizedExt = ext.toLowerCase().startsWith(".") ? ext.toLowerCase() : "." + ext.toLowerCase();
  return OPTIMIZABLE_MIME_TYPES.has(mimeType.toLowerCase()) ||
    OPTIMIZABLE_EXTENSIONS.has(normalizedExt);
}

/**
 * Carga sharp dinámicamente. Retorna null si no está disponible.
 */
async function loadSharp(): Promise<typeof import("sharp")["default"] | null> {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default;
  } catch (err) {
    logger.warn("sharp no disponible — optimización deshabilitada", {
      component: "optimize",
      action: "sharp.load.error",
      metadata: { error: (err as Error).message },
    });
    return null;
  }
}

/**
 * Optimiza un archivo antes de subirlo a R2.
 *
 * Si es una imagen: la redimensiona (max 1920px) y comprime con sharp.
 * Si no es imagen: la devuelve sin cambios.
 * Si sharp no está disponible: la devuelve sin cambios.
 *
 * @param buffer — contenido original del archivo
 * @param mimeType — tipo MIME del archivo
 * @param ext — extensión del archivo (ej: ".jpg", ".png")
 * @returns { buffer, mimeType, ext } — contenido optimizado (o el original si no se optimizó)
 */
export async function optimizeFile(
  buffer: Buffer,
  mimeType: string,
  ext: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  // Si no es imagen, devolver sin cambios
  if (!isOptimizable(mimeType, ext)) {
    return { buffer, mimeType, ext };
  }

  const normalizedExt = ext.toLowerCase().startsWith(".")
    ? ext.toLowerCase()
    : "." + ext.toLowerCase();

  // Cargar sharp dinámicamente
  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer, mimeType, ext };
  }

  try {
    let pipeline = sharp(buffer).rotate(); // Rotar según EXIF (fotos de móvil)

    // Redimensionar si excede el máximo (sin upscale)
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });

    // Aplicar compresión según el formato
    let outputBuffer: Buffer;
    let outputExt = normalizedExt;
    let outputMime = mimeType;

    switch (normalizedExt) {
      case ".jpg":
      case ".jpeg":
        outputBuffer = await pipeline
          .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
          .toBuffer();
        outputMime = "image/jpeg";
        break;

      case ".png":
        outputBuffer = await pipeline
          .png({
            quality: QUALITY,
            compressionLevel: 9,
            palette: true,
            progressive: true,
          })
          .toBuffer();
        outputMime = "image/png";
        break;

      case ".webp":
        outputBuffer = await pipeline
          .webp({ quality: QUALITY })
          .toBuffer();
        outputMime = "image/webp";
        break;

      case ".gif":
        // GIF: sharp no anima bien, mantener como está
        return { buffer, mimeType, ext };

      case ".avif":
        outputBuffer = await pipeline
          .avif({ quality: QUALITY })
          .toBuffer();
        outputMime = "image/avif";
        break;

      case ".heif":
      case ".heic":
        // HEIF/HEIC: convertir a JPEG para compatibilidad web
        outputBuffer = await pipeline
          .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
          .toBuffer();
        outputExt = ".jpg";
        outputMime = "image/jpeg";
        break;

      case ".tif":
      case ".tiff":
        // TIFF: convertir a JPEG para compatibilidad web
        outputBuffer = await pipeline
          .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
          .toBuffer();
        outputExt = ".jpg";
        outputMime = "image/jpeg";
        break;

      case ".bmp":
        // BMP: convertir a PNG (sin pérdida, más eficiente)
        outputBuffer = await pipeline
          .png({ compressionLevel: 9, palette: true })
          .toBuffer();
        outputExt = ".png";
        outputMime = "image/png";
        break;

      default:
        // Formato no manejado explícitamente: devolver sin cambios
        return { buffer, mimeType, ext };
    }

    const originalSize = buffer.length;
    const optimizedSize = outputBuffer.length;
    const reduction = originalSize > 0
      ? Math.round((1 - optimizedSize / originalSize) * 100)
      : 0;

    logger.info("Imagen optimizada", {
      component: "optimize",
      action: "optimize.image",
      metadata: {
        originalSize,
        optimizedSize,
        reduction: `${reduction}%`,
        ext: normalizedExt,
        outputExt,
      },
    });

    // Si la optimización resultó en un archivo MÁS grande, usar el original
    if (optimizedSize >= originalSize) {
      logger.info("Optimización descartada — el original es más pequeño", {
        component: "optimize",
        action: "optimize.skip",
        metadata: { originalSize, optimizedSize, ext: normalizedExt },
      });
      return { buffer, mimeType, ext };
    }

    return { buffer: outputBuffer, mimeType: outputMime, ext: outputExt };
  } catch (err) {
    // Si la optimización falla, usar el original (no bloquear el upload)
    logger.warn("Optimización falló — usando original", {
      component: "optimize",
      action: "optimize.error",
      metadata: { error: (err as Error).message, ext: normalizedExt, mimeType },
    });
    return { buffer, mimeType, ext };
  }
}
