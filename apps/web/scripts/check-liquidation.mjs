// Consulta el estado de liquidación de los claims con las referencias reportadas.
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

async function main() {
  // Traer claims con campos de liquidación y estado
  const { data: claims, error } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, liquidation_number, status_id, status:lookup_catalog!claims_status_id_fkey(id, code, name), disabled, created_at, updated_at")
    .in("client_reference", references)
    .order("client_reference", { ascending: true });

  if (error) { console.error("Error:", error.message); process.exit(1); }

  console.log(`\n=== ESTADO DE LIQUIDACIÓN DE LOS ${claims.length} CLAIMS ===\n`);

  const withLiquidation = claims.filter((c) => c.liquidation_number && String(c.liquidation_number).trim() !== "");
  const withoutLiquidation = claims.filter((c) => !c.liquidation_number || String(c.liquidation_number).trim() === "");

  console.log(`Claims CON liquidation_number: ${withLiquidation.length}`);
  console.log(`Claims SIN liquidation_number: ${withoutLiquidation.length}\n`);

  console.log("--- CON liquidación ---");
  for (const c of withLiquidation) {
    const statusName = c.status?.name || c.status?.code || "?";
    console.log(`ref=${c.client_reference}  liquidation="${c.liquidation_number}"  status="${statusName}"  id=${c.id}`);
  }

  console.log("\n--- SIN liquidación ---");
  for (const c of withoutLiquidation) {
    const statusName = c.status?.name || c.status?.code || "?";
    console.log(`ref=${c.client_reference}  status="${statusName}"  id=${c.id}`);
  }

  // Resumen por estado
  console.log("\n--- RESUMEN POR ESTADO ---");
  const byStatus = new Map();
  for (const c of claims) {
    const s = c.status?.name || c.status?.code || "(sin estado)";
    if (!byStatus.has(s)) byStatus.set(s, []);
    byStatus.get(s).push(c);
  }
  for (const [s, g] of byStatus.entries()) {
    console.log(`  ${s}: ${g.length} claims`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
