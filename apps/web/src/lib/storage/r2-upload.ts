import "server-only";
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
export async function downloadFromR2(key: string): Promise<Buffer> {
  if (!r2Bucket) {
    throw new Error("R2 no configurado. Faltan variables de entorno: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
  }

  const command = new GetObjectCommand({
    Bucket: r2Bucket,
    Key: key,
  });

  const response = await r2Client.send(command);
  const stream = response.Body as NodeJS.ReadableStream | undefined;
  if (!stream) throw new Error(`No se pudo descargar ${key} de R2`);

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
  }
  const buffer = Buffer.concat(chunks);

  logger.info("Archivo descargado de R2", {
    component: "r2-download",
    action: "r2.download",
    metadata: { key, size: buffer.length },
  });

  return buffer;
}

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

/**
 * Genera una URL presigned para subir un archivo directamente a R2 desde el cliente.
 * Evita el límite de body size de Vercel/Next.js para archivos grandes (ej: grabaciones de video).
 *
 * @param key — path completo en R2
 * @param contentType — tipo MIME del archivo
 * @param expiresIn — tiempo de validez de la URL (default: 10 min)
 * @returns URL presigned para PUT
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 600,
): Promise<string> {
  if (!r2Bucket) {
    throw new Error("R2 no configurado. Faltan variables de entorno: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
  }

  const command = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn });

  logger.info("URL presigned generada", {
    component: "r2-upload",
    action: "r2.presign",
    metadata: { key, contentType, expiresIn },
  });

  return url;
}
