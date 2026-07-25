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
    if (!claimId) {
      console.log('Siniestro L-000000141 no encontrado');
      return;
    }
    const sessions = await client.query(
      'SELECT id, status, claim_action_id, inspection_number FROM inspection_sessions WHERE claim_id = $1',
      [claimId]
    );
    console.log(`Inspecciones para L-000000141: ${sessions.rowCount}`);
    for (const s of sessions.rows) {
      console.log(`- ${s.id} | ${s.inspection_number} | status=${s.status} | action=${s.claim_action_id}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
