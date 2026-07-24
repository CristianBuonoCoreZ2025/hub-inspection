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

    const sql = fs.readFileSync('migrations/220_inspection_magic_link_window.sql', 'utf8');
    console.log('⏳ Aplicando migración 220...\n');
    await client.query(sql);
    console.log('✅ Migración 220 aplicada\n');

    const res = await client.query(
      "SELECT (SELECT COUNT(*)::int FROM inspection_sessions WHERE inspection_type = 'remote') AS remote_sessions, (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='inspection_sessions' AND column_name='magic_link_extended') AS has_extended;"
    );
    console.log('=== Resultado ===');
    console.log(`  Sesiones remotas: ${res.rows[0].remote_sessions}`);
    console.log(`  Columna magic_link_extended: ${res.rows[0].has_extended ? 'sí' : 'no'}`);
  } catch (err) {
    console.error('\n❌ Error aplicando migración 220:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
