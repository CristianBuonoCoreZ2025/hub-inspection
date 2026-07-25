require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurada en .env.local');
  process.exit(1);
}

const LIQUIDATION = 'L-000000141';

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
      'SELECT id, liquidation_number, country_id, business_line_id, event_id, status_id FROM claims WHERE liquidation_number = $1',
      [LIQUIDATION]
    );

    if (claimRes.rows.length === 0) {
      console.log(`No se encontró siniestro con liquidation_number = ${LIQUIDATION}`);
      await client.query('ROLLBACK');
      return;
    }

    const claim = claimRes.rows[0];
    console.log(`Siniestro: ${claim.id} (${claim.liquidation_number})`);

    const actionsRes = await client.query(
      `SELECT ca.id, at.code, at.name, ca.is_automatic
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       WHERE ca.claim_id = $1
       ORDER BY ca.created_on`,
      [claim.id]
    );

    console.log(`\nGestiones a eliminar: ${actionsRes.rowCount}`);
    for (const row of actionsRes.rows) {
      console.log(`- ${row.code}: ${row.name} (id=${row.id}, auto=${row.is_automatic})`);
    }

    const delRes = await client.query(
      'DELETE FROM claim_actions WHERE claim_id = $1',
      [claim.id]
    );
    console.log(`\n✅ Eliminadas ${delRes.rowCount} gestiones.`);

    // Dejar el workflow de partida en blanco
    const wfRes = await client.query(
      `SELECT id, status
       FROM workflow_configs
       WHERE country_id = $1
         AND business_line_id = $2
         AND event_id = $3
         AND claim_status_id = $4`,
      [claim.country_id, claim.business_line_id, claim.event_id, claim.status_id]
    );

    if (wfRes.rows.length === 0) {
      console.log('No se encontró workflow de partida para este siniestro.');
    } else {
      for (const wf of wfRes.rows) {
        const stepsRes = await client.query(
          'DELETE FROM workflow_steps WHERE workflow_config_id = $1 RETURNING id',
          [wf.id]
        );
        await client.query(
          "UPDATE workflow_configs SET status = 'draft', updated_at = now() WHERE id = $1",
          [wf.id]
        );
        console.log(`✅ Workflow ${wf.id} dejado en blanco (${stepsRes.rowCount} pasos eliminados, status=draft).`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Commit realizado.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
