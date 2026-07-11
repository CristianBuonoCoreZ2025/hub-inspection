import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Obtiene una signed URL temporal para un archivo de Supabase Storage.
 * Reemplaza a getPresignedUrl de Nhost.
 *
 * Acepta tanto URLs de Nhost (legacy) como paths de Supabase Storage.
 * Si la URL no corresponde a Supabase Storage, la devuelve tal cual.
 *
 * @param fileUrlOrPath — URL completa o path dentro del bucket
 * @returns Signed URL temporal, o la URL original si falla.
 */
export async function getPresignedUrl(fileUrlOrPath: string): Promise<string> {
  try {
    // Si es una URL de Nhost legacy (contiene /v1/files/), no podemos presignarla
    // porque Nhost ya no está disponible. Devolver tal cual.
    if (fileUrlOrPath.includes("/v1/files/")) {
      return fileUrlOrPath;
    }

    // Si ya es una URL completa de Supabase, extraer el path
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && fileUrlOrPath.startsWith(supabaseUrl)) {
      // URL formato: https://xxx.supabase.co/storage/v1/object/public/bucket/path
      // o https://xxx.supabase.co/storage/v1/object/sign/bucket/path?token=...
      const match = fileUrlOrPath.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
      if (match) {
        return await createSignedUrl(match[1], match[2]);
      }
    }

    // Si es solo un path (sin URL completa), asumir bucket inspection-evidences
    if (!fileUrlOrPath.startsWith("http")) {
      return await createSignedUrl("inspection-evidences", fileUrlOrPath);
    }

    return fileUrlOrPath;
  } catch {
    return fileUrlOrPath;
  }
}

async function createSignedUrl(bucket: string, path: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hora
    if (error || !data?.signedUrl) return path;
    return data.signedUrl;
  } catch {
    return path;
  }
}

/**
 * Convierte las URLs de evidencias en signed URLs accesibles públicamente.
 * Modifica el array in-place.
 */
export async function presignEvidenceUrls(
  evidences: Array<{ url?: string }>
): Promise<void> {
  await Promise.all(
    evidences.map(async (ev) => {
      if (ev.url) {
        ev.url = await getPresignedUrl(ev.url);
      }
    })
  );
}

/**
 * Convierte las URLs de firmas en signed URLs.
 */
export async function presignSignatureUrls(
  signatures: Array<{ signature_url?: string }>
): Promise<void> {
  await Promise.all(
    signatures.map(async (sig) => {
      if (sig.signature_url) {
        sig.signature_url = await getPresignedUrl(sig.signature_url);
      }
    })
  );
}

/**
 * Convierte las URLs de croquis en signed URLs.
 */
export async function presignSketchUrls(
  sketches: Array<{ sketch_url?: string }>
): Promise<void> {
  await Promise.all(
    sketches.map(async (sk) => {
      if (sk.sketch_url) {
        sk.sketch_url = await getPresignedUrl(sk.sketch_url);
      }
    })
  );
}
