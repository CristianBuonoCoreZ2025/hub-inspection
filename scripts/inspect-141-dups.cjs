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
    const all = await client.query(
      'SELECT id, action_template_id, created_on FROM claim_actions WHERE claim_id = $1 ORDER BY action_template_id, created_on',
      [claimId]
    );
    const keep = await client.query(
      `SELECT id, action_template_id, created_on FROM (
        SELECT DISTINCT ON (action_template_id) id, action_template_id, created_on
        FROM claim_actions
        WHERE claim_id = $1 AND is_active = true
        ORDER BY action_template_id, created_on
      ) keep ORDER BY action_template_id`,
      [claimId]
    );
    console.log('All:');
    console.table(all.rows);
    console.log('Keep:');
    console.table(keep.rows);
    const del = await client.query(
      `SELECT id, action_template_id, created_on FROM claim_actions
       WHERE claim_id = $1 AND id NOT IN (
         SELECT id FROM (
           SELECT DISTINCT ON (action_template_id) id
           FROM claim_actions
           WHERE claim_id = $1 AND is_active = true
           ORDER BY action_template_id, created_on
         ) keep
       )`,
      [claimId]
    );
    console.log('To delete:');
    console.table(del.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
