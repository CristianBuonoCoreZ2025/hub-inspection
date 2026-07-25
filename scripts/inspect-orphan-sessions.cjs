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
    const r = await client.query(
      `SELECT s.id, s.inspection_number, s.status, s.claim_id, c.liquidation_number
       FROM inspection_sessions s
       LEFT JOIN claims c ON c.id = s.claim_id
       WHERE s.claim_action_id IS NULL OR s.claim_id IS NULL
       ORDER BY c.liquidation_number, s.created_at`
    );
    console.log(`Sesiones huérfanas: ${r.rowCount}`);
    for (const row of r.rows) {
      console.log(`- ${row.id} | ${row.inspection_number} | status=${row.status} | claim=${row.claim_id} | liq=${row.liquidation_number}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
