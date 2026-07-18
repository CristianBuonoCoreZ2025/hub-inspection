require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/162_claim_action_file_seq.sql', 'utf8'));
  console.log('✅ Migration 162 aplicada — claim_action_file_seq + next_file_seq()');

  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'claim_action_file_seq'");
  console.log('Tabla creada:', r.rows);

  const r2 = await c.query("SELECT proname FROM pg_proc WHERE proname = 'next_file_seq'");
  console.log('Funcion creada:', r2.rows);

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
