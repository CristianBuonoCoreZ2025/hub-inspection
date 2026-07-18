require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

/**
 * Actualiza las URLs en la BD que apuntan a paths antiguos en español de R2.
 * Uso: node scripts/r2-update-db-urls.cjs
 */
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const replacements = [
    ['siniestros/', 'claims/'],
    ['gestiones/', 'actions/'],
    ['documentos/', 'documents/'],
    ['imagenes/', 'images/'],
    ['configuracion/', 'config/'],
    ['polizas/', 'policies/'],
    ['empresas/', 'companies/'],
  ];

  const targets = [
    { table: 'inspection_evidences', column: 'url' },
    { table: 'inspection_signatures', column: 'signature_url' },
    { table: 'damage_sketches', column: 'sketch_url' },
    { table: 'inspection_reports', column: 'report_url' },
    { table: 'companies', column: 'logo_url' },
  ];

  let totalUpdated = 0;

  for (const { table, column } of targets) {
    // Verificar si la columna existe
    const { rows: exists } = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    `, [table, column]);

    if (exists.length === 0) {
      console.log(`  ⏭️  ${table}.${column} — no existe`);
      continue;
    }

    // Hacer un UPDATE por cada reemplazo
    let tableUpdated = 0;
    for (const [old, neu] of replacements) {
      const res = await c.query(
        `UPDATE ${table} SET ${column} = REPLACE(${column}, $1, $2) WHERE ${column} LIKE $3`,
        [old, neu, `%${old}%`]
      );
      tableUpdated += res.rowCount;
    }

    console.log(`  ${tableUpdated > 0 ? '✅' : '⏭️ '} ${table}.${column} — ${tableUpdated} filas actualizadas`);
    totalUpdated += tableUpdated;
  }

  console.log(`\n📊 Total filas actualizadas: ${totalUpdated}`);
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
