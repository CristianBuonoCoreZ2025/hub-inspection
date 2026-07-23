require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/198_cin_ins_deep_link.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 198 aplicada");
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
