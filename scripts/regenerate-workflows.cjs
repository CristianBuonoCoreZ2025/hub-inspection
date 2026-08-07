require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL no configurada');
  process.exit(1);
}

const LIQUIDATION_L141 = 'L-000000141';

const STEPS = [
  { code: 'COB', level: 1, depends: null },
  { code: 'AVI', level: 1, depends: null },
  { code: 'CIN', level: 1, depends: null },
  { code: 'SOL', level: 1, depends: null },
  { code: 'RES', level: 2, depends: 'COB' },
  { code: 'INS', level: 2, depends: 'CIN' },
  { code: 'RTA', level: 2, depends: 'SOL' },
  { code: 'AJU', level: 3, depends: 'RES' },
];

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    const adjustmentRes = await client.query(
      "SELECT id FROM lookup_catalog WHERE category = 'claim_status' AND code = 'adjustment' LIMIT 1"
    );
    const adjustmentStatusId = adjustmentRes.rows[0]?.id;
    if (!adjustmentStatusId) {
      throw new Error('No se encontro el estado adjustment');
    }

    const onlineWfRes = await client.query(
      "SELECT country_id, event_id, business_line_id, claim_status_id FROM workflow_configs WHERE status = 'online' LIMIT 1"
    );
    const onlineWf = onlineWfRes.rows[0];
    if (!onlineWf) {
      throw new Error('No hay workflow online de referencia');
    }

    const missingLinesRes = await client.query(
      `SELECT DISTINCT cl.business_line_id
       FROM claims cl
       LEFT JOIN claim_actions ca ON ca.claim_id = cl.id AND ca.is_active = true
       WHERE ca.id IS NULL
         AND cl.status_id = $1`,
      [adjustmentStatusId]
    );
    const missingLines = missingLinesRes.rows.map((r) => r.business_line_id);

    const templatesByLine = {};
    const codeList = STEPS.map((s) => s.code);
    for (const lineId of missingLines) {
      const templateRes = await client.query(
        `SELECT DISTINCT ON (code) id, code
         FROM action_template
         WHERE code = ANY($1::text[])
           AND is_active = true
           AND line_business_id = $2
         ORDER BY code, created_at DESC`,
        [codeList, lineId]
      );
      const map = Object.fromEntries(templateRes.rows.map((r) => [r.code, r.id]));
      const missingCodes = STEPS.filter((s) => !map[s.code]);
      if (missingCodes.length > 0) {
        throw new Error(`Plantillas no encontradas para linea ${lineId}: ${missingCodes.map((s) => s.code).join(', ')}`);
      }
      templatesByLine[lineId] = map;
    }

    for (const lineId of missingLines) {
      const existingWfRes = await client.query(
        `SELECT id FROM workflow_configs
         WHERE country_id = $1
           AND business_line_id = $2
           AND event_id = $3
           AND claim_status_id = $4`,
        [onlineWf.country_id, lineId, onlineWf.event_id, adjustmentStatusId]
      );

      let workflowConfigId;
      if (existingWfRes.rows.length > 0) {
        workflowConfigId = existingWfRes.rows[0].id;
        await client.query(
          "UPDATE workflow_configs SET status = 'online', is_active = true, updated_at = now() WHERE id = $1",
          [workflowConfigId]
        );
        await client.query('DELETE FROM workflow_steps WHERE workflow_config_id = $1', [workflowConfigId]);
      } else {
        const insertWfRes = await client.query(
          `INSERT INTO workflow_configs
            (country_id, business_line_id, event_id, claim_status_id, is_active, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, 'online', now(), now())
           RETURNING id`,
          [onlineWf.country_id, lineId, onlineWf.event_id, adjustmentStatusId]
        );
        workflowConfigId = insertWfRes.rows[0].id;
      }

      const map = templatesByLine[lineId];
      for (let i = 0; i < STEPS.length; i++) {
        const s = STEPS[i];
        await client.query(
          `INSERT INTO workflow_steps
            (workflow_config_id, action_template_id, level, sort_order,
             is_automatic, is_required, depends_on_template_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, true, $5, now(), now())`,
          [
            workflowConfigId,
            map[s.code],
            s.level,
            (i + 1) * 10,
            s.depends ? map[s.depends] : null,
          ]
        );
      }
      console.log(`Workflow online creado/actualizado para linea ${lineId}: ${workflowConfigId}`);
    }

    const l141Res = await client.query(
      'SELECT id, status_id, business_line_id FROM claims WHERE liquidation_number = $1',
      [LIQUIDATION_L141]
    );
    const l141 = l141Res.rows[0];
    if (l141 && l141.status_id !== adjustmentStatusId) {
      await client.query(
        'UPDATE claims SET status_id = $1, updated_at = now() WHERE id = $2',
        [adjustmentStatusId, l141.id]
      );
      console.log('L141 movido a adjustment');
    }

    const claimsRes = await client.query(
      'SELECT id, liquidation_number FROM claims ORDER BY liquidation_number'
    );

    let totalCreated = 0;
    for (const claim of claimsRes.rows) {
      const res = await client.query(
        'SELECT action_template_id, name, created FROM sync_workflow_for_claim($1)',
        [claim.id]
      );
      const created = res.rows.filter((r) => r.created);
      totalCreated += created.length;
      if (created.length > 0) {
        const names = created.map((r) => r.name).join(', ');
        console.log(`${claim.liquidation_number}: +${created.length} (${names})`);
      }
    }

    await client.query('COMMIT');
    console.log(`\nTotal gestiones creadas: ${totalCreated}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
