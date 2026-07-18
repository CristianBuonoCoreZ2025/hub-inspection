import "server-only";
import exifr from "exifr";
import { logger } from "@/lib/logger";

/**
 * Extrae latitud y longitud de los metadatos EXIF GPS de una imagen.
 *
 * Usa exifr para parsear solo el bloque GPS (eficiente — no parsea todo el EXIF).
 * Convierte las coordenadas EXIF (DMS + referencia N/S/E/W) a grados decimales.
 *
 * @param buffer — contenido binario de la imagen
 * @returns { lat, lng } | null — coordenadas en grados decimales, o null si no hay GPS
 */
export async function extractGpsFromExif(
  buffer: Buffer
): Promise<{ lat: number; lng: number } | null> {
  try {
    // exifr con gps: true parsea solo el bloque GPS — rápido y liviano
    const gps = await exifr.gps(buffer);

    if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") {
      return null;
    }

    const lat = gps.latitude;
    const lng = gps.longitude;

    // Validar que sean coordenadas válidas
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return null;
    }

    logger.info("GPS extraído de EXIF", {
      component: "exif",
      action: "exif.gps.extracted",
      metadata: { lat, lng },
    });

    return { lat, lng };
  } catch (err) {
    // Si EXIF no se puede leer (no es imagen, formato sin EXIF, etc.), devolver null
    logger.info("No se pudo extraer GPS de EXIF (sin metadatos GPS o no es imagen)", {
      component: "exif",
      action: "exif.gps.none",
      metadata: { error: (err as Error).message },
    });
    return null;
  }
}
