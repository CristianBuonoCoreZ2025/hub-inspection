require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/166_damage_currency.sql', 'utf8'));
  console.log('✅ Migration 166 aplicada — columna currency en inspection_damages');
  const r = await c.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'inspection_damages' AND column_name = 'currency'
  `);
  console.log('Columna nueva:', r.rows[0]);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
