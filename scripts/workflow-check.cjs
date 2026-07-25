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
    console.log('=== Revisión de planes/workflows ===\n');

    const onlineNoSteps = await client.query(
      `SELECT wc.id FROM workflow_configs wc
       LEFT JOIN workflow_steps ws ON ws.workflow_config_id = wc.id
       WHERE wc.status = 'online' AND ws.id IS NULL`
    );
    console.log(`Workflows online sin pasos: ${onlineNoSteps.rowCount}`);

    const multiOnline = await client.query(
      `SELECT country_id, business_line_id, event_id, claim_status_id, COUNT(*) AS cnt
       FROM workflow_configs
       WHERE status = 'online'
       GROUP BY country_id, business_line_id, event_id, claim_status_id
       HAVING COUNT(*) > 1`
    );
    console.log(`Workflows online duplicados por contexto: ${multiOnline.rowCount}`);

    const badSteps = await client.query(
      `SELECT ws.id, ws.workflow_config_id, at.id AS template_id, at.code
       FROM workflow_steps ws
       LEFT JOIN action_template at ON at.id = ws.action_template_id
       WHERE at.id IS NULL OR at.is_active = false`
    );
    console.log(`Workflow steps sin plantilla válida: ${badSteps.rowCount}`);

    const mismatched = await client.query(
      `SELECT ws.id AS step_id, wc.id AS workflow_id, at.code,
              wc.country_id AS wc_country, wc.business_line_id AS wc_line, wc.event_id AS wc_event,
              at.country_id AS at_country, at.line_business_id AS at_line, at.event_id AS at_event
       FROM workflow_steps ws
       JOIN workflow_configs wc ON wc.id = ws.workflow_config_id
       JOIN action_template at ON at.id = ws.action_template_id
       WHERE (at.country_id IS NOT NULL AND at.country_id <> wc.country_id)
          OR (at.line_business_id IS NOT NULL AND at.line_business_id <> wc.business_line_id)
          OR (at.event_id IS NOT NULL AND at.event_id <> wc.event_id)`
    );
    console.log(`Workflow steps con plantillas incompatibles: ${mismatched.rowCount}`);

    const orphanDeps = await client.query(
      `SELECT d.parent_code, d.child_code
       FROM action_template_dependencies d
       LEFT JOIN action_template pt ON pt.code = d.parent_code
       LEFT JOIN action_template ct ON ct.code = d.child_code
       WHERE pt.id IS NULL OR ct.id IS NULL`
    );
    console.log(`Dependencias con códigos huérfanos: ${orphanDeps.rowCount}`);

    const triggers = await client.query(
      `SELECT trigger_name, event_object_table FROM information_schema.triggers
       WHERE trigger_name IN ('trg_execute_workflow','trg_cascade_workflow','trg_auto_create_inspection_session')`
    );
    console.log(`\nTriggers críticos presentes: ${triggers.rowCount}/3`);
    for (const t of triggers.rows) console.log(` - ${t.trigger_name} on ${t.event_object_table}`);

    if (
      onlineNoSteps.rowCount === 0 &&
      multiOnline.rowCount === 0 &&
      badSteps.rowCount === 0 &&
      mismatched.rowCount === 0 &&
      orphanDeps.rowCount === 0 &&
      triggers.rowCount === 3
    ) {
      console.log('\n✅ Todos los planes/workflows están de acuerdo al plan.');
    } else {
      console.log('\n⚠️ Hay discrepancias que revisar.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
