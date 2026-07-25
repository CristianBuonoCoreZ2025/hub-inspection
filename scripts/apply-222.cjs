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

    const sql = fs.readFileSync('migrations/222_action_template_auto_fields.sql', 'utf8');
    console.log('⏳ Aplicando migración 222...\n');
    await client.query(sql);
    console.log('✅ Migración 222 aplicada\n');

    const res = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='action_template' AND column_name='auto_email_recipients') AS has_recipients,
        (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='action_template' AND column_name='auto_field_mapping') AS has_field_mapping;`
    );
    console.log('=== Resultado ===');
    console.log(`  auto_email_recipients: ${res.rows[0].has_recipients ? 'sí' : 'no'}`);
    console.log(`  auto_field_mapping: ${res.rows[0].has_field_mapping ? 'sí' : 'no'}`);
  } catch (err) {
    console.error('\n❌ Error aplicando migración 222:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
