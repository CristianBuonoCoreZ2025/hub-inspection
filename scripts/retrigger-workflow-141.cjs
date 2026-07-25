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

    const claimRes = await client.query(
      'SELECT id, status_id, country_id, business_line_id, event_id FROM claims WHERE liquidation_number = $1',
      [LIQUIDATION]
    );

    if (claimRes.rows.length === 0) {
      console.log('No se encontró siniestro', LIQUIDATION);
      return;
    }

    const claim = claimRes.rows[0];
    const statusRes = await client.query(
      'SELECT id, code, name FROM lookup_catalog WHERE id = $1',
      [claim.status_id]
    );
    const currentStatus = statusRes.rows[0];
    console.log('Siniestro:', claim.id);
    console.log('Estado actual:', currentStatus.code, currentStatus.name);

    const wfRes = await client.query(
      `SELECT claim_status_id
       FROM workflow_configs
       WHERE country_id = $1
         AND business_line_id = $2
         AND event_id = $3
         AND status = 'online'`,
      [claim.country_id, claim.business_line_id, claim.event_id]
    );

    const wfStatuses = wfRes.rows.map((r) => r.claim_status_id);
    console.log('Workflows online para estados:', wfStatuses.length);

    if (wfStatuses.length === 0) {
      console.log('No hay workflow online para este siniestro.');
      return;
    }

    const tempRes = await client.query(
      `SELECT id, code, name
       FROM lookup_catalog
       WHERE category = 'claim_status'
         AND id <> ALL($1::uuid[])
       LIMIT 1`,
      [wfStatuses]
    );

    if (tempRes.rows.length === 0) {
      console.log('No hay un estado temporal sin workflow disponible.');
      return;
    }

    const tempStatus = tempRes.rows[0];
    console.log('Estado temporal:', tempStatus.code, tempStatus.name);

    await client.query('BEGIN');
    console.log('Cambiando a estado temporal...');
    await client.query('UPDATE claims SET status_id = $1 WHERE id = $2', [tempStatus.id, claim.id]);
    console.log('Volviendo al estado original...');
    await client.query('UPDATE claims SET status_id = $1 WHERE id = $2', [claim.status_id, claim.id]);
    await client.query('COMMIT');
    console.log('Workflow re-disparado.');

    const actionsRes = await client.query(
      `SELECT ca.id, at.code, at.name, lca.code AS status_code
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       JOIN lookup_catalog lca ON lca.id = ca.action_status_id
       WHERE ca.claim_id = $1
       ORDER BY ca.created_on`,
      [claim.id]
    );

    console.log(`\nGestiones creadas: ${actionsRes.rowCount}`);
    for (const row of actionsRes.rows) {
      console.log(`- ${row.code}: ${row.name} (${row.status_code})`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
