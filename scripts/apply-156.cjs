require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/156_fix_inspector_fallback.sql', 'utf8'));
  console.log('✅ Migration 156 aplicada — inspector_id fallback a claim.inspector_id');

  // Verificar cuántas sesiones tienen inspector_id ahora
  const r = await c.query("SELECT count(*) as total, count(inspector_id) as with_inspector FROM inspection_sessions");
  console.log(`📊 Sesiones: ${r.rows[0].total} total, ${r.rows[0].with_inspector} con inspector asignado`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
