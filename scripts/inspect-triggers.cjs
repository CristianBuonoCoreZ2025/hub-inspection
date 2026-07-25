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
    const triggers = await client.query(
      `SELECT trigger_name, event_manipulation, action_statement, action_timing
       FROM information_schema.triggers
       WHERE event_object_table = 'claim_actions'
       ORDER BY trigger_name`
    );
    console.log('Triggers on claim_actions:');
    console.table(triggers.rows);

    const deps = await client.query(
      `SELECT parent_code, child_code, condition_field, condition_value
       FROM action_template_dependencies
       WHERE parent_code = 'CIN'`
    );
    console.log('\nDependencies from CIN:');
    console.table(deps.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
