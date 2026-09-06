// Separar first_name y last_name en claims_participants para personas naturales sin last_name
// Heurística chilena: últimos 2 tokens = apellidos, resto = nombre
import pg from "pg";
import { readFileSync, writeFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Obtener las 762 filas
  const rows = await client.query(`
    SELECT id, rut, full_name, first_name, last_name, type
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
      AND (last_name IS NULL OR TRIM(last_name) = '' OR lower(TRIM(last_name)) = 'null')
    ORDER BY rut
  `);

  console.log("Total filas a procesar:", rows.rows.length);

  const updates = [];
  const skipped = [];

  for (const row of rows.rows) {
    const fullName = (row.full_name || "").trim();
    if (!fullName) {
      skipped.push({ ...row, reason: "full_name vacío" });
      continue;
    }

    const tokens = fullName.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length < 2) {
      // Solo 1 palabra: no hay apellidos, dejar first_name = full_name, last_name = NULL
      skipped.push({ ...row, reason: `solo ${tokens.length} palabra(s)` });
      continue;
    }

    // Heurística chilena: últimos 2 tokens = apellidos
    let firstName, lastName;
    if (tokens.length === 2) {
      firstName = tokens[0];
      lastName = tokens[1];
    } else if (tokens.length === 3) {
      firstName = tokens[0];
      lastName = tokens.slice(1).join(" ");
    } else {
      // 4+ tokens: primeros 1-2 = nombre, últimos 2 = apellidos
      // Si tiene 4: 2 nombre + 2 apellido
      // Si tiene 5+: 2-3 nombre + 2 apellido
      const lastTwo = tokens.slice(-2);
      const rest = tokens.slice(0, -2);
      firstName = rest.join(" ");
      lastName = lastTwo.join(" ");
    }

    updates.push({
      id: row.id,
      rut: row.rut,
      old_first: row.first_name,
      old_last: row.last_name,
      new_first: firstName,
      new_last: lastName,
      full_name: fullName,
      type: row.type,
    });
  }

  console.log("Updates propuestos:", updates.length);
  console.log("Skipped:", skipped.length);
  skipped.slice(0, 10).forEach(s => console.log(`  SKIP: rut="${s.rut}" full="${s.full_name}" reason="${s.reason}"`));

  // Mostrar muestra de updates
  console.log("\nMuestra de 20 updates:");
  updates.slice(0, 20).forEach(u => {
    const changed = u.old_first !== u.new_first ? " ⚡first" : "";
    console.log(`  rut="${u.rut}" | full="${u.full_name}" → first="${u.new_first}" last="${u.new_last}"${changed}`);
  });

  // Guardar para revisión
  writeFileSync("UPDATES_LASTNAME.json", JSON.stringify(updates, null, 2));

  // Detectar casos donde first_name cambiaría (puede ser problemático)
  const firstChange = updates.filter(u => (u.old_first || "").trim() !== u.new_first && u.old_first && u.old_first !== "null");
  console.log(`\nFilas donde first_name cambiaría: ${firstChange.length}`);
  firstChange.slice(0, 10).forEach(u => {
    console.log(`  rut="${u.rut}" | old_first="${u.old_first}" → new_first="${u.new_first}" | last="${u.new_last}"`);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
