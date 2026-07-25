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

    // Workflow config que usamos para L141
    const wfRes = await client.query(
      `SELECT id, country_id, business_line_id, event_id, claim_status_id, status
       FROM workflow_configs
       WHERE id = 'b3a749b2-fb42-4508-ad75-7530f0f8296f'`
    );
    console.log('Workflow config L141:');
    console.table(wfRes.rows);

    if (wfRes.rows.length > 0) {
      const wf = wfRes.rows[0];
      const templates = await client.query(
        `SELECT id, code, name, line_business_id, event_id, country_id, company_id
         FROM action_template
         WHERE (country_id = $1 OR country_id IS NULL)
           AND (line_business_id = $2 OR line_business_id IS NULL)
           AND (event_id = $3 OR event_id IS NULL)
           AND (company_id = $4 OR company_id IS NULL)
         ORDER BY code`,
        [wf.country_id, wf.business_line_id, wf.event_id, null]
      );
      console.log('\nPlantillas candidatas:');
      console.table(templates.rows);

      const depCols = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='action_template_dependencies' ORDER BY ordinal_position"
      );
      console.log('\nColumnas de action_template_dependencies:');
      console.log(depCols.rows.map((r) => r.column_name).join(', '));

      const deps = await client.query(
        `SELECT parent_code, child_code, condition_field, condition_value
         FROM action_template_dependencies
         ORDER BY parent_code, child_code`
      );
      console.log('\nDependencias:');
      console.table(deps.rows);
    }

    const stepCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='workflow_steps' ORDER BY ordinal_position"
    );
    console.log('\nColumnas de workflow_steps:');
    console.log(stepCols.rows.map((r) => r.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
