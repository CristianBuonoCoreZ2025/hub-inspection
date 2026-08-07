require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

// Códigos PG que indican que el objeto ya existe (la migración ya fue aplicada)
const ALREADY_EXISTS_CODES = new Set(['42P07', '42701', '42710', '42723']);

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();

    const files = fs.readdirSync(path.join(process.cwd(), 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRes = await client.query('SELECT filename FROM _migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    const pending = files.filter((f) => !applied.has(f));
    console.log(`Migraciones pendientes por reconciliar: ${pending.length}`);

    let appliedNow = 0;
    let alreadyApplied = 0;
    let failed = 0;

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(process.cwd(), 'migrations', file), 'utf-8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
        appliedNow++;
        console.log(`✅ Aplicada: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (ALREADY_EXISTS_CODES.has(err.code) || /already exists/i.test(err.message)) {
          await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
          alreadyApplied++;
          console.log(`ℹ️  Ya estaba aplicada (marcada): ${file} — ${err.message}`);
        } else {
          failed++;
          console.log(`❌ Falló: ${file}`);
          console.log(`   ${err.message}`);
        }
      }
    }

    console.log('\n=== Resumen ===');
    console.log(`Aplicadas ahora: ${appliedNow}`);
    console.log(`Marcadas como ya aplicadas: ${alreadyApplied}`);
    console.log(`Fallidas (no marcadas): ${failed}`);
  } catch (err) {
    console.error('Error fatal:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
