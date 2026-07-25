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
    const res = await client.query(
      `SELECT wc.id AS workflow_config_id, ws.id AS step_id, at.code, at.id AS template_id,
              wc.country_id AS wc_country, wc.business_line_id AS wc_line, wc.event_id AS wc_event,
              at.country_id AS at_country, at.line_business_id AS at_line, at.event_id AS at_event
       FROM workflow_steps ws
       JOIN workflow_configs wc ON wc.id = ws.workflow_config_id
       JOIN action_template at ON at.id = ws.action_template_id
       WHERE (at.country_id IS NOT NULL AND at.country_id <> wc.country_id)
          OR (at.line_business_id IS NOT NULL AND at.line_business_id <> wc.business_line_id)
          OR (at.event_id IS NOT NULL AND at.event_id <> wc.event_id)`
    );
    console.log(`Workflow steps con plantillas incompatibles: ${res.rowCount}`);
    for (const r of res.rows) {
      console.log(`workflow=${r.workflow_config_id} step=${r.step_id} code=${r.code} template=${r.template_id}`);
      console.log(`  config: country=${r.wc_country} line=${r.wc_line} event=${r.wc_event}`);
      console.log(`  template: country=${r.at_country} line=${r.at_line} event=${r.at_event}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
