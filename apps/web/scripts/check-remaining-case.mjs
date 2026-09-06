import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Case mismatches restantes
  const remaining = await client.query(`
    SELECT DISTINCT cp.commune, co.name AS catalog_name, co.id
    FROM claims_participants cp
    JOIN communes co ON unaccent(lower(TRIM(co.name))) = unaccent(lower(TRIM(cp.commune)))
    WHERE cp.commune IS NOT NULL AND TRIM(cp.commune) <> ''
      AND cp.commune <> co.name
    ORDER BY cp.commune
  `);
  console.log(`Case mismatches restantes: ${remaining.rows.length}`);
  remaining.rows.forEach(r => {
    console.log(`  cp="${r.commune}" → catálogo="${r.catalog_name}" (id=${r.id})`);
  });

  // Verificar si hay comunas duplicadas en el catálogo (mismo nombre normalizado)
  const dupCatalog = await client.query(`
    SELECT unaccent(lower(TRIM(name))) AS norm, array_agg(name) AS names, count(*) AS total
    FROM communes
    GROUP BY unaccent(lower(TRIM(name)))
    HAVING count(*) > 1
    ORDER BY total DESC
  `);
  console.log(`\nNombres duplicados en catálogo communes: ${dupCatalog.rows.length}`);
  dupCatalog.rows.forEach(r => console.log(`  ${r.names.join(' | ')} (${r.total})`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
