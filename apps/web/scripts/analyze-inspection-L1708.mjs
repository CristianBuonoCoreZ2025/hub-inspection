// Análisis completo de la inspección L-000001708-HINS-001.
// SOLO LECTURA — no modifica nada.
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
  console.log(`\n${"=".repeat(90)}`);
  console.log(`ANÁLISIS DE INSPECCIÓN: L-000001708-HINS-001`);
  console.log(`${"=".repeat(90)}\n`);

  // 1) Buscar el claim por liquidation_number L-000001708
  console.log(`>>> 1) BUSCAR CLAIM POR liquidation_number=L-000001708\n`);
  const { data: claims, error: cErr } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, liquidation_number, disabled, status_id, status:lookup_catalog!claims_status_id_fkey(code, name), inspector_id, inspector:profiles!claims_inspector_id_fkey(id, full_name, email), company_id, company:companies!claims_company_id_fkey(id, name), insurance_company_id, insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), created_at, updated_at")
    .eq("liquidation_number", "L-000001708");

  if (cErr) { console.error("Error:", cErr.message); process.exit(1); }
  if (!claims || !claims.length) {
    console.log("NO se encontró claim con liquidation_number=L-000001708");
    // Buscar variantes
    const { data: variants } = await supabase
      .from("claims")
      .select("id, liquidation_number, client_reference, disabled")
      .ilike("liquidation_number", "%1708%");
    if (variants && variants.length) {
      console.log("\nVariantes con '1708':");
      for (const v of variants) console.log(`  liquidation=${v.liquidation_number}  ref=${v.client_reference}  disabled=${v.disabled}  id=${v.id}`);
    }
    return;
  }

  const claim = claims[0];
  console.log(`Claim encontrado:`);
  console.log(`  id: ${claim.id}`);
  console.log(`  client_reference: ${claim.client_reference}`);
  console.log(`  claim_number: ${claim.claim_number}`);
  console.log(`  liquidation_number: ${claim.liquidation_number}`);
  console.log(`  disabled: ${claim.disabled}`);
  console.log(`  status: ${claim.status?.name} (${claim.status?.code})`);
  console.log(`  company: ${claim.company?.name} (id=${claim.company_id})`);
  console.log(`  insurance_company: ${claim.insurance_company?.name}`);
  console.log(`  inspector: ${claim.inspector?.full_name} (email=${claim.inspector?.email})`);
  console.log(`  inspector_id: ${claim.inspector_id}`);
  console.log(`  created_at: ${claim.created_at}`);
  console.log(`  updated_at: ${claim.updated_at}`);

  // 2) Buscar sesiones de inspección del claim
  console.log(`\n>>> 2) SESIONES DE INSPECCIÓN DEL CLAIM\n`);
  const { data: sessions, error: sErr } = await supabase
    .from("inspection_sessions")
    .select("id, claim_id, claim_action_id, inspector_id, status, inspection_number, inspection_type, scheduled_at, started_at, ended_at, lock_overridden_by, lock_overridden_at, created_at, updated_at")
    .eq("claim_id", claim.id)
    .order("created_at", { ascending: true });

  if (sErr) { console.error("Error:", sErr.message); }
  if (sessions && sessions.length) {
    console.log(`Sesiones encontradas: ${sessions.length}`);
    for (const s of sessions) {
      console.log(`\n  --- Sesión ${s.inspection_number || s.id} ---`);
      console.log(`  id: ${s.id}`);
      console.log(`  status: ${s.status}`);
      console.log(`  inspection_number: ${s.inspection_number}`);
      console.log(`  inspection_type: ${s.inspection_type}`);
      console.log(`  inspector_id: ${s.inspector_id}`);
      console.log(`  scheduled_at: ${s.scheduled_at}`);
      console.log(`  started_at: ${s.started_at}`);
      console.log(`  ended_at: ${s.ended_at}`);
      console.log(`  claim_action_id: ${s.claim_action_id}`);
      console.log(`  lock_overridden_by: ${s.lock_overridden_by}`);
      console.log(`  lock_overridden_at: ${s.lock_overridden_at}`);
      console.log(`  created_at: ${s.created_at}`);
      console.log(`  updated_at: ${s.updated_at}`);
    }
  } else {
    console.log("NO se encontraron sesiones de inspección para este claim.");
  }

  // 3) Buscar la sesión específica HINS-001
  console.log(`\n>>> 3) BUSCAR SESIÓN ESPECÍFICA HINS-001\n`);
  // HINS-001 podría ser el inspection_number o parte del id
  const { data: hinsSessions } = await supabase
    .from("inspection_sessions")
    .select("id, claim_id, status, inspection_number, inspection_type, inspector_id, scheduled_at, started_at, ended_at, created_at, updated_at")
    .or(`inspection_number.ilike.%HINS-001%,id.ilike.%HINS-001%`)
    .limit(10);
  if (hinsSessions && hinsSessions.length) {
    console.log(`Sesiones con HINS-001:`);
    for (const s of hinsSessions) {
      console.log(`  id=${s.id}  inspection_number=${s.inspection_number}  status=${s.status}  claim_id=${s.claim_id}`);
    }
  } else {
    console.log("No se encontró sesión con 'HINS-001' en inspection_number o id.");
    // Buscar por el claim con inspection_number que contenga 001
    if (sessions && sessions.length) {
      const s001 = sessions.find((s) => (s.inspection_number || "").includes("001"));
      if (s001) {
        console.log(`\nSesión del claim con '001' en inspection_number:`);
        console.log(`  id=${s001.id}  inspection_number=${s001.inspection_number}  status=${s001.status}`);
      }
    }
  }

  // 4) Mensajes de chat de inspección
  console.log(`\n>>> 4) MENSAJES DE CHAT DE INSPECCIÓN\n`);
  if (sessions && sessions.length) {
    for (const s of sessions) {
      const { data: msgs, error: mErr } = await supabase
        .from("inspection_chat_messages")
        .select("id, session_id, sender_id, sender_role, message, message_type, created_at, read_at")
        .eq("session_id", s.id)
        .order("created_at", { ascending: true });
      if (mErr) { console.log(`  Error en sesión ${s.id}: ${mErr.message}`); continue; }
      if (msgs && msgs.length) {
        console.log(`\n  Sesión ${s.inspection_number || s.id} (${s.id}): ${msgs.length} mensajes`);
        for (const m of msgs) {
          console.log(`    [${m.created_at}] sender=${m.sender_role} (${m.sender_id})  type=${m.message_type}  read=${m.read_at || "no"}`);
          console.log(`      msg: ${(m.message || "").substring(0, 100)}`);
        }
      } else {
        console.log(`  Sesión ${s.inspection_number || s.id}: sin mensajes de chat`);
      }
    }
  } else {
    console.log("Sin sesiones — no hay chat que revisar.");
  }

  // 5) Gestiones (claim_actions) del claim
  console.log(`\n>>> 5) GESTIONES (claim_actions) DEL CLAIM\n`);
  const { data: actions } = await supabase
    .from("claim_actions")
    .select("id, claim_id, action_template_id, is_active, assigned_to, created_by, created_on, action_status:lookup_catalog!claim_actions_action_status_id_fkey(code, name)")
    .eq("claim_id", claim.id)
    .order("created_on", { ascending: true });
  if (actions && actions.length) {
    console.log(`Gestiones: ${actions.length}`);
    for (const a of actions) {
      console.log(`  id=${a.id}  is_active=${a.is_active}  status=${a.action_status?.name}  assigned_to=${a.assigned_to}  created_by=${a.created_by}  created_on=${a.created_on}`);
    }
  } else {
    console.log("Sin gestiones.");
  }

  // 6) Participantes del claim (asegurado)
  console.log(`\n>>> 6) PARTICIPANTES DEL CLAIM (asegurado)\n`);
  const { data: participants } = await supabase
    .from("claims_participants")
    .select("id, claim_id, type, full_name, first_name, last_name, email, phone, cell_phone, is_active, linked_to_insured")
    .eq("claim_id", claim.id);
  if (participants && participants.length) {
    for (const p of participants) {
      console.log(`  type=${p.type}  name=${p.full_name}  email=${p.email}  phone=${p.phone}  cell=${p.cell_phone}  is_active=${p.is_active}  linked_to_insured=${p.linked_to_insured}`);
    }
  } else {
    console.log("Sin participantes registrados.");
  }

  // 7) Inspección — buscar por inspection_number exacto
  console.log(`\n>>> 7) BÚSQUEDA POR inspection_number EXACTO\n`);
  // El formato podría ser "L-000001708-HINS-001" como inspection_number completo
  const { data: exactMatch } = await supabase
    .from("inspection_sessions")
    .select("id, claim_id, status, inspection_number, inspection_type, inspector_id, scheduled_at, started_at, ended_at, created_at, updated_at")
    .eq("inspection_number", "L-000001708-HINS-001")
    .maybeSingle();
  if (exactMatch) {
    console.log(`ENCONTRADO por inspection_number exacto:`);
    console.log(JSON.stringify(exactMatch, null, 2));
  } else {
    console.log("No encontrado por inspection_number='L-000001708-HINS-001'");
    // Probar variantes
    const { data: likeMatch } = await supabase
      .from("inspection_sessions")
      .select("id, claim_id, status, inspection_number, inspection_type, created_at")
      .ilike("inspection_number", "%L-000001708%")
      .limit(10);
    if (likeMatch && likeMatch.length) {
      console.log("\nVariantes con 'L-000001708':");
      for (const s of likeMatch) console.log(`  inspection_number=${s.inspection_number}  status=${s.status}  claim_id=${s.claim_id}  id=${s.id}`);
    }
  }

  // 8) Notas de inspección
  console.log(`\n>>> 8) NOTAS DE INSPECCIÓN\n`);
  if (sessions && sessions.length) {
    for (const s of sessions) {
      const { data: notes } = await supabase
        .from("inspection_notes")
        .select("id, session_id, note_type, content, created_by, created_at")
        .eq("session_id", s.id)
        .order("created_at", { ascending: true });
      if (notes && notes.length) {
        console.log(`  Sesión ${s.inspection_number || s.id}: ${notes.length} notas`);
        for (const n of notes) {
          console.log(`    [${n.created_at}] type=${n.note_type}  by=${n.created_by}  content="${(n.content || "").substring(0, 80)}"`);
        }
      }
    }
  }

  // 9) Firmas de inspección
  console.log(`\n>>> 9) FIRMAS DE INSPECCIÓN\n`);
  if (sessions && sessions.length) {
    for (const s of sessions) {
      const { data: sigs } = await supabase
        .from("inspection_signatures")
        .select("id, session_id, signer_type, signer_name, signed_at, created_at")
        .eq("session_id", s.id);
      if (sigs && sigs.length) {
        console.log(`  Sesión ${s.inspection_number || s.id}: ${sigs.length} firmas`);
        for (const sg of sigs) {
          console.log(`    signer_type=${sg.signer_type}  name=${sg.signer_name}  signed_at=${sg.signed_at}`);
        }
      }
    }
  }

  // 10) Evidencias
  console.log(`\n>>> 10) EVIDENCIAS DE INSPECCIÓN\n`);
  if (sessions && sessions.length) {
    for (const s of sessions) {
      const { data: evidences } = await supabase
        .from("inspection_evidences")
        .select("id, session_id, evidence_type, file_name, created_at")
        .eq("session_id", s.id);
      if (evidences && evidences.length) {
        console.log(`  Sesión ${s.inspection_number || s.id}: ${evidences.length} evidencias`);
      }
    }
  }

  console.log(`\n${"=".repeat(90)}`);
  console.log("FIN DEL ANÁLISIS");
  console.log(`${"=".repeat(90)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
