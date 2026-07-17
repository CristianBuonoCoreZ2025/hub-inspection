require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/158_field_config_catalogs.sql', 'utf8'));
  console.log('✅ Migration 158 aplicada — field_config en catálogos');

  const r1 = await c.query("SELECT name, field_config FROM property_classifications WHERE is_active = true ORDER BY name");
  console.log('\n📊 property_classifications:');
  r1.rows.forEach((r) => {
    const cfg = r.field_config || {};
    const show = cfg.show || [];
    const hide = cfg.hide || [];
    const labels = cfg.labels || {};
    console.log(`  ${r.name}: show=[${show.join(',')}] hide=[${hide.join(',')}] labels=${Object.keys(labels).length}`);
  });

  const r2 = await c.query("SELECT name, field_config FROM housing_destinations WHERE is_active = true ORDER BY name");
  console.log('\n📊 housing_destinations:');
  r2.rows.forEach((r) => {
    const cfg = r.field_config || {};
    const show = cfg.show || [];
    const hide = cfg.hide || [];
    const labels = cfg.labels || {};
    console.log(`  ${r.name}: show=[${show.join(',')}] hide=[${hide.join(',')}] labels=${Object.keys(labels).length}`);
  });

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
