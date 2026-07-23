/**
 * Scanner de archivos huérfanos en R2.
 *
 * Lista TODOS los objetos del bucket R2 y los compara contra todas las tablas
 * de la BD que tienen columnas `url`, `file_path`, `sketch_url`, etc.
 *
 * Un archivo es huérfano si existe en R2 pero ninguna tabla lo referencia.
 *
 * Uso:
 *   node scripts/r2-orphan-scanner.cjs              # solo reportar
 *   node scripts/r2-orphan-scanner.cjs --delete      # reportar + borrar huérfanos
 */
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const DO_DELETE = process.argv.includes("--delete");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

(async () => {
  // ── 1. Listar TODOS los objetos de R2 ──
  console.log("=== Listando objetos en R2 ===");
  const allKeys = new Set();
  let continuationToken;
  let totalSize = 0;
  let totalObjects = 0;

  do {
    const resp = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    if (resp.Contents) {
      for (const obj of resp.Contents) {
        allKeys.add(obj.Key);
        totalSize += obj.Size;
        totalObjects++;
      }
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`Total objetos en R2: ${totalObjects} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

  // ── 2. Conectar a la BD y recolectar todas las keys referenciadas ──
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await c.connect();

  const referencedKeys = new Set();

  // Helper: extraer la key de una URL pública
  function extractKey(url) {
    if (!url || typeof url !== "string") return null;
    // Quitar el publicUrl prefix
    if (url.startsWith(publicUrl + "/")) {
      return url.substring(publicUrl.length + 1);
    }
    // Si ya es una key relativa
    if (!url.startsWith("http")) return url;
    return null;
  }

  // Tablas y columnas que contienen URLs/paths a R2
  const tables = [
    { table: "claim_images", columns: ["url", "file_path"] },
    { table: "inspection_evidences", columns: ["url"] },
    { table: "claim_documents", columns: ["file_url", "file_path", "document_url"] },
    { table: "policy_documents", columns: ["document_url"] },
    { table: "damage_sketches", columns: ["sketch_url"] },
    { table: "claim_action_documents", columns: ["file_url", "file_path"] },
    { table: "companies", columns: ["logo_url"] },
    { table: "profiles", columns: ["avatar_url"] },
    { table: "document_templates", columns: ["file_url", "file_id"] },
  ];

  for (const { table, columns } of tables) {
    try {
      const colList = columns.join(", ");
      const res = await c.query(`SELECT ${colList} FROM ${table}`);
      let count = 0;
      for (const row of res.rows) {
        for (const col of columns) {
          const key = extractKey(row[col]);
          if (key) {
            referencedKeys.add(key);
            count++;
          }
        }
      }
      console.log(`  ${table}: ${count} keys referenciadas`);
    } catch (e) {
      console.log(`  ${table}: SKIP (${e.message})`);
    }
  }

  console.log(`\nTotal keys referenciadas en BD: ${referencedKeys.size}`);

  // ── 3. Encontrar huérfanos ──
  const orphans = [];
  for (const key of allKeys) {
    if (!referencedKeys.has(key)) {
      orphans.push(key);
    }
  }

  console.log(`\n=== HUÉRFANOS: ${orphans.length} archivos ===`);
  if (orphans.length === 0) {
    console.log("No hay archivos huérfanos. R2 está limpio.");
    await c.end();
    return;
  }

  // Agrupar por carpeta para mejor visualización
  const byFolder = {};
  for (const key of orphans) {
    const folder = key.substring(0, key.lastIndexOf("/")) || "(root)";
    if (!byFolder[folder]) byFolder[folder] = [];
    byFolder[folder].push(key);
  }

  for (const [folder, keys] of Object.entries(byFolder).sort()) {
    console.log(`\n  ${folder}/ (${keys.length} archivos)`);
    for (const k of keys.slice(0, 20)) {
      console.log(`    ${k.split("/").pop()}`);
    }
    if (keys.length > 20) console.log(`    ... y ${keys.length - 20} más`);
  }

  // ── 4. Borrar si --delete ──
  if (DO_DELETE) {
    console.log(`\n=== BORRANDO ${orphans.length} huérfanos ===`);
    // Borrar en lotes de 1000 (límite de DeleteObjects)
    for (let i = 0; i < orphans.length; i += 1000) {
      const batch = orphans.slice(i, i + 1000);
      const resp = await r2.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map(k => ({ Key: k })),
        },
      }));
      const deleted = resp.Deleted?.length || 0;
      console.log(`  Lote ${Math.floor(i / 1000) + 1}: ${deleted} borrados`);
    }
    console.log("Borrado completo.");
  } else {
    console.log(`\n>>> Para BORRAR los huérfanos, ejecutar con --delete`);
  }

  await c.end();
})().catch((e) => {
  console.log("FATAL:", e.message);
  process.exit(1);
});
