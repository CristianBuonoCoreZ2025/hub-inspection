require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING });
(async () => {
  await c.connect();
  const sql = fs.readFileSync('migrations/180_claim_action_documents.sql', 'utf8');
  await c.query(sql);
  console.log('✓ Migración 180 ejecutada');
  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
