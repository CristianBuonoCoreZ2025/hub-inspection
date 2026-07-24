require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

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
    console.log('🔍 Conectado a PostgreSQL\n');

    // 1. Tablas con/sin company_id / tenant_id y estado RLS
    const tablesRes = await client.query(`
      SELECT
        c.relname AS table_name,
        EXISTS (
          SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema = 'public'
            AND ic.table_name = c.relname::text
            AND ic.column_name = 'company_id'
        ) AS has_company_id,
        EXISTS (
          SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema = 'public'
            AND ic.table_name = c.relname::text
            AND ic.column_name = 'tenant_id'
        ) AS has_tenant_id,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);

    console.log('=== Tablas públicas (company_id / tenant_id / RLS) ===');
    console.log(
      `${'Tabla'.padEnd(40)} ${'company_id'.padEnd(12)} ${'tenant_id'.padEnd(12)} ${'RLS'.padEnd(8)} ${'FORCE'.padEnd(8)}`
    );
    console.log('-'.repeat(90));
    tablesRes.rows.forEach((r) => {
      const company = r.has_company_id ? 'SÍ' : 'NO';
      const tenant = r.has_tenant_id ? 'SÍ' : 'NO';
      const rls = r.rls_enabled ? 'ON' : 'OFF';
      const force = r.rls_forced ? 'ON' : 'OFF';
      console.log(
        `${r.table_name.padEnd(40)} ${company.padEnd(12)} ${tenant.padEnd(12)} ${rls.padEnd(8)} ${force.padEnd(8)}`
      );
    });

    // 2. Políticas existentes
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles::text, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log('\n=== Políticas RLS ===');
    if (policiesRes.rows.length === 0) {
      console.log('(no hay políticas configuradas)');
    } else {
      policiesRes.rows.forEach((p) => {
        console.log(
          `${p.tablename.padEnd(35)} ${p.policyname.padEnd(35)} ${p.cmd}`
        );
      });
    }

    // 3. Columnas company_id sin FK (relaciones directas recomendadas)
    const orphanCompanyIdRes = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'company_id'
      ORDER BY tc.table_name;
    `);
    const tablesWithCompanyFK = new Set(orphanCompanyIdRes.rows.map((r) => r.table_name));

    const companyIdColumnsRes = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'company_id'
      ORDER BY table_name;
    `);

    console.log('\n=== Tablas con columna company_id ===');
    companyIdColumnsRes.rows.forEach((r) => {
      const fk = tablesWithCompanyFK.has(r.table_name) ? '(con FK a companies)' : '(SIN FK)';
      console.log(`  ${r.table_name} ${fk}`);
    });

    console.log('\n✅ Auditoría completada.');
  } catch (err) {
    console.error('\n❌ Error de conexión o consulta:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
