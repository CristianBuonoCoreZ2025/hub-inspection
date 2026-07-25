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

    const cinRes = await client.query(
      `SELECT ca.id, ca.action_data, ca.issued_on, ca.issued_by, lc.code AS status_code
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       JOIN lookup_catalog lc ON lc.id = ca.action_status_id
       WHERE ca.claim_id = $1 AND at.code = 'CIN'`,
      [claimId]
    );
    console.log('CIN actions:', cinRes.rowCount);
    for (const r of cinRes.rows) {
      console.log(`- id=${r.id} status=${r.status_code} issued_on=${r.issued_on}`);
      console.log(`  action_data:`, JSON.stringify(r.action_data, null, 2));
    }

    const sessions = await client.query(
      'SELECT id, inspection_number, status, claim_action_id, scheduled_at FROM inspection_sessions WHERE claim_id = $1',
      [claimId]
    );
    console.log('\nInspection sessions:', sessions.rowCount);
    for (const s of sessions.rows) {
      console.log(`- ${s.id} | ${s.inspection_number} | status=${s.status} | action=${s.claim_action_id} | scheduled=${s.scheduled_at}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
