import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Columnas de claims_participants
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'claims_participants'
    ORDER BY ordinal_position
  `);
  console.log("=== Columnas claims_participants ===");
  cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === "NO" ? " NOT NULL" : ""}${c.column_default ? ` DEFAULT ${c.column_default}` : ""}`));

  // Tipos de participante existentes
  const types = await client.query(`
    SELECT type, count(*) AS total FROM claims_participants GROUP BY type ORDER BY total DESC
  `);
  console.log("\n=== Tipos de participante ===");
  types.rows.forEach(t => console.log(`  ${t.type}: ${t.total}`));

  // Muestra de un insured de un claim en created
  const sample = await client.query(`
    SELECT cp.*
    FROM claims c
    JOIN lookup_catalog cs ON cs.id = c.status_id
    JOIN claims_participants cp ON cp.claim_id = c.id AND cp.type = 'insured'
    WHERE cs.code = 'created'
    LIMIT 3
  `);
  console.log("\n=== Muestra insured (claims created) ===");
  sample.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

  // Verificar si ya existen beneficiary/contractor/contact en esos claims
  const existing = await client.query(`
    SELECT cp.type, count(*) AS total
    FROM claims c
    JOIN lookup_catalog cs ON cs.id = c.status_id
    JOIN claims_participants cp ON cp.claim_id = c.id
    WHERE cs.code = 'created'
    GROUP BY cp.type ORDER BY total DESC
  `);
  console.log("\n=== Participantes existentes en claims created ===");
  existing.rows.forEach(r => console.log(`  ${r.type}: ${r.total}`));

  // Status de liquidación
  const liqStatus = await client.query(`
    SELECT id, code, name FROM lookup_catalog WHERE category = 'claim_status' AND code = 'adjustment'
  `);
  console.log("\n=== Status liquidación ===");
  liqStatus.rows.forEach(r => console.log(`  id=${r.id} code=${r.code} name=${r.name}`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
