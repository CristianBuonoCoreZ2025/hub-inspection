require('dotenv').config({ path: '.env.local' });
const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Script para renombrar la estructura de carpetas en R2 de español a inglés.
 *
 * siniestros/ → claims/
 * gestiones/  → actions/
 * documentos/ → documents/
 * imagenes/   → images/
 * configuracion/ → config/
 * polizas/    → policies/
 * empresas/   → companies/
 *
 * Copia cada objeto al nuevo path y borra el original.
 *
 * Uso: node scripts/r2-rename-paths.cjs
 */
async function main() {
  const bucket = process.env.R2_BUCKET_NAME;
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const replacements = [
    ['siniestros/', 'claims/'],
    ['gestiones/', 'actions/'],
    ['documentos/', 'documents/'],
    ['imagenes/', 'images/'],
    ['configuracion/', 'config/'],
    ['polizas/', 'policies/'],
    ['empresas/', 'companies/'],
  ];

  console.log('📦 Listando todos los objetos en R2...\n');
  
  let allKeys = [];
  let continuationToken = null;
  
  do {
    const listRes = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    
    if (listRes.Contents) {
      allKeys.push(...listRes.Contents.map(o => o.Key));
    }
    
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : null;
  } while (continuationToken);

  console.log(`Total objetos: ${allKeys.length}\n`);
  
  const toMigrate = allKeys.filter(key =>
    replacements.some(([old]) => key.includes(old))
  );

  console.log(`Objetos a migrar: ${toMigrate.length}\n`);

  if (toMigrate.length === 0) {
    console.log('✅ No hay objetos para migrar.');
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (const oldKey of toMigrate) {
    let newKey = oldKey;
    for (const [oldPath, newPath] of replacements) {
      newKey = newKey.split(oldPath).join(newPath);
    }

    if (newKey === oldKey) continue;

    try {
      await r2.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${oldKey}`,
        Key: newKey,
      }));

      await r2.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: oldKey,
      }));

      console.log(`  ✅ ${oldKey} → ${newKey}`);
      migrated++;
    } catch (err) {
      console.log(`  ❌ ${oldKey}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Migración completa: ${migrated} migrados, ${failed} fallidos`);
}

main().catch(e => { console.error(e); process.exit(1); });
