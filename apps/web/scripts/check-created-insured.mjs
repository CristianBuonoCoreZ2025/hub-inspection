import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Claims en "created" que NO tienen participante "insured"
  const noInsured = await client.query(`
    SELECT c.id, c.claim_number
    FROM claims c
    LEFT JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'created'
      AND NOT EXISTS (
        SELECT 1 FROM claims_participants cp
        WHERE cp.claim_id = c.id AND cp.type = 'insured'
      )
    ORDER BY c.claim_number
  `);
  console.log(`Claims en "created" SIN participante insured: ${noInsured.rows.length}`);
  noInsured.rows.slice(0, 30).forEach(r => {
    console.log(`  ${r.claim_number}`);
  });
  if (noInsured.rows.length > 30) console.log(`  ... y ${noInsured.rows.length - 30} más`);

  // Claims en "created" que SÍ tienen participante "insured"
  const withInsured = await client.query(`
    SELECT count(DISTINCT c.id) AS total
    FROM claims c
    JOIN lookup_catalog cs ON cs.id = c.status_id
    JOIN claims_participants cp ON cp.claim_id = c.id AND cp.type = 'insured'
    WHERE cs.code = 'created'
  `);
  console.log(`\nClaims en "created" CON participante insured: ${withInsured.rows[0].total}`);

  // Total claims en created
  const total = await client.query(`
    SELECT count(*) AS total FROM claims c
    JOIN lookup_catalog cs ON cs.id = c.status_id
    WHERE cs.code = 'created'
  `);
  console.log(`Total claims en "created": ${total.rows[0].total}`);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
