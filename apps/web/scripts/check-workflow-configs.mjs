import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Triggers en claims
  const triggers = await client.query(`
    SELECT tgname, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgrelid = 'claims'::regclass AND NOT tgisinternal
    ORDER BY tgname
  `);
  console.log("=== Triggers en claims ===");
  triggers.rows.forEach(t => console.log(`  ${t.tgname}: ${t.def}`));

  // Workflow configs para adjustment
  const configs = await client.query(`
    SELECT id, status, business_line_id, country_id, event_id
    FROM workflow_configs
    WHERE claim_status_id = '10088b7e-6f51-4c84-8cdd-42c64b2140af'
  `);
  console.log(`\n=== Workflow configs para adjustment (${configs.rows.length}) ===`);
  configs.rows.forEach(c => console.log(`  id=${c.id} status=${c.status} bl=${c.business_line_id} country=${c.country_id} event=${c.event_id}`));

  // Business line / country / event de los 126 claims
  const claimInfo = await client.query(`
    SELECT c.business_line_id, c.country_id, c.event_id, count(*) AS total
    FROM claims c
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'created'
    GROUP BY c.business_line_id, c.country_id, c.event_id
    ORDER BY total DESC
  `);
  console.log("\n=== Business line / country / event de claims created ===");
  claimInfo.rows.forEach(r => console.log(`  bl=${r.business_line_id} country=${r.country_id} event=${r.event_id}: ${r.total} claims`));

  // Steps automáticos nivel 1 para cada config
  for (const c of configs.rows) {
    const steps = await client.query(`
      SELECT ws.sort_order, at.name, at.code
      FROM workflow_steps ws
      JOIN action_template at ON at.id = ws.action_template_id
      WHERE ws.workflow_config_id = $1
        AND ws.level = 1 AND ws.is_automatic = true AND ws.depends_on_template_id IS NULL
      ORDER BY ws.sort_order
    `, [c.id]);
    console.log(`\n=== Steps config ${c.id} (bl=${c.business_line_id}) ===`);
    steps.rows.forEach(s => console.log(`  ${s.sort_order}. ${s.name} (${s.code})`));
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
