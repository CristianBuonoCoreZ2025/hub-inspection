import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/359c_fix_last_communes.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Aplicando migración 359c...\n");
  await client.query(migration);
  console.log("Migración 359c aplicada.");

  // Verificación final
  const chileId = "9b8807b5-0af1-4331-b576-3b09b6a1db31";
  const noMatch = await client.query(`
    SELECT DISTINCT commune, count(*) AS total
    FROM claims_participants
    WHERE commune IS NOT NULL AND TRIM(commune) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM communes co
        JOIN cities c ON c.id = co.city_id
        JOIN regions r ON r.id = c.region_id
        WHERE r.country_id = '${chileId}'
          AND TRIM(co.name) = TRIM(commune)
      )
    GROUP BY commune
    ORDER BY total DESC
  `);
  console.log(`\nComunas sin match EXACTO en catálogo Chile: ${noMatch.rows.length}`);
  noMatch.rows.forEach(r => console.log(`  "${r.commune}" (${r.total} filas)`));

  // Total filas con match exacto
  const exactMatch = await client.query(`
    SELECT count(*) AS total FROM claims_participants cp
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND EXISTS (
        SELECT 1 FROM communes co
        JOIN cities c ON c.id = co.city_id
        JOIN regions r ON r.id = c.region_id
        WHERE r.country_id = '${chileId}'
          AND TRIM(co.name) = TRIM(cp.commune)
      )
  `);
  console.log("\nFilas con match exacto:", exactMatch.rows[0].total);

  const total = await client.query("SELECT count(*) AS total FROM claims_participants WHERE commune IS NOT NULL AND TRIM(commune) <> ''");
  console.log("Total filas con comuna:", total.rows[0].total);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
