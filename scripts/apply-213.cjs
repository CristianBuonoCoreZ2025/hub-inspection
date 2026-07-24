require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    '❌ Error: DATABASE_URL no está configurada.\n' +
      '   Agrega la connection string en .env.local:\n' +
      '   DATABASE_URL="postgres://user:password@host:port/database"'
  );
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('🔗 Conectado a PostgreSQL\n');

    const sql = fs.readFileSync('migrations/213_fix_company_fks.sql', 'utf8');
    console.log('⏳ Aplicando migración 213...\n');
    await client.query(sql);
    console.log('✅ Migración 213 aplicada\n');

    const res = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS references_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'company_id'
      ORDER BY tc.table_name;
    `);

    console.log('=== FKs de company_id ===');
    res.rows.forEach((r) => {
      console.log(`  ${r.table_name}.${r.column_name} -> ${r.references_table}`);
    });
  } catch (err) {
    console.error('\n❌ Error aplicando migración 213:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
