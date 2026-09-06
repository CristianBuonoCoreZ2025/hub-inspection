import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  const remaining = await client.query(`
    SELECT rut, full_name, first_name, last_name, count(*) OVER (PARTITION BY rut) AS rut_count
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
    ORDER BY rut
  `);
  console.log("Restantes:", remaining.rows.length);

  // Distintos RUTs
  const distinctRuts = new Set(remaining.rows.map(r => r.rut));
  console.log("RUTs distintos:", distinctRuts.size);

  // Por número de palabras
  const byWords = {};
  remaining.rows.forEach(r => {
    const words = r.full_name ? r.full_name.trim().split(/\s+/).length : 0;
    byWords[words] = (byWords[words] || 0) + 1;
  });
  console.log("Por palabras:", byWords);

  // Listar todos
  console.log("\nTodos los restantes:");
  remaining.rows.forEach(r => {
    console.log(`  rut="${r.rut}" | full="${r.full_name}" | first="${r.first_name}"`);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
