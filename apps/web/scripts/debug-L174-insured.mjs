// Debug: verificar por qué L-000000174 no muestra asegurado
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
  // 1) Buscar el claim
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, liquidation_number, claim_number")
    .eq("liquidation_number", "L-000000174")
    .limit(1);
  if (claimErr || !claim?.length) {
    console.log(`No se encontró L-000000174: ${claimErr?.message || "sin resultados"}`);
    return;
  }
  const claimId = claim[0].id;
  console.log(`Claim: ${claim[0].liquidation_number}  id=${claimId}`);

  // 2) Buscar participants con service role
  const { data: participants, error: pErr } = await supabase
    .from("claims_participants")
    .select("id, claim_id, type, full_name, first_name, last_name, rut, email, is_active, linked_to_insured, person_type")
    .eq("claim_id", claimId);
  if (pErr) {
    console.log(`Error participants: ${pErr.message}`);
  } else {
    console.log(`\nParticipants (service role): ${participants?.length || 0}`);
    for (const p of participants || []) {
      console.log(`  type=${p.type}  full_name=${p.full_name}  is_active=${p.is_active}  linked_to_insured=${p.linked_to_insured}  person_type=${p.person_type}`);
    }
  }

  // 3) Buscar con anon key (como el navegador)
  const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: participantsAnon, error: pAnonErr } = await supabaseAnon
    .from("claims_participants")
    .select("id, claim_id, type, full_name, is_active")
    .eq("claim_id", claimId);
  if (pAnonErr) {
    console.log(`\nError participants (anon): ${pAnonErr.message}`);
  } else {
    console.log(`\nParticipants (anon key): ${participantsAnon?.length || 0}`);
    for (const p of participantsAnon || []) {
      console.log(`  type=${p.type}  full_name=${p.full_name}  is_active=${p.is_active}`);
    }
  }

  // 4) Verificar el tipo exacto del asegurado — ¿es "insured" o "Asegurado" o otro?
  console.log(`\n--- Verificando tipos de participants ---`);
  const { data: allTypes } = await supabase
    .from("claims_participants")
    .select("type")
    .eq("claim_id", claimId);
  if (allTypes) {
    const types = new Set(allTypes.map(p => p.type));
    console.log(`Tipos únicos: ${[...types].join(", ")}`);
  }

  // 5) Verificar cómo getParticipant busca el asegurado
  // Buscar el código de getParticipant en el frontend
  console.log(`\n--- Buscando getParticipant ---`);
  // El código usa getParticipant(c, "insured") — verificar si hay participants con type="insured"
  const insuredParticipants = (participants || []).filter(p => p.type === "insured");
  console.log(`Participants con type="insured": ${insuredParticipants.length}`);
  if (insuredParticipants.length === 0) {
    console.log(`\n*** PROBLEMA: no hay participant con type="insured" ***`);
    console.log(`Tipos disponibles: ${[...new Set((participants || []).map(p => p.type))].join(", ")}`);
  }
}

main().catch(console.error);
