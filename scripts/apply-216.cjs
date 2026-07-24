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

    const sql = fs.readFileSync('migrations/216_company_tables_rls.sql', 'utf8');
    console.log('⏳ Aplicando migración 216...\n');
    await client.query(sql);
    console.log('✅ Migración 216 aplicada\n');

    const res = await client.query(`
      SELECT tablename, COUNT(*)::int as policies
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          SELECT c.table_name
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.column_name = 'company_id'
        )
      GROUP BY tablename
      ORDER BY tablename;
    `);

    console.log('=== Tablas con company_id y cantidad de políticas ===');
    res.rows.forEach((r) => {
      console.log(`  ${r.tablename}: ${r.policies}`);
    });
  } catch (err) {
    console.error('\n❌ Error aplicando migración 216:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
