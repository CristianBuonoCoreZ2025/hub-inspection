require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT trigger_name, event_object_table, event_manipulation, action_timing, action_statement
       FROM information_schema.triggers
       WHERE event_object_table IN ('claims','claim_actions')
       ORDER BY event_object_table, trigger_name`
    );
    console.table(res.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
