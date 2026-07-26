require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await p.connect();
  try {
    // Verificar HCIN-005 antes de borrar
    const { rows: before } = await c.query(
      `SELECT id, code, action_status_id, action_data, created_on
       FROM claim_actions
       WHERE claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
         AND code = 'L-000000141-HCIN-005'`
    );
    console.log("=== HCIN-005 antes de borrar ===");
    for (const r of before) console.log(`  id=${r.id} code=${r.code} data=${JSON.stringify(r.action_data)} created=${r.created_on}`);

    if (before.length === 0) {
      console.log("HCIN-005 no encontrada, no se borra nada.");
      return;
    }

    // Verificar que no tenga sesión asociada
    const { rows: sessions } = await c.query(
      `SELECT id FROM inspection_sessions WHERE claim_action_id = $1`,
      [before[0].id]
    );
    console.log(`  sesiones asociadas: ${sessions.length}`);

    if (sessions.length > 0) {
      console.log("HCIN-005 tiene sesión asociada, NO se borra.");
      return;
    }

    // Borrar
    const { rowCount } = await c.query(
      `DELETE FROM claim_actions WHERE id = $1`,
      [before[0].id]
    );
    console.log(`\n✅ HCIN-005 eliminada (${rowCount} fila)`);

    // Verificar
    const { rows: after } = await c.query(
      `SELECT code FROM claim_actions
       WHERE claim_id = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff'
         AND code ILIKE '%HCIN%'
       ORDER BY code`
    );
    console.log("\n=== HCIN restantes ===");
    for (const r of after) console.log(`  ${r.code}`);
  } finally { c.release(); await p.end(); }
})();
