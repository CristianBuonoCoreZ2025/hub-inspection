require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function m() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'inspection_evidences' ORDER BY ordinal_position");
  r.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '|', r.is_nullable, '|', r.column_default));
  await c.end();
}
m().catch(e => { console.error(e.message); process.exit(1); });
