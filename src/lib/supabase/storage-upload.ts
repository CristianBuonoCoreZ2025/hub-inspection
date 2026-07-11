import { getSupabaseClient } from "./client";

/**
 * Sube un archivo a Supabase Storage.
 * Reemplaza a uploadFileToStorage de Nhost.
 *
 * @param file Archivo a subir
 * @param path Path dentro del bucket (ej: "evidences/foto.jpg")
 * @param bucket Bucket de Supabase Storage (default: "inspection-evidences")
 * @returns URL pública del archivo subido
 */
export async function uploadFileToStorage(
  file: File | Blob,
  path: string,
  bucket = "inspection-evidences"
): Promise<string> {
  const supabase = getSupabaseClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = file instanceof File ? file.type : "application/octet-stream";

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
