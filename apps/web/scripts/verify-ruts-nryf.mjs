// Verificar RUTs de personas naturales en claims_participants contra nombrerutyfirma.com
import pg from "pg";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

// Formatear RUT con puntos: 17698103-2 → 17.698.103-2
function formatRut(rut) {
  const clean = rut.replace(/\./g, "").replace(/\s/g, "");
  const parts = clean.split("-");
  const body = parts[0];
  const dv = parts[1] || "";
  let formatted = "";
  let b = body;
  while (b.length > 3) {
    formatted = "." + b.slice(-3) + formatted;
    b = b.slice(0, -3);
  }
  formatted = b + formatted + "-" + dv;
  return formatted;
}

// Parsear HTML de nombrerutyfirma.com
function parseHtml(html) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const tbody = tbodyMatch[1];
  const rowMatches = tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  const results = [];
  for (const rowMatch of rowMatches) {
    const cells = rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g);
    const cellsArr = [...cells].map(c => c[1].trim());
    if (cellsArr.length >= 5) {
      results.push({
        name: cellsArr[0],
        rut: cellsArr[1],
        sexo: cellsArr[2],
        direccion: cellsArr[3],
        comuna: cellsArr[4],
      });
    }
  }
  return results;
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Obtener RUTs únicos de personas naturales en claims_participants
  // que NO existen en persons (los que necesitan verificación)
  const ruts = await client.query(`
    WITH cp_ruts AS (
      SELECT DISTINCT rut, full_name, first_name, last_name
      FROM claims_participants
      WHERE rut IS NOT NULL AND TRIM(rut) <> ''
        AND rut LIKE '%-%'
        AND rut NOT LIKE '%.%'
        -- Solo personas naturales (RUT < 50M)
        AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
    ),
    person_ruts AS (
      SELECT DISTINCT tax_id FROM persons
      WHERE tax_id IS NOT NULL AND TRIM(tax_id) <> ''
    )
    SELECT cp.rut, cp.full_name, cp.first_name, cp.last_name
    FROM cp_ruts cp
    WHERE NOT EXISTS (
      SELECT 1 FROM person_ruts p
      WHERE unaccent(lower(TRIM(p.tax_id))) = unaccent(lower(REPLACE(REPLACE(REPLACE(cp.rut, '.', ''), '-', ''), ' ', '')))
    )
    ORDER BY cp.rut
  `);

  console.log(`RUTs de personas naturales en claims_participants NO en persons: ${ruts.rows.length}`);

  const results = [];
  let count = 0;

  for (const row of ruts.rows) {
    count++;
    const formattedRut = formatRut(row.rut);

    try {
      const html = execSync(
        `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.nombrerutyfirma.com/rut?term=${formattedRut}"`,
        { encoding: "utf-8", timeout: 15000 }
      );

      const parsed = parseHtml(html);

      if (parsed.length > 0) {
        const found = parsed[0];
        results.push({
          rut: row.rut,
          formatted_rut: formattedRut,
          name_in_db: row.full_name,
          name_found: found.name,
          sexo: found.sexo,
          direccion: found.direccion,
          comuna: found.comuna,
          match: row.full_name?.toLowerCase().includes(found.name?.toLowerCase().split(" ")[0]) || false,
        });
        console.log(`[${count}/${ruts.rows.length}] ${formattedRut} → ${found.name} ${found.name !== row.full_name ? "⚠️ DIFF" : "✓"}`);
      } else {
        results.push({
          rut: row.rut,
          formatted_rut: formattedRut,
          name_in_db: row.full_name,
          name_found: "NO_ENCONTRADO",
          match: false,
        });
        console.log(`[${count}/${ruts.rows.length}] ${formattedRut} → NO ENCONTRADO`);
      }
    } catch (err) {
      results.push({
        rut: row.rut,
        formatted_rut: formattedRut,
        name_in_db: row.full_name,
        name_found: "ERROR: " + err.message,
        match: false,
      });
      console.log(`[${count}/${ruts.rows.length}] ${formattedRut} → ERROR: ${err.message}`);
    }

    // Delay pequeño para no saturar
    await new Promise(r => setTimeout(r, 500));
  }

  // Guardar resultados
  writeFileSync("RUTS_VERIFICADOS.json", JSON.stringify(results, null, 2));

  // Resumen
  const found = results.filter(r => r.name_found !== "NO_ENCONTRADO" && !r.name_found.startsWith("ERROR"));
  const notFound = results.filter(r => r.name_found === "NO_ENCONTRADO");
  const errors = results.filter(r => r.name_found.startsWith("ERROR"));
  const diffs = results.filter(r => r.match === false && r.name_found !== "NO_ENCONTRADO" && !r.name_found.startsWith("ERROR"));

  console.log("\n=== RESUMEN ===");
  console.log("Total verificados:", results.length);
  console.log("Encontrados:", found.length);
  console.log("No encontrados:", notFound.length);
  console.log("Errores:", errors.length);
  console.log("Con diferencias:", diffs.length);

  // Mostrar diferencias
  if (diffs.length > 0) {
    console.log("\n=== DIFERENCIAS ===");
    diffs.forEach(r => {
      console.log(`  RUT: ${r.formatted_rut}`);
      console.log(`    BD:   "${r.name_in_db}"`);
      console.log(`    WEB:  "${r.name_found}"`);
    });
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
