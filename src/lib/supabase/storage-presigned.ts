import "server-only";

/**
 * Obtiene una signed URL temporal para un archivo.
 *
 * Con Cloudflare R2, los archivos tienen URLs públicas (r2PublicUrl/path).
 * Si el archivo ya es una URL pública de R2, se devuelve tal cual.
 * Si es una URL legacy de Supabase/Nhost, se devuelve tal cual (ya no se presigna).
 *
 * @param fileUrlOrPath — URL completa o path del archivo
 * @returns URL accesible
 */
export async function getPresignedUrl(fileUrlOrPath: string): Promise<string> {
  // Si ya es una URL completa (R2, Supabase, Nhost), devolver tal cual
  return fileUrlOrPath;
}

/**
 * Convierte las URLs de evidencias en URLs accesibles.
 * Con R2, las URLs ya son públicas — no necesita transformación.
 */
export async function presignEvidenceUrls(
  evidences: Array<{ url?: string }>
): Promise<void> {
  // No-op: las URLs de R2 ya son públicas
  void evidences;
}

/**
 * Convierte las URLs de firmas en URLs accesibles.
 */
export async function presignSignatureUrls(
  signatures: Array<{ signature_url?: string }>
): Promise<void> {
  // No-op: las URLs de R2 ya son públicas
  void signatures;
}

/**
 * Convierte las URLs de croquis en URLs accesibles.
 */
export async function presignSketchUrls(
  sketches: Array<{ sketch_url?: string }>
): Promise<void> {
  // No-op: las URLs de R2 ya son públicas
  void sketches;
}
