import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Comunas que matchean con unaccent/lower pero NO exactamente (case mismatch)
  const caseMismatch = await client.query(`
    WITH cp_communes AS (
      SELECT DISTINCT commune, count(*) AS total
      FROM claims_participants
      WHERE commune IS NOT NULL AND TRIM(commune) <> ''
      GROUP BY commune
    )
    SELECT cp.commune, cp.total, co.name AS catalog_name
    FROM cp_communes cp
    JOIN communes co ON unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
    WHERE cp.commune <> co.name
    ORDER BY cp.total DESC
  `);
  console.log(`Comunas con case/formato diferente al catálogo: ${caseMismatch.rows.length}`);
  caseMismatch.rows.forEach(r => {
    console.log(`  cp="${r.commune}" (${r.total} filas) → catálogo="${r.catalog_name}"`);
  });

  // Total de filas afectadas
  const totalRows = await client.query(`
    SELECT count(*) AS total
    FROM claims_participants cp
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND EXISTS (
        SELECT 1 FROM communes co
        WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
          AND cp.commune <> co.name
      )
  `);
  console.log("\nTotal filas afectadas por case mismatch:", totalRows.rows[0].total);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
