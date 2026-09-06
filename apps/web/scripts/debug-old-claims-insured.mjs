// Debug: verificar participants de claims antiguos que no muestran asegurado
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

async function main() {
  const liquidations = [
    "L-000000005", "L-000000006", "L-000000007", "L-000000011",
    "L-000000018", "L-000000020", "L-000000008", "L-000000037",
    "L-000000053", "L-000000242", // estos sí tienen asegurado
  ];

  for (const liqNum of liquidations) {
    const { data: claim } = await supabase
      .from("claims")
      .select("id, liquidation_number, created_at")
      .eq("liquidation_number", liqNum)
      .limit(1);
    if (!claim?.length) {
      console.log(`${liqNum}: NO ENCONTRADO`);
      continue;
    }
    const claimId = claim[0].id;

    const { data: participants } = await supabase
      .from("claims_participants")
      .select("id, type, full_name, is_active, linked_to_insured, person_type")
      .eq("claim_id", claimId);

    const insured = participants?.find(p => p.type === "insured");
    console.log(`\n${liqNum} (created ${claim[0].created_at?.substring(0, 10)}):`);
    console.log(`  Total participants: ${participants?.length || 0}`);
    if (participants?.length) {
      for (const p of participants) {
        console.log(`    type=${p.type}  name=${p.full_name}  is_active=${p.is_active}`);
      }
    }
    console.log(`  Insured: ${insured ? insured.full_name : "NO HAY"}`);
  }

  // También verificar si hay una tabla persons con datos del asegurado
  console.log(`\n--- Verificar tabla persons ---`);
  const { data: personsCount } = await supabase
    .from("persons")
    .select("id", { count: "exact", head: true })
    .limit(1);
  console.log(`Total persons: ${personsCount}`);

  // Verificar L-000000005 en persons
  const { data: claim5 } = await supabase
    .from("claims")
    .select("id")
    .eq("liquidation_number", "L-000000005")
    .limit(1);
  if (claim5?.length) {
    const { data: persons5 } = await supabase
      .from("persons")
      .select("*")
      .eq("claim_id", claim5[0].id)
      .limit(5);
    console.log(`\nPersons para L-000000005: ${persons5?.length || 0}`);
    if (persons5?.length) {
      for (const p of persons5) {
        console.log(`  ${JSON.stringify(p).substring(0, 200)}`);
      }
    }

    // Verificar si persons tiene claim_id
    const { data: personsCols } = await supabase
      .from("persons")
      .select("*")
      .limit(1);
    if (personsCols?.length) {
      console.log(`\nColumnas de persons: ${Object.keys(personsCols[0]).join(", ")}`);
    }
  }
}

main().catch(console.error);
