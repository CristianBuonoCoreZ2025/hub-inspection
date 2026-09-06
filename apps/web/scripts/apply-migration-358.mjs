import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

const migration = readFileSync("../../migrations/358_split_lastname_natural.sql", "utf-8");

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log("Aplicando migración 358...\n");
  await client.query(migration);
  console.log("Migración 358 aplicada.");

  // Verificar
  const remaining = await client.query(`
    SELECT count(*) AS total FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
  `);
  console.log("Personas naturales sin last_name restantes:", remaining.rows[0].total);

  // Muestra de los actualizados
  const sample = await client.query(`
    SELECT rut, first_name, last_name, full_name
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND last_name IS NOT NULL AND TRIM(last_name) <> '' AND lower(TRIM(last_name)) <> 'null'
      AND first_name IS NOT NULL AND TRIM(first_name) <> ''
      AND array_length(string_to_array(TRIM(full_name), ' '), 1) >= 3
    ORDER BY random()
    LIMIT 15
  `);
  console.log("\nMuestra de actualizados:");
  sample.rows.forEach(r => console.log(`  rut="${r.rut}" | first="${r.first_name}" | last="${r.last_name}" | full="${r.full_name}"`));

  // Los que quedan (2 palabras y 1 palabra)
  const remainingRows = await client.query(`
    SELECT rut, full_name, first_name, last_name
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
    ORDER BY rut
  `);
  console.log(`\nRestantes (${remainingRows.rows.length}) — casos de 1-2 palabras:`);
  remainingRows.rows.slice(0, 20).forEach(r => console.log(`  rut="${r.rut}" | full="${r.full_name}"`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
