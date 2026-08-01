import { Client } from "pg";
import { config } from "dotenv";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { logger } from "../src/lib/logger";

config({ path: ".env.production" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no está configurado");
  process.exit(1);
}

const LIQUIDATION_NUMBER = "L-000000048";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const bucket = process.env.R2_BUCKET_NAME || "";
const publicUrl = process.env.R2_PUBLIC_URL || "";

const MAX_WIDTH = 1920;
const QUALITY = 80;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL");

    const sessionRes = await client.query(
      `SELECT s.id FROM inspection_sessions s
       JOIN claims c ON c.id = s.claim_id
       WHERE c.liquidation_number = $1
       LIMIT 1`,
      [LIQUIDATION_NUMBER]
    );

    if (sessionRes.rows.length === 0) {
      console.log("⚠️ No se encontró sesión");
      return;
    }

    const sessionId = sessionRes.rows[0].id;

    const evidenceRes = await client.query(
      `SELECT id, url, metadata FROM inspection_evidences
       WHERE session_id = $1
         AND (metadata ->> 'converted_from' = 'heic'
              OR LOWER(metadata::text) LIKE '%heic%')
         AND LOWER(url) LIKE '%.jpg'`,
      [sessionId]
    );

    console.log(`🖼️ Encontradas ${evidenceRes.rows.length} evidencias convertidas`);

    for (const ev of evidenceRes.rows) {
      try {
        console.log(`\n▶️ Procesando ${ev.id}: ${ev.url}`);

        if (!ev.url || !publicUrl || !ev.url.startsWith(publicUrl)) {
          console.log("   ⚠️ URL inválida, saltando");
          continue;
        }

        const key = ev.url.slice(publicUrl.length + 1);
        const originalName = ev.metadata?.originalName || key.split("/").pop() || "file.jpg";

        // Descargar JPEG convertido
        const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const obj = await r2Client.send(getCmd);
        const chunks: Buffer[] = [];
        if (!obj.Body) {
          console.log("   ⚠️ No se pudo descargar");
          continue;
        }
        for await (const chunk of obj.Body as any) chunks.push(chunk);
        const inputBuffer = Buffer.concat(chunks);
        console.log(`   ⬇️ Descargados ${inputBuffer.length} bytes`);

        // Optimizar con sharp
        const optimized = await sharp(inputBuffer)
          .rotate()
          .resize({ width: MAX_WIDTH, withoutEnlargement: true, fit: sharp.fit.inside })
          .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
          .toBuffer();

        console.log(`   🗜️ Optimizado: ${optimized.length} bytes (${Math.round((1 - optimized.length / inputBuffer.length) * 100)}% reducción)`);

        // Subir optimizado (mismo key)
        await r2Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: optimized,
            ContentType: "image/jpeg",
          })
        );
        console.log(`   ⬆️ Re-subido ${key}`);

        const newName = originalName.replace(/\.(heic|heif)$/i, ".jpg");
        const metadata = {
          ...ev.metadata,
          originalName: newName,
          mimeType: "image/jpeg",
          fileSize: optimized.length,
          converted_from: "heic",
        };

        await client.query(
          `UPDATE inspection_evidences
           SET metadata = $1
           WHERE id = $2`,
          [JSON.stringify(metadata), ev.id]
        );
        console.log(`   ✅ Metadata actualizada: ${newName}, ${optimized.length} bytes`);
      } catch (err) {
        console.error(`   ❌ Error en ${ev.id}:`, (err as Error).message);
      }
    }

    console.log("\n🎉 Re-optimización finalizada");
  } catch (err) {
    console.error("\n❌ Error:", (err as Error).message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
