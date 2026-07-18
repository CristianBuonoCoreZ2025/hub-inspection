require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/168_currency_rls.sql', 'utf8'));
  console.log('✅ Migration 168 aplicada — RLS policies para currencies, country_currencies, exchange_rates');

  const r = await c.query(`
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('currencies','country_currencies','exchange_rates')
    ORDER BY tablename, cmd
  `);
  console.log('\nPolíticas creadas:');
  r.rows.forEach(p => console.log(`  ${p.tablename}: ${p.cmd} — ${p.policyname}`));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
