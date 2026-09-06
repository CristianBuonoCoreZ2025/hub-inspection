import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // 1. Comunas en claims_participants que NO matchean exactamente con communes
  const noMatch = await client.query(`
    WITH cp_communes AS (
      SELECT DISTINCT commune, count(*) AS total
      FROM claims_participants
      WHERE commune IS NOT NULL AND TRIM(commune) <> ''
      GROUP BY commune
    )
    SELECT cp.commune, cp.total,
      (SELECT string_agg(co.name, ', ') FROM communes co
       WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))) AS exact_match,
      (SELECT string_agg(co.name, ', ') FROM communes co
       WHERE unaccent(lower(TRIM(co.name))) LIKE unaccent(lower('%' || TRIM(cp.commune) || '%'))
          OR unaccent(lower(TRIM(cp.commune))) LIKE unaccent(lower('%' || co.name || '%'))) AS partial_match
    FROM cp_communes cp
    WHERE NOT EXISTS (
      SELECT 1 FROM communes co
      WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
    )
    ORDER BY cp.total DESC
  `);
  console.log(`Comunas en claims_participants SIN match exacto: ${noMatch.rows.length}`);
  noMatch.rows.forEach(r => {
    console.log(`  commune="${r.commune}" (${r.total} filas) → exact="${r.exact_match || 'NONE'}" partial="${r.partial_match || 'NONE'}"`);
  });

  // 2. Total de comunas distintas
  const total = await client.query(`
    SELECT count(DISTINCT commune) AS total FROM claims_participants
    WHERE commune IS NOT NULL AND TRIM(commune) <> ''
  `);
  console.log("\nTotal comunas distintas en claims_participants:", total.rows[0].total);

  // 3. Cuántas matchean exactamente
  const matchExact = await client.query(`
    SELECT count(DISTINCT cp.commune) AS total
    FROM claims_participants cp
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND EXISTS (
        SELECT 1 FROM communes co
        WHERE unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
      )
  `);
  console.log("Comunas que matchean exacto:", matchExact.rows[0].total);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
