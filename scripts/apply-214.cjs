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

    const sql = fs.readFileSync('migrations/214_inspection_sessions_rls_auth_uid.sql', 'utf8');
    console.log('⏳ Aplicando migración 214...\n');
    await client.query(sql);
    console.log('✅ Migración 214 aplicada\n');

    const res = await client.query(`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inspection_sessions'
      ORDER BY policyname;
    `);

    console.log('=== Políticas inspection_sessions ===');
    res.rows.forEach((r) => {
      console.log(`  ${r.policyname} (${r.cmd})`);
    });
  } catch (err) {
    console.error('\n❌ Error aplicando migración 214:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
