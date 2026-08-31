import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente de Cloudflare R2 (S3-compatible).
 *
 * Requiere las siguientes variables de entorno en .env.local:
 *   R2_ACCOUNT_ID       — Account ID de Cloudflare (dash.cloudflare.com → R2)
 *   R2_ACCESS_KEY_ID    — Access Key ID (R2 → Manage R2 API Tokens)
 *   R2_SECRET_ACCESS_KEY — Secret Access Key
 *   R2_BUCKET_NAME      — Nombre del bucket creado en R2
 *   R2_PUBLIC_URL       — URL pública del bucket (ej: https://pub-xxx.r2.dev)
 *                         o dominio custom (ej: https://files.tudominio.com)
 *
 * R2 es S3-compatible: usamos el SDK de AWS S3 con el endpoint de R2.
 * El egress (descargas) es GRATIS en R2, a diferencia de AWS S3.
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  // No lanzar error en build time — solo se necesita en runtime server-side
  console.warn(
    "[R2] Faltan variables de entorno. Configura en .env.local:\n" +
      "  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL"
  );
}

export const r2Bucket = bucketName || "";
export const r2PublicUrl = publicUrl || "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});
