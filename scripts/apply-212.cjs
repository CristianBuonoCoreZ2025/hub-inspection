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

    const sql = fs.readFileSync('migrations/212_inspection_sessions_company_id_rls.sql', 'utf8');
    console.log('⏳ Aplicando migración 212...\n');
    await client.query(sql);
    console.log('✅ Migración 212 aplicada\n');

    const total = await client.query('SELECT COUNT(*) AS n FROM inspection_sessions');
    const withCompany = await client.query(
      'SELECT COUNT(*) AS n FROM inspection_sessions WHERE company_id IS NOT NULL'
    );
    const withoutCompany = await client.query(
      'SELECT COUNT(*) AS n FROM inspection_sessions WHERE company_id IS NULL'
    );
    const rls = await client.query(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'inspection_sessions'"
    );

    console.log('=== Verificación ===');
    console.log('Total de sesiones:', total.rows[0].n);
    console.log('Con company_id:', withCompany.rows[0].n);
    console.log('Sin company_id:', withoutCompany.rows[0].n);
    console.log('RLS enabled:', rls.rows[0].relrowsecurity);
    console.log('RLS forced:', rls.rows[0].relforcerowsecurity);
  } catch (err) {
    console.error('\n❌ Error aplicando migración 212:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
