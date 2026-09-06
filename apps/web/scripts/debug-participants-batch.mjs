// Verificar cuántos participants hay por batch de 200 claims
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
  // Traer todos los claim IDs ordenados por created_at DESC (como el export)
  const { data: allClaims } = await supabase
    .from("claims")
    .select("id, liquidation_number, created_at")
    .eq("disabled", false)
    .order("created_at", { ascending: false })
    .range(0, 1999); // primeros 2000 para probar

  if (!allClaims?.length) {
    console.log("Sin claims");
    return;
  }

  console.log(`Total claims a verificar: ${allClaims.length}`);

  // Procesar en batches de 200 (como el export)
  const BATCH_SIZE = 200;
  for (let i = 0; i < Math.min(allClaims.length, 600); i += BATCH_SIZE) {
    const batch = allClaims.slice(i, i + BATCH_SIZE);
    const claimIds = batch.map(c => c.id);

    // Contar participants para este batch
    const { count } = await supabase
      .from("claims_participants")
      .select("id", { count: "exact", head: true })
      .in("claim_id", claimIds);

    console.log(`\nBatch ${i / BATCH_SIZE + 1} (claims ${i + 1}-${i + batch.length}): ${count} participants`);

    if (count > 1000) {
      console.log(`  *** EXCEDE 1000 — faltan ${count - 1000} participants ***`);

      // Verificar qué claims pierden participants
      const { data: first1000 } = await supabase
        .from("claims_participants")
        .select("claim_id")
        .in("claim_id", claimIds)
        .range(0, 999);
      const foundClaimIds = new Set(first1000?.map(p => p.claim_id) || []);
      const missingClaims = batch.filter(c => !foundClaimIds.has(c.id));
      console.log(`  Claims sin participants en primeros 1000: ${missingClaims.length}`);
      for (const mc of missingClaims.slice(0, 5)) {
        console.log(`    ${mc.liquidation_number} (created ${mc.created_at?.substring(0, 10)})`);
      }
    }

    // Verificar cuántos claims de este batch tienen insured
    const { data: insuredParticipants } = await supabase
      .from("claims_participants")
      .select("claim_id, type")
      .in("claim_id", claimIds)
      .eq("type", "insured");
    const claimsWithInsured = new Set(insuredParticipants?.map(p => p.claim_id) || []);
    console.log(`  Claims con insured: ${claimsWithInsured.size} de ${batch.length}`);
  }
}

main().catch(console.error);
