import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Personas naturales sin last_name
  const noLast = await client.query(`
    SELECT rut, full_name, first_name, last_name, type
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
    ORDER BY rut
  `);
  console.log("Personas naturales SIN last_name:", noLast.rows.length);
  noLast.rows.slice(0, 30).forEach(r => {
    console.log(`  rut="${r.rut}" | first="${r.first_name}" | last="${r.last_name}" | full="${r.full_name}" | type=${r.type}`);
  });
  if (noLast.rows.length > 30) console.log(`  ... y ${noLast.rows.length - 30} más`);

  // Verificar si full_name tiene apellidos (para inferir)
  const withFullName = await client.query(`
    SELECT count(*) AS total FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
      AND full_name IS NOT NULL AND TRIM(full_name) <> ''
      AND array_length(string_to_array(TRIM(full_name), ' '), 1) >= 2
  `);
  console.log("\nDe esos, con full_name que tiene 2+ palabras:", withFullName.rows[0].total);

  // Distribución de palabras en full_name
  const wordCount = await client.query(`
    SELECT array_length(string_to_array(TRIM(full_name), ' '), 1) AS words, count(*) AS total
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
      AND full_name IS NOT NULL AND TRIM(full_name) <> ''
    GROUP BY words ORDER BY words
  `);
  console.log("\nDistribución de palabras en full_name:");
  wordCount.rows.forEach(r => console.log(`  ${r.words} palabras: ${r.total} filas`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
