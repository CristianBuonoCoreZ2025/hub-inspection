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

    const sql = fs.readFileSync('migrations/217_child_tables_rls.sql', 'utf8');
    console.log('⏳ Aplicando migración 217...\n');
    await client.query(sql);
    console.log('✅ Migración 217 aplicada\n');

    const res = await client.query(`
      SELECT tablename, COUNT(*)::int as policies
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY tablename;
    `);

    console.log('=== Políticas por tabla ===');
    res.rows.forEach((r) => {
      console.log(`  ${r.tablename}: ${r.policies}`);
    });
  } catch (err) {
    console.error('\n❌ Error aplicando migración 217:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
