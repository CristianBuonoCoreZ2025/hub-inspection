require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  const files = fs.readdirSync(path.join(process.cwd(), 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const applied = (await client.query('SELECT filename FROM _migrations')).rows.map((r) => r.filename);
  const pending = files.filter((f) => !applied.includes(f));
  console.log('Archivos en disco:', files.length);
  console.log('Aplicadas registradas:', applied.length);
  console.log('Pendientes:', pending.length);
  if (pending.length) pending.forEach((f) => console.log(` - ${f}`));
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
