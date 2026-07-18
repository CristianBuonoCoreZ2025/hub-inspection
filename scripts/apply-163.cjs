require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(fs.readFileSync('migrations/163_file_sequences.sql', 'utf8'));
  console.log('✅ Migration 163 aplicada — claim_document_seq + policy_document_seq + template_file_seq');

  const r1 = await c.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('claim_document_seq','policy_document_seq','template_file_seq') ORDER BY table_name");
  console.log('Tablas creadas:', r1.rows.map(r => r.table_name));

  const r2 = await c.query("SELECT proname FROM pg_proc WHERE proname IN ('next_claim_doc_seq','next_policy_doc_seq','next_template_seq') ORDER BY proname");
  console.log('Funciones creadas:', r2.rows.map(r => r.proname));

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
