/**
 * Sube un archivo a Nhost Storage vía API route server-side (usa admin secret).
 * Devuelve la URL pública del archivo subido.
 * @param file — Archivo a subir
 * @param _path — Ruta opcional (no usada por Nhost Storage API)
 */
export async function uploadFileToStorage(
  file: File,
  _path?: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/inspection/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error al subir archivo (${res.status})`);
  }

  const data = (await res.json()) as { url?: string; error?: string };
  if (!data.url) {
    throw new Error(data.error || "No se recibió URL del archivo subido");
  }

  return data.url;
}
