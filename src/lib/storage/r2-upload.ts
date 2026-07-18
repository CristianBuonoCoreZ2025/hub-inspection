import "server-only";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Bucket, r2PublicUrl } from "./r2-client";
import { logger } from "@/lib/logger";

/**
 * Sube un archivo a Cloudflare R2 (server-side).
 *
 * @param buffer  — contenido del archivo
 * @param key     — path completo en R2 (ej: "evidences/sessionId/foto.jpg")
 * @param contentType — tipo MIME
 * @returns URL pública del archivo ({r2PublicUrl}/{key})
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (!r2Bucket) {
    throw new Error("R2 no configurado. Faltan variables de entorno: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
  }

  const command = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  const url = `${r2PublicUrl}/${key}`;

  logger.info("Archivo subido a R2", {
    component: "r2-upload",
    action: "r2.upload",
    metadata: { key, size: buffer.length, contentType },
  });

  return url;
}

/**
 * Borra un archivo de Cloudflare R2 (server-side).
 *
 * @param key — path completo en R2 (ej: "claims/L-000000141/actions/.../file.png")
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!r2Bucket) {
    throw new Error("R2 no configurado. Faltan variables de entorno: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
  }

  const command = new DeleteObjectCommand({
    Bucket: r2Bucket,
    Key: key,
  });

  await r2Client.send(command);

  logger.info("Archivo borrado de R2", {
    component: "r2-upload",
    action: "r2.delete",
    metadata: { key },
  });
}
