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

    const sql = fs.readFileSync('migrations/218_fix_inspection_session_company_id.sql', 'utf8');
    console.log('⏳ Aplicando migración 218...\n');
    await client.query(sql);
    console.log('✅ Migración 218 aplicada: company_id en inspection_sessions desde auto_create_inspection_session\n');

    const res = await client.query(`
      SELECT filename
      FROM _migrations
      WHERE filename = '218_fix_inspection_session_company_id.sql'
      LIMIT 1;
    `);

    if (res.rows.length > 0) {
      console.log('📝 Registrada en _migrations:', res.rows[0].filename);
    }
  } catch (err) {
    console.error('\n❌ Error aplicando migración 218:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
