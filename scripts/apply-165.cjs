require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/165_evidence_geo_columns.sql', 'utf8'));
  console.log('✅ Migration 165 aplicada — columnas lat/lng/exif_lat/exif_lng en inspection_evidences');

  const r = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'inspection_evidences' AND column_name IN ('lat','lng','exif_lat','exif_lng')
    ORDER BY column_name
  `);
  console.log('Columnas nuevas:', r.rows.map(row => `${row.column_name} (${row.data_type})`));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
