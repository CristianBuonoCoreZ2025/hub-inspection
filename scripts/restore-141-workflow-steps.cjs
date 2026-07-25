require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

const CODES = ['COB', 'AVI', 'CIN', 'SOL', 'RES', 'INS', 'RTA', 'AJU'];

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
      'SELECT id, country_id, business_line_id, event_id, status_id FROM claims WHERE liquidation_number = $1',
      ['L-000000141']
    );
    if (claimRes.rows.length === 0) throw new Error('Siniestro no encontrado');
    const claim = claimRes.rows[0];

    const wfRes = await client.query(
      `SELECT id FROM workflow_configs
       WHERE country_id = $1 AND business_line_id = $2 AND event_id = $3 AND claim_status_id = $4`,
      [claim.country_id, claim.business_line_id, claim.event_id, claim.status_id]
    );
    if (wfRes.rows.length === 0) throw new Error('Workflow config no encontrado');
    const workflowConfigId = wfRes.rows[0].id;
    console.log('Workflow config:', workflowConfigId);

    // Elegir la plantilla más específica para cada código
    const templateRes = await client.query(
      `SELECT DISTINCT ON (code) id, code
       FROM action_template
       WHERE code = ANY($1::text[])
         AND is_active = true
         AND (country_id = $2 OR country_id IS NULL)
         AND (line_business_id = $3 OR line_business_id IS NULL)
         AND (event_id = $4 OR event_id IS NULL)
         AND (company_id = $5 OR company_id IS NULL)
       ORDER BY code,
                (line_business_id IS NOT NULL) DESC,
                (event_id IS NOT NULL) DESC,
                (country_id IS NOT NULL) DESC,
                (company_id IS NOT NULL) DESC,
                created_at DESC`,
      [CODES, claim.country_id, claim.business_line_id, claim.event_id, claim.company_id]
    );
    const templates = Object.fromEntries(templateRes.rows.map((r) => [r.code, r.id]));
    const missing = CODES.filter((c) => !templates[c]);
    if (missing.length > 0) throw new Error(`Plantillas no encontradas: ${missing.join(', ')}`);
    console.log('Plantillas seleccionadas:', templates);

    // Refrescar workflow_steps
    await client.query('DELETE FROM workflow_steps WHERE workflow_config_id = $1', [workflowConfigId]);
    const steps = [
      { code: 'COB', level: 1, depends: null },
      { code: 'AVI', level: 1, depends: null },
      { code: 'CIN', level: 1, depends: null },
      { code: 'SOL', level: 1, depends: null },
      { code: 'RES', level: 2, depends: 'COB' },
      { code: 'INS', level: 2, depends: 'CIN' },
      { code: 'RTA', level: 2, depends: 'SOL' },
      { code: 'AJU', level: 3, depends: 'RES' },
    ];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await client.query(
        `INSERT INTO workflow_steps (
          workflow_config_id, action_template_id, level, sort_order,
          is_automatic, is_required, depends_on_template_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, true, $5, now(), now())`,
        [
          workflowConfigId,
          templates[s.code],
          s.level,
          (i + 1) * 10,
          s.depends ? templates[s.depends] : null,
        ]
      );
    }
    console.log('Workflow_steps actualizados.');

    // Borrar acciones creadas con plantillas incorrectas (los duplicados)
    const selectedIds = Object.values(templates);
    const delActions = await client.query(
      `DELETE FROM claim_actions
       WHERE claim_id = $1
         AND action_template_id NOT IN (SELECT unnest($2::uuid[]))
       RETURNING id, action_template_id`,
      [claim.id, selectedIds]
    );
    console.log(`Acciones duplicadas/erróneas eliminadas: ${delActions.rowCount}`);

    // Resetear CIN a todo por si quedó issued
    await client.query(
      `UPDATE claim_actions
       SET action_status_id = (SELECT id FROM lookup_catalog WHERE category='action_status' AND code='todo' LIMIT 1),
           issued_on = NULL, issued_by = NULL, updated_on = now(), updated_by = NULL
       WHERE claim_id = $1 AND action_template_id = $2`,
      [claim.id, templates['CIN']]
    );

    await client.query('COMMIT');
    console.log('✅ Workflow corregido para L-141.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
