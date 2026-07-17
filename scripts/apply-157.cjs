require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/157_third_parties_relational.sql', 'utf8'));
  console.log('✅ Migration 157 aplicada — third_party_id en inspection_damages + migración JSON a tabla');

  const r = await c.query("SELECT count(*) as total FROM third_parties");
  console.log(`📊 Terceros en tabla: ${r.rows[0].total}`);

  const r2 = await c.query("SELECT count(*) as total, count(third_party_id) as with_party FROM inspection_damages");
  console.log(`📊 Daños: ${r2.rows[0].total} total, ${r2.rows[0].with_party} con tercero asociado`);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
