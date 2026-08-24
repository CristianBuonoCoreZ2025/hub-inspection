/**
 * Sube un archivo a Cloudflare R2 via API route server-side.
 * Reemplaza al upload directo a Supabase Storage.
 *
 * @param file Archivo a subir
 * @param path Path dentro del bucket (ej: "evidences/foto.jpg")
 * @returns URL pública del archivo subido
 */
export async function uploadFileToStorage(
  file: File | Blob,
  path: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al subir archivo a R2");
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
