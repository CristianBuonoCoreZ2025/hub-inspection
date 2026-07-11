require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();

  const r = await c.query('SELECT name, code FROM action_features WHERE code IS NOT NULL ORDER BY code');
  console.log('action_features with code:');
  r.rows.forEach((x) => console.log(`  ${x.code} → ${x.name}`));

  const r2 = await c.query('SELECT name, code_prefix FROM business_lines WHERE code_prefix IS NOT NULL ORDER BY code_prefix');
  console.log('\nbusiness_lines with code_prefix:');
  r2.rows.forEach((x) => console.log(`  ${x.code_prefix} → ${x.name}`));

  await c.end();
})();
