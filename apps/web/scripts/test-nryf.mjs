// Test rápido: verificar 5 RUTs contra nombrerutyfirma.com
import pg from "pg";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

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
  return b + formatted + "-" + dv;
}

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

  // Muestra de 5 RUTs
  const ruts = await client.query(`
    SELECT DISTINCT rut, full_name
    FROM claims_participants
    WHERE rut IS NOT NULL AND TRIM(rut) <> ''
      AND rut LIKE '%-%'
      AND rut NOT LIKE '%.%'
      AND NULLIF(REGEXP_REPLACE(SPLIT_PART(rut, '-', 1), '\\D', '', 'g'), '')::bigint < 50000000
    ORDER BY rut
    LIMIT 5
  `);

  for (const row of ruts.rows) {
    const formattedRut = formatRut(row.rut);
    try {
      const html = execSync(
        `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.nombrerutyfirma.com/rut?term=${formattedRut}"`,
        { encoding: "utf-8", timeout: 15000 }
      );
      const parsed = parseHtml(html);
      if (parsed.length > 0) {
        console.log(`${formattedRut} → "${parsed[0].name}" | sexo=${parsed[0].sexo} | comuna=${parsed[0].comuna}`);
      } else {
        console.log(`${formattedRut} → NO ENCONTRADO (BD: "${row.full_name}")`);
      }
    } catch (err) {
      console.log(`${formattedRut} → ERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
