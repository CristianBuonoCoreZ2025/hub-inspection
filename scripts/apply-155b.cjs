require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/155_inspector_id_and_magic_link.sql', 'utf8'));
  console.log('✅ Migration 155 reaplicada');
  const r = await c.query("UPDATE inspection_sessions SET status='scheduled' WHERE status='pending'");
  console.log(`✅ ${r.rowCount} sesiones actualizadas a scheduled`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
