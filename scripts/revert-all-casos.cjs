/**
 * Revert completo de Carga Casos:
 * 1. Resetea claims_staging (claim_id = null, status = 'pending')
 * 2. Borra claim_actions de los claims
 * 3. Borra claims_participants de los claims
 * 4. Borra los claims
 *
 * Identifica los claims de Carga Casos por:
 * - Tienen claim_id en claims_staging, O
 * - Tienen internal_number que viene del Excel de casos
 *
 * Uso:
 *   node scripts/revert-all-casos.cjs          (modo seguro: solo muestra qué borraría)
 *   node scripts/revert-all-casos.cjs --confirm (ejecuta el borrado)
 */

require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const CONFIRM = process.argv.includes("--confirm");

async function run() {
  console.log("=== Revert Carga Casos ===");
  console.log(`Modo: ${CONFIRM ? "CONFIRM (borrará datos)" : "DRY RUN (solo muestra)"}`);
  console.log("");

  // 1. Obtener todos los claim_ids que están en staging
  const { data: stagingRows, error: stagingErr } = await supabase
    .from("claims_staging")
    .select("id, claim_id, status, raw_data")
    .not("claim_id", "is", null);

  if (stagingErr) {
    console.error("Error leyendo staging:", stagingErr.message);
    process.exit(1);
  }

  const claimIds = (stagingRows || []).map((r) => r.claim_id).filter(Boolean);
  console.log(`Claims en staging (con claim_id): ${claimIds.length}`);

  if (claimIds.length === 0) {
    // También buscar claims que tengan notes = área del Excel (marca de Carga Casos)
    // o que tengan internal_number asignado por Carga Casos
    console.log("Buscando claims adicionales con marca de Carga Casos...");

    const { data: extraClaims, error: extraErr } = await supabase
      .from("claims")
      .select("id, claim_number, internal_number, notes, created_at")
      .not("internal_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (extraErr) {
      console.error("Error buscando claims extra:", extraErr.message);
    }

    // Filtrar los que parecen de Carga Casos (tienen internal_number y notes con área)
    const casosClaims = (extraClaims || []).filter((c) => {
      const notes = (c.notes || "").toLowerCase();
      return notes === "comercial" || notes === "hogar" || notes === "property" || c.internal_number;
    });

    console.log(`Claims adicionales encontrados: ${casosClaims.length}`);
    claimIds.push(...casosClaims.map((c) => c.id));
  }

  if (claimIds.length === 0) {
    console.log("\nNo hay claims de Carga Casos para borrar.");
    return;
  }

  // Mostrar los claims que se van a borrar
  const { data: claimsInfo, error: claimsErr } = await supabase
    .from("claims")
    .select("id, claim_number, client_reference, internal_number, created_at")
    .in("id", claimIds)
    .order("created_at", { ascending: false });

  if (claimsErr) {
    console.error("Error obteniendo info de claims:", claimsErr.message);
    process.exit(1);
  }

  console.log(`\nClaims a borrar: ${(claimsInfo || []).length}`);
  for (const c of claimsInfo || []) {
    console.log(`  - ${c.claim_number} | ref: ${c.client_reference || "—"} | ${c.id}`);
  }

  if (!CONFIRM) {
    console.log("\n=== DRY RUN ===");
    console.log("Para ejecutar el borrado, correr:");
    console.log("  node scripts/revert-all-casos.cjs --confirm");
    return;
  }

  // === BORRADO ===
  console.log("\n=== Borrando datos ===");

  // 1. Resetear staging
  console.log("1. Reseteando claims_staging...");
  const { error: resetErr } = await supabase
    .from("claims_staging")
    .update({ claim_id: null, status: "pending", error_message: null })
    .in("claim_id", claimIds);

  if (resetErr) {
    console.error("Error reseteando staging:", resetErr.message);
  } else {
    console.log("   OK");
  }

  // 2. Borrar claim_actions
  console.log("2. Borrando claim_actions...");
  const { error: actionsErr } = await supabase
    .from("claim_actions")
    .delete()
    .in("claim_id", claimIds);

  if (actionsErr) {
    console.error("Error borrando claim_actions:", actionsErr.message);
  } else {
    console.log("   OK");
  }

  // 3. Borrar claims_participants
  console.log("3. Borrando claims_participants...");
  const { error: partsErr } = await supabase
    .from("claims_participants")
    .delete()
    .in("claim_id", claimIds);

  if (partsErr) {
    console.error("Error borrando participants:", partsErr.message);
  } else {
    console.log("   OK");
  }

  // 4. Borrar claims
  console.log("4. Borrando claims...");
  const { error: claimsDeleteErr } = await supabase
    .from("claims")
    .delete()
    .in("id", claimIds);

  if (claimsDeleteErr) {
    console.error("Error borrando claims:", claimsDeleteErr.message);
  } else {
    console.log(`   OK - ${claimIds.length} claims borrados`);
  }

  // 5. Limpiar staging completamente
  console.log("5. Limpiando staging restante...");
  const { error: cleanErr } = await supabase
    .from("claims_staging")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (cleanErr) {
    console.error("Error limpiando staging:", cleanErr.message);
  } else {
    console.log("   OK - staging vacío");
  }

  console.log("\n=== Revert completo ===");
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
