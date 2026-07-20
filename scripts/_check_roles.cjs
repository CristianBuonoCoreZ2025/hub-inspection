require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING });
(async () => {
  await c.connect();
  // Buscar tablas relacionadas con roles
  const r = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND (table_name LIKE '%role%' OR table_name LIKE '%user%')
    ORDER BY table_name
  `);
  console.log('Tablas relacionadas con roles/usuarios:');
  for (const row of r.rows) console.log('  ' + row.table_name);

  // Ver columnas de user_roles si existe
  try {
    const cols = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_roles' ORDER BY ordinal_position
    `);
    if (cols.rows.length > 0) {
      console.log('\nuser_roles columnas:', cols.rows.map(r => r.column_name).join(', '));
    }
  } catch {}

  // Ver si hay roles tabla
  try {
    const cols2 = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'roles' ORDER BY ordinal_position
    `);
    if (cols2.rows.length > 0) {
      console.log('\nroles columnas:', cols2.rows.map(r => r.column_name).join(', '));
    }
  } catch {}

  // auth.users
  try {
    const cols3 = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' ORDER BY ordinal_position LIMIT 5
    `);
    console.log('\nauth.users existe, primeras columnas:', cols3.rows.map(r => r.column_name).join(', '));
  } catch (e) { console.log('auth.users no accesible:', e.message); }

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
