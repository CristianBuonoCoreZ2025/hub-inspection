import "server-only";

/**
 * Obtiene una presigned URL para un archivo de Nhost Storage.
 * Usa admin secret server-side. La presigned URL permite acceso
 * público temporal (sin auth) al archivo.
 *
 * @param fileUrl — URL completa del archivo (https://...storage.../v1/files/{id})
 * @returns Presigned URL temporal, o la URL original si falla.
 */
export async function getPresignedUrl(fileUrl: string): Promise<string> {
  try {
    const adminSecret = process.env.NHOST_ADMIN_SECRET;
    if (!adminSecret) return fileUrl;

    // Extraer el file ID de la URL: .../v1/files/{id}
    const match = fileUrl.match(/\/v1\/files\/([a-f0-9-]+)/i);
    if (!match) return fileUrl;
    const fileId = match[1];

    // Construir la URL base de storage
    const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
    const region = process.env.NEXT_PUBLIC_NHOST_REGION;
    const storageUrl =
      process.env.NEXT_PUBLIC_NHOST_STORAGE_URL ||
      (subdomain && region
        ? `https://${subdomain}.storage.${region}.nhost.run`
        : null);
    if (!storageUrl) return fileUrl;

    const presignRes = await fetch(
      `${storageUrl}/v1/files/${fileId}/presignedurl`,
      {
        method: "GET",
        headers: {
          "x-hasura-admin-secret": adminSecret,
        },
        cache: "no-store",
      }
    );

    if (!presignRes.ok) return fileUrl;

    const data = (await presignRes.json()) as { url?: string };
    return data.url || fileUrl;
  } catch {
    return fileUrl;
  }
}

/**
 * Convierte las URLs de evidencias en presigned URLs accesibles públicamente.
 * Modifica el array de evidencias in-place.
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
 * Convierte las URLs de firmas en presigned URLs.
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
 * Convierte las URLs de croquis en presigned URLs.
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
