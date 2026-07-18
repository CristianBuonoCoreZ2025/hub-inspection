require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Script de auditoría: lista todos los objetos en R2 y verifica cuáles están
 * registrados en la base de datos. Reporta los huérfanos (archivos en R2 sin
 * registro en BD) y opcionalmente los borra.
 *
 * Tablas/columnas que contienen URLs de R2:
 *   - inspection_evidences.url
 *   - inspection_signatures.signature_url
 *   - damage_sketches.sketch_url
 *   - inspection_reports.report_url
 *   - companies.logo_url
 *   - claim_actions.document_url (si existe)
 *   - policy_documents.url (si existe)
 *   - claim_documents.url (si existe)
 *
 * Uso:
 *   node scripts/r2-audit-orphans.cjs           — solo reporta
 *   node scripts/r2-audit-orphans.cjs --delete   — reporta y borra los huérfanos
 */
async function main() {
  const deleteMode = process.argv.includes('--delete');
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  // 1. Listar todos los objetos en R2
  console.log('📦 Listando objetos en R2...\n');
  let allKeys = [];
  let continuationToken = null;
  do {
    const listRes = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    if (listRes.Contents) {
      allKeys.push(...listRes.Contents.map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified })));
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : null;
  } while (continuationToken);

  console.log(`Total objetos en R2: ${allKeys.length}\n`);

  // 2. Recopilar todas las URLs registradas en la BD
  const tables = [
    { table: 'inspection_evidences', column: 'url' },
    { table: 'inspection_signatures', column: 'signature_url' },
    { table: 'damage_sketches', column: 'sketch_url' },
    { table: 'inspection_reports', column: 'report_url' },
    { table: 'companies', column: 'logo_url' },
  ];

  // Verificar tablas opcionales
  for (const extra of [
    { table: 'claim_actions', column: 'document_url' },
    { table: 'claim_documents', column: 'url' },
    { table: 'policy_documents', column: 'url' },
  ]) {
    const { rows } = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    `, [extra.table, extra.column]);
    if (rows.length > 0) tables.push(extra);
  }

  const dbUrls = new Set();
  for (const { table, column } of tables) {
    const { rows } = await c.query(`SELECT ${column} as url FROM ${table} WHERE ${column} IS NOT NULL`);
    for (const row of rows) {
      if (row.url) dbUrls.add(row.url);
    }
  }

  console.log(`URLs registradas en BD: ${dbUrls.size}\n`);

  // 3. Convertir keys de R2 a URLs y comparar
  const orphans = [];
  for (const obj of allKeys) {
    const url = `${publicUrl}/${obj.key}`;
    if (!dbUrls.has(url)) {
      orphans.push(obj);
    }
  }

  console.log(`════════════════════════════════════════════════════════════`);
  console.log(`🔍 HUÉRFANOS (archivos en R2 sin registro en BD): ${orphans.length}`);
  console.log(`════════════════════════════════════════════════════════════\n`);

  if (orphans.length === 0) {
    console.log('✅ No hay archivos huérfanos. R2 y BD están sincronizados.');
    await c.end();
    return;
  }

  for (const obj of orphans) {
    const sizeKB = (obj.size / 1024).toFixed(1);
    console.log(`  🗑️  ${obj.key} (${sizeKB} KB) — ${obj.lastModified?.toISOString?.() || ''}`);
  }

  if (deleteMode) {
    console.log(`\n⚠️  Borrando ${orphans.length} archivos huérfanos de R2...\n`);
    let deleted = 0;
    let failed = 0;
    for (const obj of orphans) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.key }));
        console.log(`  ✅ Borrado: ${obj.key}`);
        deleted++;
      } catch (err) {
        console.log(`  ❌ Error: ${obj.key} — ${err.message}`);
        failed++;
      }
    }
    console.log(`\n📊 Borrados: ${deleted}, Fallidos: ${failed}`);
  } else {
    console.log(`\n💡 Para borrar los huérfanos, ejecuta:`);
    console.log(`   node scripts/r2-audit-orphans.cjs --delete`);
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
