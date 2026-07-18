require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/169_country_reference_date.sql', 'utf8'));
  console.log('✅ Migration 169 aplicada — reference_date_type en countries');

  const r = await c.query('SELECT code, name, reference_date_type FROM countries ORDER BY name');
  r.rows.forEach(x => console.log(`  ${x.code}: ${x.name} → ${x.reference_date_type}`));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
