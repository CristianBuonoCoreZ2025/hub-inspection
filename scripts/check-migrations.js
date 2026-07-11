require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  // Listar migraciones pendientes
  const executed = await client.query('SELECT filename FROM _migrations ORDER BY filename');
  const executedSet = new Set(executed.rows.map(r => r.filename));
  const files = fs.readdirSync('migrations').filter(f => f.endsWith('.sql')).sort();
  const pending = files.filter(f => !executedSet.has(f));
  console.log('Pending migrations:');
  pending.forEach(f => console.log('  ', f));

  // Verificar qué tablas ya existen
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const tableSet = new Set(tables.rows.map(r => r.tablename));
  console.log('\nExisting tables relevant to pending migrations:');
  ['action_features', 'action_template', 'action_template_claim_status', 'claim_action', 'claim_action_status', 'document_templates'].forEach(t => {
    console.log('  ', t, tableSet.has(t) ? 'EXISTS' : 'MISSING');
  });

  // Verificar si country_id existe en action_template
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'action_template' ORDER BY column_name");
  const colNames = cols.rows.map(r => r.column_name);
  console.log('\naction_template has country_id:', colNames.includes('country_id'));

  // Verificar si document_templates existe
  console.log('document_templates exists:', tableSet.has('document_templates'));

  await client.end();
})();
