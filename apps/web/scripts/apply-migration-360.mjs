import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/360_create_participants_and_liquidation.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Estado antes
  const before = await client.query(`
    SELECT cs.code, count(*) AS total
    FROM claims c JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code IN ('created', 'adjustment')
    GROUP BY cs.code
  `);
  console.log("=== ANTES ===");
  before.rows.forEach(r => console.log(`  ${r.code}: ${r.total}`));

  const beforeParts = await client.query(`
    SELECT cp.type, count(*) AS total
    FROM claims_participants cp
    JOIN claims c ON c.id = cp.claim_id
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'created'
    GROUP BY cp.type
  `);
  console.log("Participantes en created:");
  beforeParts.rows.forEach(r => console.log(`  ${r.type}: ${r.total}`));

  console.log("\nAplicando migración 360...\n");
  await client.query(migration);
  console.log("Migración 360 aplicada.\n");

  // Estado después
  const after = await client.query(`
    SELECT cs.code, count(*) AS total
    FROM claims c JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code IN ('created', 'adjustment')
    GROUP BY cs.code
  `);
  console.log("=== DESPUÉS ===");
  after.rows.forEach(r => console.log(`  ${r.code}: ${r.total}`));

  // Participantes en los claims que pasaron a adjustment
  const afterParts = await client.query(`
    SELECT cp.type, count(*) AS total
    FROM claims_participants cp
    JOIN claims c ON c.id = cp.claim_id
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'adjustment'
      AND c.updated_at > NOW() - INTERVAL '5 minutes'
    GROUP BY cp.type ORDER BY cp.type
  `);
  console.log("Participantes en claims recién pasados a adjustment:");
  afterParts.rows.forEach(r => console.log(`  ${r.type}: ${r.total}`));

  // Gestiones creadas por el trigger
  const actions = await client.query(`
    SELECT ca.name, count(*) AS total
    FROM claim_actions ca
    JOIN claims c ON c.id = ca.claim_id
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'adjustment'
      AND ca.created_on > NOW() - INTERVAL '5 minutes'
    GROUP BY ca.name ORDER BY ca.name
  `);
  console.log("\nGestiones creadas por el trigger:");
  actions.rows.forEach(r => console.log(`  ${r.name}: ${r.total}`));

  const totalActions = await client.query(`
    SELECT count(*) AS total
    FROM claim_actions ca
    JOIN claims c ON c.id = ca.claim_id
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'adjustment'
      AND ca.created_on > NOW() - INTERVAL '5 minutes'
  `);
  console.log(`\nTotal gestiones nuevas: ${totalActions.rows[0].total}`);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
