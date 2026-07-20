require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING });
(async () => {
  await c.connect();
  const r1 = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%document%' ORDER BY table_name");
  console.log('Tables:', r1.rows.map(r => r.table_name));
  const r2 = await c.query("SELECT document_type_code, document_name FROM document_requirements WHERE is_active=true ORDER BY document_name LIMIT 20");
  console.table(r2.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
