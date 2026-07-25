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

    const sql = fs.readFileSync('migrations/221_email_templates_module.sql', 'utf8');
    console.log('⏳ Aplicando migración 221...\n');
    await client.query(sql);
    console.log('✅ Migración 221 aplicada\n');

    const res = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM email_templates) AS email_templates,
        (SELECT COUNT(*)::int FROM email_logs) AS email_logs,
        (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='action_template' AND column_name='auto_complete') AS has_auto_complete;`
    );
    console.log('=== Resultado ===');
    console.log(`  Plantillas de e-mail: ${res.rows[0].email_templates}`);
    console.log(`  Logs de e-mail: ${res.rows[0].email_logs}`);
    console.log(`  action_template.auto_complete: ${res.rows[0].has_auto_complete ? 'sí' : 'no'}`);
  } catch (err) {
    console.error('\n❌ Error aplicando migración 221:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
