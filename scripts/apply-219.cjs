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

    const sql = fs.readFileSync('migrations/219_enforce_inspection_session_links.sql', 'utf8');
    console.log('⏳ Aplicando migración 219...\n');
    await client.query(sql);
    console.log('✅ Migración 219 aplicada\n');

    const res = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM inspection_sessions WHERE claim_action_id IS NULL) AS orphan_sessions,
        (SELECT COUNT(*)::int FROM inspection_sessions) AS total_sessions;
    `);
    console.log('=== Resultado ===');
    console.log(`  Sesiones huérfanas: ${res.rows[0].orphan_sessions}`);
    console.log(`  Total sesiones:     ${res.rows[0].total_sessions}`);
  } catch (err) {
    console.error('\n❌ Error aplicando migración 219:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
