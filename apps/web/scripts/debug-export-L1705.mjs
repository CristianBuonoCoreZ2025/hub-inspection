// Debug específico para L-000001705
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..", "..");

// Leer .env.production
const envFile = readFileSync(resolve(root, ".env.production"), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

// Cliente con service role para debug
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1) Buscar el claim por liquidation_number
  console.log(`\n=== 1) BUSCAR CLAIM L-000001705 ===\n`);
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, liquidation_number, claim_number, status_id, created_at")
    .eq("liquidation_number", "L-000001705")
    .limit(1);
  if (claimErr) {
    console.log(`Error: ${claimErr.message}`);
    return;
  }
  if (!claim || claim.length === 0) {
    console.log("No se encontró el claim con liquidation_number=L-000001705");
    // Probar sin el guion
    const { data: claim2 } = await supabase
      .from("claims")
      .select("id, liquidation_number")
      .ilike("liquidation_number", "%1705%")
      .limit(5);
    console.log(`Búsqueda fuzzy:`, claim2);
    return;
  }
  const claimId = claim[0].id;
  console.log(`  id=${claimId}`);
  console.log(`  liquidation_number=${claim[0].liquidation_number}`);
  console.log(`  claim_number=${claim[0].claim_number}`);
  console.log(`  created_at=${claim[0].created_at}`);

  // 2) Buscar inspection_sessions para este claim
  console.log(`\n=== 2) INSPECTION_SESSIONS ===\n`);
  const { data: sessions, error: sErr } = await supabase
    .from("inspection_sessions")
    .select("id, claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: false });
  if (sErr) {
    console.log(`Error: ${sErr.message}`);
  } else if (sessions && sessions.length > 0) {
    console.log(`Encontradas ${sessions.length} sesiones:`);
    for (const s of sessions) {
      console.log(`  id=${s.id.substring(0, 8)}...  status=${s.status}  type=${s.inspection_type}  scheduled=${s.scheduled_at}  started=${s.started_at}  ended=${s.ended_at}  created=${s.created_at}`);
    }
  } else {
    console.log("Sin sesiones de inspección.");
  }

  // 3) Buscar claim_actions CIN para este claim
  console.log(`\n=== 3) CLAIM_ACTIONS CIN ===\n`);
  const CIN_TEMPLATE_IDS = [
    "b2000002-0000-0000-0000-000000000001",
    "b2000001-0000-0000-0000-000000000001",
  ];
  const { data: cinActions, error: cinErr } = await supabase
    .from("claim_actions")
    .select("id, claim_id, issued_on, action_template_id, action_status_id")
    .eq("claim_id", claimId)
    .in("action_template_id", CIN_TEMPLATE_IDS)
    .not("issued_on", "is", null)
    .order("issued_on", { ascending: false });
  if (cinErr) {
    console.log(`Error: ${cinErr.message}`);
  } else if (cinActions && cinActions.length > 0) {
    console.log(`Encontradas ${cinActions.length} acciones CIN:`);
    for (const a of cinActions) {
      console.log(`  id=${a.id.substring(0, 8)}...  issued_on=${a.issued_on}  template_id=${a.action_template_id?.substring(0, 8)}...`);
    }
  } else {
    console.log("Sin acciones CIN con esos template_ids.");

    // Buscar TODAS las claim_actions del claim para ver qué template_ids tienen
    console.log(`\n=== 3b) TODAS LAS CLAIM_ACTIONS DEL CLAIM ===\n`);
    const { data: allActions } = await supabase
      .from("claim_actions")
      .select("id, issued_on, action_template_id, action_data")
      .eq("claim_id", claimId)
      .not("issued_on", "is", null)
      .order("issued_on", { ascending: false })
      .limit(10);
    if (allActions && allActions.length > 0) {
      for (const a of allActions) {
        const tplId = a.action_template_id;
        // Buscar el template code
        const { data: tpl } = await supabase
          .from("action_template")
          .select("code, name")
          .eq("id", tplId)
          .limit(1);
        console.log(`  id=${a.id.substring(0, 8)}...  issued_on=${a.issued_on}  template_id=${tplId?.substring(0, 8)}...  template_code=${tpl?.[0]?.code || "?"}  template_name=${tpl?.[0]?.name || "?"}`);
      }
    } else {
      console.log("Sin claim_actions emitidas.");
    }
  }

  // 4) Probar con .in() como lo hace el código del export
  console.log(`\n=== 4) QUERY EXACTA DEL EXPORT (.in() con [claimId]) ===\n`);
  const { data: sessionsIn, error: sInErr } = await supabase
    .from("inspection_sessions")
    .select("claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
    .in("claim_id", [claimId])
    .order("created_at", { ascending: false });
  if (sInErr) {
    console.log(`Error sessions: ${sInErr.message}`);
  } else {
    console.log(`Sessions con .in(): ${sessionsIn?.length || 0}`);
    if (sessionsIn) {
      for (const s of sessionsIn) {
        console.log(`  claim_id=${s.claim_id?.substring(0, 8)}...  status=${s.status}  type=${s.inspection_type}  scheduled=${s.scheduled_at}`);
      }
    }
  }

  const { data: cinIn, error: cinInErr } = await supabase
    .from("claim_actions")
    .select("claim_id, issued_on, action_template_id")
    .in("claim_id", [claimId])
    .in("action_template_id", CIN_TEMPLATE_IDS)
    .not("issued_on", "is", null)
    .order("issued_on", { ascending: false });
  if (cinInErr) {
    console.log(`Error CIN: ${cinInErr.message}`);
  } else {
    console.log(`CIN con .in(): ${cinIn?.length || 0}`);
    if (cinIn) {
      for (const a of cinIn) {
        console.log(`  claim_id=${a.claim_id?.substring(0, 8)}...  issued_on=${a.issued_on}`);
      }
    }
  }

  // 5) Verificar con la ANON key (como el navegador)
  console.log(`\n=== 5) PROBAR CON ANON KEY (como el navegador) ===\n`);
  const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionsAnon, error: sAnonErr } = await supabaseAnon
    .from("inspection_sessions")
    .select("claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
    .in("claim_id", [claimId])
    .order("created_at", { ascending: false });
  if (sAnonErr) {
    console.log(`Error sessions (anon): ${sAnonErr.message}`);
    console.log(`Code: ${sAnonErr.code}, Details: ${sAnonErr.details}, Hint: ${sAnonErr.hint}`);
  } else {
    console.log(`Sessions (anon): ${sessionsAnon?.length || 0}`);
    if (sessionsAnon) {
      for (const s of sessionsAnon) {
        console.log(`  status=${s.status}  type=${s.inspection_type}  scheduled=${s.scheduled_at}`);
      }
    }
  }

  const { data: cinAnon, error: cinAnonErr } = await supabaseAnon
    .from("claim_actions")
    .select("claim_id, issued_on, action_template_id")
    .in("claim_id", [claimId])
    .in("action_template_id", CIN_TEMPLATE_IDS)
    .not("issued_on", "is", null)
    .order("issued_on", { ascending: false });
  if (cinAnonErr) {
    console.log(`Error CIN (anon): ${cinAnonErr.message}`);
    console.log(`Code: ${cinAnonErr.code}, Details: ${cinAnonErr.details}, Hint: ${cinAnonErr.hint}`);
  } else {
    console.log(`CIN (anon): ${cinAnon?.length || 0}`);
    if (cinAnon) {
      for (const a of cinAnon) {
        console.log(`  issued_on=${a.issued_on}`);
      }
    }
  }
}

main().catch(console.error);
