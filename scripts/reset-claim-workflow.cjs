/**
 * Reset de workflow de un siniestro.
 *
 * Lee credenciales de Supabase desde .env.local.
 * Uso:
 *   node scripts/reset-claim-workflow.cjs L-000000141
 *   node scripts/reset-claim-workflow.cjs --liquidation=L-000000141
 *
 * ADVERTENCIA: borra TODAS las gestiones del siniestro, sus documentos,
 * sesiones de inspección y todo el contenido de esas sesiones. Usar con precaución.
 */

require("dotenv").config({ path: ".env.local" });

const readline = require("readline");
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

const args = process.argv.slice(2);
let liquidationNumber = "";

for (const arg of args) {
  if (arg.startsWith("--liquidation=")) {
    liquidationNumber = arg.split("=")[1];
  } else if (!arg.startsWith("--") && arg.length > 0) {
    liquidationNumber = arg;
  }
}

if (!liquidationNumber) {
  console.error("Debes indicar el número de liquidación. Ejemplo:");
  console.error("  node scripts/reset-claim-workflow.cjs L-000000141");
  process.exit(1);
}

const LIQUIDATION_NUMBER = liquidationNumber;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log(`\n=== Reset de workflow para ${LIQUIDATION_NUMBER} ===`);

  const confirm = await askQuestion(
    `¿Estás seguro de borrar TODAS las gestiones, documentos e inspecciones de ${LIQUIDATION_NUMBER}? (escribe SI para confirmar): `
  );

  if (confirm.trim().toUpperCase() !== "SI") {
    console.log("Cancelado.");
    rl.close();
    process.exit(0);
  }

  console.log(`\nBuscando siniestro ${LIQUIDATION_NUMBER}...`);

  const { data: claims, error: claimErr } = await supabase
    .from("claims")
    .select("id, status_id, business_line_id, event_id, country_id, company_id, claim_number")
    .eq("liquidation_number", LIQUIDATION_NUMBER)
    .limit(1);

  if (claimErr) throw claimErr;
  if (!claims || claims.length === 0) {
    console.error("No se encontró el siniestro");
    rl.close();
    process.exit(1);
  }

  const claim = claims[0];
  console.log("Siniestro encontrado:", claim.id, claim.claim_number);
  console.log("Estado actual:", claim.status_id);

  const { data: actions, error: actionsErr } = await supabase
    .from("claim_actions")
    .select("id, code, action_status_id, description")
    .eq("claim_id", claim.id);

  if (actionsErr) throw actionsErr;
  console.log(`\nGestiones actuales (${actions.length}):`);
  for (const a of actions || []) {
    console.log(`  - ${a.code} [status: ${a.action_status_id}] ${a.id}`);
  }

  const { data: sessions, error: sessionsErr } = await supabase
    .from("inspection_sessions")
    .select("id")
    .eq("claim_id", claim.id);

  if (sessionsErr) throw sessionsErr;
  const sessionIds = (sessions || []).map((s) => s.id);
  console.log(`\nSesiones de inspección encontradas: ${sessionIds.length}`);

  if (sessionIds.length > 0) {
    console.log("Borrando contenido de sesiones...");
    for (const table of [
      "inspection_chat_messages",
      "inspection_signatures",
      "inspection_checklists",
      "damage_sketches",
      "inspection_damages",
      "inspection_evidences",
      "inspection_notes",
    ]) {
      const { error } = await supabase.from(table).delete().in("session_id", sessionIds);
      if (error && error.message.includes("session_id")) {
        const { error: err2 } = await supabase.from(table).delete().in("inspection_session_id", sessionIds);
        if (err2) {
          console.error(`  Error borrando ${table}:`, err2.message);
        } else {
          console.log(`  ${table}: OK`);
        }
      } else if (error) {
        console.error(`  Error borrando ${table}:`, error.message);
      } else {
        console.log(`  ${table}: OK`);
      }
    }

    console.log("Borrando sessions...");
    const { error } = await supabase.from("inspection_sessions").delete().in("id", sessionIds);
    if (error) throw error;
    console.log("  inspection_sessions: OK");
  }

  const actionIds = (actions || []).map((a) => a.id);
  if (actionIds.length > 0) {
    console.log("Borrando documentos de gestiones...");
    const { error: errCad } = await supabase.from("claim_action_documents").delete().in("claim_action_id", actionIds);
    if (errCad) console.error("  claim_action_documents:", errCad.message);
    else console.log("  claim_action_documents: OK");

    const { error: errCd } = await supabase.from("claim_documents").delete().eq("claim_id", claim.id);
    if (errCd) console.error("  claim_documents:", errCd.message);
    else console.log("  claim_documents: OK");
  }

  console.log("Borrando gestiones...");
  const { error: delActionsErr } = await supabase.from("claim_actions").delete().eq("claim_id", claim.id);
  if (delActionsErr) throw delActionsErr;
  console.log("  claim_actions: OK");

  const { data: statusCreated } = await supabase
    .from("lookup_catalog")
    .select("id")
    .eq("category", "claim_status")
    .eq("code", "created")
    .single();

  const createdStatusId = statusCreated?.id;

  if (createdStatusId) {
    console.log("\nReseteando estado a 'created' para disparar workflow...");
    const { error: updErr } = await supabase
      .from("claims")
      .update({ status_id: createdStatusId, updated_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (updErr) throw updErr;
    console.log("  Estado cambiado a created");

    await new Promise((r) => setTimeout(r, 1000));

    console.log("  Volviendo al estado original para recrear gestiones...");
    const { error: updErr2 } = await supabase
      .from("claims")
      .update({ status_id: claim.status_id, updated_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (updErr2) throw updErr2;
    console.log("  Estado restaurado");
  } else {
    console.warn("  No se encontró estado 'created' en lookup_catalog");
  }

  console.log("\n=== Verificando nuevas gestiones ===");
  await new Promise((r) => setTimeout(r, 1500));
  const { data: newActions, error: newErr } = await supabase
    .from("claim_actions")
    .select("id, code, action_status_id, description")
    .eq("claim_id", claim.id);

  if (newErr) throw newErr;
  console.log(`Nuevas gestiones creadas: ${newActions.length}`);
  for (const a of newActions || []) {
    console.log(`  - ${a.code} [status: ${a.action_status_id}]`);
  }

  console.log("\n=== Listo ===");
  rl.close();
}

main().catch((err) => {
  console.error("ERROR:", err);
  rl.close();
  process.exit(1);
});
