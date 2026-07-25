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

    const sql = fs.readFileSync('migrations/227_profiles_internal_see_all.sql', 'utf8');
    console.log('⏳ Aplicando migración 227...\n');
    await client.query(sql);
    console.log('✅ Migración 227 aplicada\n');
  } catch (err) {
    console.error('\n❌ Error aplicando migración 227:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
