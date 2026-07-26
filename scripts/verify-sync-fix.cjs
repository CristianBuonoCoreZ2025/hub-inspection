require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await p.connect();
  try {
    // Llamar a sync_workflow_for_claim como haría el endpoint
    const { rows } = await c.query(
      `SELECT * FROM sync_workflow_for_claim('69ac9d90-9b49-4fd2-962c-4f9fa6f501ff')`
    );
    console.log("=== sync_workflow_for_claim result ===");
    for (const r of rows) {
      console.log(`  template=${r.action_template_id} name=${r.name} created=${r.created}`);
    }
    if (rows.length === 0) console.log("  (sin resultados — no creó nada)");

    // Verificar que no se creó HCIN-005 de nuevo
    const { rows: hcin } = await c.query(
      `SELECT code FROM claim_actions
       WHERE claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
         AND code ILIKE '%HCIN%'
       ORDER BY code`
    );
    console.log("\n=== HCIN después del sync ===");
    for (const r of hcin) console.log(`  ${r.code}`);
  } finally { c.release(); await p.end(); }
})();
