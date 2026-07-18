require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/167_currency_system.sql', 'utf8'));
  console.log('✅ Migration 167 aplicada — sistema de monedas y tipos de cambio');

  const r1 = await c.query('SELECT count(*) as n FROM currencies');
  console.log('Monedas:', r1.rows[0].n);
  const r2 = await c.query('SELECT count(*) as n FROM country_currencies');
  console.log('Relaciones país-monedas:', r2.rows[0].n);
  const r3 = await c.query('SELECT count(*) as n FROM exchange_rates');
  console.log('Tipos de cambio:', r3.rows[0].n);

  const r4 = await c.query(`
    SELECT cu.name as pais, cc.currency_code, cc.is_base
    FROM country_currencies cc
    JOIN countries cu ON cu.id = cc.country_id
    ORDER BY cu.name, cc.sort_order
  `);
  console.log('\nRelaciones:');
  r4.rows.forEach(r => console.log(`  ${r.pais}: ${r.currency_code} ${r.is_base ? '(base)' : ''}`));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
