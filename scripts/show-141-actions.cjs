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
    const claimRes = await client.query(
      'SELECT id FROM claims WHERE liquidation_number = $1',
      ['L-000000141']
    );
    const claimId = claimRes.rows[0]?.id;
    if (!claimId) return;
    const actions = await client.query(
      `SELECT ca.id, at.code, at.name, lc.code AS status_code, ca.is_active, ca.issued_on, ca.created_on
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       JOIN lookup_catalog lc ON lc.id = ca.action_status_id
       WHERE ca.claim_id = $1
       ORDER BY at.code, ca.created_on`,
      [claimId]
    );
    console.log(`Total: ${actions.rowCount}`);
    for (const r of actions.rows) {
      console.log(`- ${r.code} | ${r.status_code} | active=${r.is_active} | created=${r.created_on} | issued=${r.issued_on} | ${r.id}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
