import { readFileSync } from "fs";
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync } from "fs";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import convert from "heic-convert";

const envPath = existsSync(".env.production") ? ".env.production" : existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envPath });

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

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: ["127.0.0.1", "localhost"].includes(new URL(DATABASE_URL).hostname)
      ? false
      : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL");

    // Buscar session del siniestro
    const sessionRes = await client.query(
      `
      SELECT s.id
      FROM inspection_sessions s
      JOIN claims c ON c.id = s.claim_id
      WHERE c.liquidation_number = $1
      LIMIT 1
      `,
      [LIQUIDATION_NUMBER]
    );

    if (sessionRes.rows.length === 0) {
      console.log("⚠️ No se encontró sesión de inspección para", LIQUIDATION_NUMBER);
      return;
    }

    const sessionId = sessionRes.rows[0].id;
    console.log("📂 Sesión:", sessionId);

    // Buscar evidencias HEIC/HEIF
    const evidenceRes = await client.query(
      `
      SELECT id, url, metadata
      FROM inspection_evidences
      WHERE session_id = $1
        AND (
          LOWER(url) LIKE '%.heic'
          OR LOWER(url) LIKE '%.heif'
          OR LOWER(metadata::text) LIKE '%heic%'
          OR LOWER(metadata::text) LIKE '%heif%'
        )
      `,
      [sessionId]
    );

    if (evidenceRes.rows.length === 0) {
      console.log("✅ No hay evidencias HEIC/HEIF en esta sesión");
      return;
    }

    console.log(`🖼️ Encontradas ${evidenceRes.rows.length} evidencias HEIC/HEIF`);

    for (const ev of evidenceRes.rows) {
      try {
        console.log(`\n▶️ Procesando ${ev.id}: ${ev.url}`);

        const url = ev.url as string;
        if (!url || !publicUrl || !url.startsWith(publicUrl)) {
          console.log("   ⚠️ URL inválida o sin publicUrl, saltando");
          continue;
        }
        const key = url.slice(publicUrl.length + 1);
        const originalName = ev.metadata?.originalName || key.split("/").pop() || "file";

        // Descargar de R2
        const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const obj = await r2Client.send(getCmd);
        const chunks: Buffer[] = [];
        if (!obj.Body) {
          console.log("   ⚠️ No se pudo descargar el archivo");
          continue;
        }
        for await (const chunk of obj.Body as any) {
          chunks.push(chunk);
        }
        const originalBuffer = Buffer.concat(chunks);
        console.log(`   ⬇️ Descargados ${originalBuffer.length} bytes`);

        // Convertir HEIC a JPEG
        const jpegBuffer = await convert({
          buffer: originalBuffer,
          format: "JPEG",
          quality: 0.9,
        });
        console.log(`   🔄 Convertido a JPEG: ${jpegBuffer.length} bytes`);

        // Nombre nuevo
        const newKey = key.replace(/\.(heic|heif)$/i, ".jpg");
        const newName = originalName.replace(/\.(heic|heif)$/i, ".jpg");

        // Subir a R2
        await r2Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: jpegBuffer,
            ContentType: "image/jpeg",
          })
        );
        console.log(`   ⬆️ Subido a ${newKey}`);

        const newUrl = `${publicUrl}/${newKey}`;

        // Actualizar BD
        const metadata = { ...(ev.metadata || {}), original_name: originalName, converted_from: "heic" };
        await client.query(
          `
          UPDATE inspection_evidences
          SET url = $1, metadata = $2
          WHERE id = $3
          `,
          [newUrl, JSON.stringify(metadata), ev.id]
        );
        console.log(`   ✅ Actualizado en BD`);
      } catch (err) {
        console.error(`   ❌ Error procesando ${ev.id}:`, (err as Error).message);
      }
    }

    console.log("\n🎉 Reproceso finalizado");
  } catch (err) {
    console.error("\n❌ Error:", (err as Error).message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
