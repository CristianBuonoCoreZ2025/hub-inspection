// Script de diagnóstico: busca en qué campo coinciden los números reportados.
// SOLO LECTURA.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..", "..");

const envFile = readFileSync(resolve(root, ".env.production"), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const references = [
  "202504152","202600212","202601844","202602132","202602231","202602570",
  "202602676","202602752","202602763","202602835","202602910","202603017",
  "202603052","202603314","202603437","202603442","202603503","202603504",
  "202603513","202603521","202603873","202604003","202604112","202604113",
  "202604155","202604207","202604222","202604232","202604281","202604319",
  "202604425","202604483","202604601","202604619","202604625","202604634",
  "202604659","202604747","202604750","202604786","202604797","202604798",
  "202604802","202604803","202604812","202604836","202604844","202604845",
  "202604866","202605085","202605117","202605124","202605137","202605357",
  "202605377","202605407","202605438","202605509","202605796",
];

async function countInField(field) {
  const { data, error } = await supabase
    .from("claims")
    .select(`id, ${field}, disabled`)
    .in(field, references);
  if (error) return { field, error: error.message, count: 0, groups: [] };
  const byVal = new Map();
  for (const c of data) {
    const v = c[field] ?? "(null)";
    if (!byVal.has(v)) byVal.set(v, []);
    byVal.get(v).push(c);
  }
  const dups = [];
  let totalClaims = 0;
  for (const [v, g] of byVal.entries()) {
    totalClaims += g.length;
    if (g.length > 1) dups.push({ value: v, count: g.length });
  }
  return { field, totalClaims, referencesMatched: byVal.size, duplicates: dups.length, dupGroups: dups };
}

async function main() {
  console.log(`\n=== BÚSQUEDA DE CAMPO CORRECTO PARA LAS REFERENCIAS ===\n`);
  const fields = ["client_reference", "claim_number", "internal_number", "company_report_number", "liquidation_number"];
  for (const f of fields) {
    const r = await countInField(f);
    if (r.error) {
      console.log(`${f}: ERROR → ${r.error}`);
      continue;
    }
    console.log(`${f}:`);
    console.log(`  claims encontrados: ${r.totalClaims}, refs con match: ${r.referencesMatched}, grupos duplicados: ${r.duplicates}`);
    if (r.dupGroups.length) {
      for (const d of r.dupGroups.slice(0, 5)) {
        console.log(`    → ${d.value}: ${d.count} claims`);
      }
      if (r.dupGroups.length > 5) console.log(`    ... y ${r.dupGroups.length - 5} más`);
    }
    console.log();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
