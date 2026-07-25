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
    await client.query('BEGIN');

    const claimRes = await client.query(
      'SELECT id FROM claims WHERE liquidation_number = $1',
      ['L-000000141']
    );
    const claimId = claimRes.rows[0]?.id;
    if (!claimId) throw new Error('Siniestro no encontrado');

    const todoStatus = await client.query(
      "SELECT id FROM lookup_catalog WHERE category='action_status' AND code='todo' LIMIT 1"
    );
    const todoId = todoStatus.rows[0]?.id;

    // Resetear CIN a todo (por si quedó issued)
    const cinTemplate = await client.query(
      "SELECT id FROM action_template WHERE code='CIN' LIMIT 1"
    );
    if (cinTemplate.rows.length > 0) {
      const cinTid = cinTemplate.rows[0].id;
      await client.query(
        `UPDATE claim_actions
         SET action_status_id = $1, issued_on = NULL, issued_by = NULL, updated_on = now(), updated_by = NULL
         WHERE claim_id = $2 AND action_template_id = $3`,
        [todoId, claimId, cinTid]
      );
    }

    // Borrar duplicados: quedarse con el más antiguo por template
    const dupRes = await client.query(
      `DELETE FROM claim_actions
       WHERE claim_id = $1
         AND id NOT IN (
           SELECT id FROM (
             SELECT DISTINCT ON (action_template_id) id
             FROM claim_actions
             WHERE claim_id = $1 AND is_active = true
             ORDER BY action_template_id, created_on
           ) keep
         )
       RETURNING id, action_template_id`,
      [claimId]
    );

    await client.query('COMMIT');
    console.log(`Duplicados eliminados: ${dupRes.rowCount}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
