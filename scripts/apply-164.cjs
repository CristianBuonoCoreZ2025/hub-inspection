require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/164_add_cro_file_type.sql', 'utf8'));
  console.log('✅ Migration 164 aplicada — tipo CRO agregado a claim_action_file_seq');

  const r = await c.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'claim_action_file_seq' AND con.contype = 'c'
  `);
  console.log('CHECK constraint:', r.rows);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
