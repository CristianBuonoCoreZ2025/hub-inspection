import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/359b_normalize_communes_ambiguous.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Aplicando migración 359b...\n");
  await client.query(migration);
  console.log("Migración 359b aplicada.");

  // Verificar
  const chileId = "9b8807b5-0af1-4331-b576-3b09b6a1db31";
  const remaining = await client.query(`
    SELECT count(*) AS total
    FROM claims_participants cp
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND EXISTS (
        SELECT 1 FROM communes co
        JOIN cities c ON c.id = co.city_id
        JOIN regions r ON r.id = c.region_id
        WHERE r.country_id = '${chileId}'
          AND unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
          AND cp.commune <> co.name
      )
  `);
  console.log("Case mismatches restantes (Chile):", remaining.rows[0].total);

  // Las que no matchean ni con unaccent
  const noMatch = await client.query(`
    SELECT DISTINCT commune, count(*) AS total
    FROM claims_participants
    WHERE commune IS NOT NULL AND TRIM(commune) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM communes co
        JOIN cities c ON c.id = co.city_id
        JOIN regions r ON r.id = c.region_id
        WHERE r.country_id = '${chileId}'
          AND unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(commune)))
      )
    GROUP BY commune
    ORDER BY total DESC
  `);
  console.log("\nComunas sin match en catálogo Chile:", noMatch.rows.length);
  noMatch.rows.forEach(r => console.log(`  "${r.commune}" (${r.total} filas)`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
