import { getNhostClient } from "./client";

/**
 * Sube un archivo a Nhost Storage y devuelve la URL pública.
 * @param file — Archivo a subir
 * @param path — Ruta opcional dentro del bucket (ej: "companies/logo-123.png")
 */
export async function uploadFileToStorage(
  file: File,
  _path?: string
): Promise<string> {
  const nhost = getNhostClient();

  // Obtener token de sesión del cliente Nhost
  const session = (nhost as unknown as { getUserSession?: () => { accessToken?: string } | null }).getUserSession?.();
  const accessToken = session?.accessToken;

  const storageUrl = process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
  if (!storageUrl) {
    throw new Error("NEXT_PUBLIC_NHOST_STORAGE_URL no configurado");
  }

  const formData = new FormData();
  formData.append("file", file);

  const uploadUrl = `${storageUrl}/v1/files`;

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Error ${response.status}: ${body || "Error al subir archivo"}`);
  }

  const data = (await response.json()) as { id?: string; error?: { message: string } };

  if (data.error) {
    throw new Error(data.error.message || "Error al subir archivo");
  }

  if (!data.id) {
    throw new Error("No se recibió ID del archivo subido");
  }

  return `${storageUrl}/v1/files/${data.id}`;
}
