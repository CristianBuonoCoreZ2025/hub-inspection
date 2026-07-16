require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Buscar todas las columnas que usan el tipo user_role
  const r = await c.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE udt_name = 'user_role'
  `);
  console.log('Columnas que usan user_role:');
  for (const row of r.rows) console.log(`  ${row.table_name}.${row.column_name}`);

  // Buscar funciones que usan user_role
  const r2 = await c.query(`
    SELECT proname, pg_get_function_arguments(oid) as args
    FROM pg_proc
    WHERE proargtypes::text LIKE '%user_role%' OR prorettype = 'user_role'::regtype
  `);
  console.log('\nFunciones que usan user_role:');
  for (const row of r2.rows) console.log(`  ${row.proname}(${row.args})`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
