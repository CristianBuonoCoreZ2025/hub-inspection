require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '150_snapshot_parent_data.sql'), 'utf8');
  await c.query(sql);
  console.log('✅ Migración 150 ejecutada correctamente');
  await c.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
