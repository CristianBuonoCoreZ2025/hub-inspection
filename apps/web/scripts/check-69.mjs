import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  const chileId = "9b8807b5-0af1-4331-b576-3b09b6a1db31";
  const remaining = await client.query(`
    SELECT DISTINCT cp.commune, count(*) AS total,
      string_agg(DISTINCT co.name, ' | ') AS catalog_matches
    FROM claims_participants cp
    JOIN communes co ON unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
    JOIN cities c ON c.id = co.city_id
    JOIN regions r ON r.id = c.region_id
    WHERE r.country_id = '${chileId}'
      AND cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND cp.commune <> co.name
    GROUP BY cp.commune
    ORDER BY total DESC
  `);
  console.log(`Case mismatches restantes: ${remaining.rows.length}`);
  remaining.rows.forEach(r => {
    console.log(`  cp="${r.commune}" (${r.total} filas) → catálogo: ${r.catalog_matches}`);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
