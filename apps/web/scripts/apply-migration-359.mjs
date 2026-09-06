import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/359_normalize_communes.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Aplicando migración 359...\n");
  await client.query(migration);
  console.log("Migración 359 aplicada.");

  // Verificar
  const remaining = await client.query(`
    SELECT count(*) AS total
    FROM claims_participants cp
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND EXISTS (
        SELECT 1 FROM communes co
        WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
          AND cp.commune <> co.name
      )
  `);
  console.log("Case mismatches restantes:", remaining.rows[0].total);

  // Las 4 que no matchean ni con unaccent
  const noMatch = await client.query(`
    SELECT DISTINCT commune, count(*) AS total
    FROM claims_participants
    WHERE commune IS NOT NULL AND TRIM(commune) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM communes co
        WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(commune)))
      )
    ORDER BY total DESC
  `);
  console.log("\nComunas sin match en catálogo:", noMatch.rows.length);
  noMatch.rows.forEach(r => console.log(`  "${r.commune}" (${r.total} filas)`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
