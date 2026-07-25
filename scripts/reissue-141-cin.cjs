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
      `SELECT ca.id FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       WHERE ca.claim_id = $1 AND at.code = 'CIN' AND ca.issued_on IS NOT NULL`,
      [claimId]
    );
    if (cinRes.rows.length === 0) {
      console.log('No hay CIN emitido');
      return;
    }
    const cinId = cinRes.rows[0].id;
    console.log('Re-emitiendo CIN:', cinId);

    await client.query('BEGIN');
    await client.query('UPDATE claim_actions SET issued_on = NULL WHERE id = $1', [cinId]);
    await client.query('UPDATE claim_actions SET issued_on = now() WHERE id = $1', [cinId]);
    await client.query('COMMIT');

    const actions = await client.query(
      `SELECT at.code, lc.code AS status_code
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       JOIN lookup_catalog lc ON lc.id = ca.action_status_id
       WHERE ca.claim_id = $1`,
      [claimId]
    );
    console.log('Acciones después:', actions.rows);

    const sessions = await client.query(
      'SELECT id, inspection_number, status FROM inspection_sessions WHERE claim_id = $1',
      [claimId]
    );
    console.log('Sessions:', sessions.rows);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
