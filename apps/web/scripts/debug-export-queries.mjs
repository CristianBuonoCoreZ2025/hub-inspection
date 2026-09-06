// Debug: verifica si las queries de inspection_sessions y claim_actions (CIN)
// devuelven datos desde el cliente de Supabase.
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

// Usar la service role key para debug
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1) Tomar 5 claim IDs que tengan sesiones de inspección
  console.log(`\n=== 1) INSPECTION_SESSIONS (últimas 5) ===\n`);
  const { data: sessions, error: sErr } = await supabase
    .from("inspection_sessions")
    .select("claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (sErr) {
    console.log(`Error: ${sErr.message}`);
  } else if (sessions && sessions.length) {
    for (const s of sessions) {
      console.log(`  claim_id=${s.claim_id}  status=${s.status}  type=${s.inspection_type}  scheduled=${s.scheduled_at}  started=${s.started_at}  ended=${s.ended_at}`);
    }
  } else {
    console.log("Sin datos.");
  }

  // 2) Con los claim_ids obtenidos, probar la query con .in()
  const claimIds = sessions?.map((s) => s.claim_id).filter(Boolean) ?? [];
  if (claimIds.length > 0) {
    console.log(`\n=== 2) QUERY CON .in() PARA ${claimIds.length} CLAIMS ===\n`);
    const { data: sessionsIn, error: inErr } = await supabase
      .from("inspection_sessions")
      .select("claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
      .in("claim_id", claimIds)
      .order("created_at", { ascending: false });
    if (inErr) {
      console.log(`Error: ${inErr.message}`);
    } else {
      console.log(`Devueltas: ${sessionsIn?.length || 0} sesiones`);
      if (sessionsIn) {
        // Verificar que la lógica de "primero por claim" funciona
        const byClaim = {};
        for (const s of sessionsIn) {
          if (!byClaim[s.claim_id]) {
            byClaim[s.claim_id] = s;
          }
        }
        console.log(`Claims únicos con sesión: ${Object.keys(byClaim).length}`);
        for (const [cid, s] of Object.entries(byClaim)) {
          console.log(`  ${cid.substring(0, 8)}...  status=${s.status}  type=${s.inspection_type}  scheduled=${s.scheduled_at?.substring(0, 10)}`);
        }
      }
    }
  }

  // 3) Probar la query de CIN con join a action_template
  console.log(`\n=== 3) CLAIM_ACTIONS CIN (últimas 5) ===\n`);
  const { data: cinActions, error: cinErr } = await supabase
    .from("claim_actions")
    .select(`
      claim_id, issued_on,
      action_template:action_template(code)
    `)
    .not("issued_on", "is", null)
    .order("issued_on", { ascending: false })
    .limit(10);
  if (cinErr) {
    console.log(`Error: ${cinErr.message}`);
  } else if (cinActions && cinActions.length) {
    for (const a of cinActions) {
      const tpl = a.action_template;
      console.log(`  claim_id=${a.claim_id?.substring(0, 8)}...  issued_on=${a.issued_on}  template_code=${tpl?.code}`);
    }
    // Filtrar solo CIN
    const cinOnly = cinActions.filter((a) => {
      const tpl = a.action_template;
      return tpl?.code === "CIN";
    });
    console.log(`\nSolo CIN: ${cinOnly.length} de ${cinActions.length}`);
  } else {
    console.log("Sin datos.");
  }

  // 4) Probar con .in() para los mismos claim_ids
  if (claimIds.length > 0) {
    console.log(`\n=== 4) CIN CON .in() PARA ${claimIds.length} CLAIMS ===\n`);
    const { data: cinIn, error: cinInErr } = await supabase
      .from("claim_actions")
      .select(`
        claim_id, issued_on,
        action_template:action_template(code)
      `)
      .in("claim_id", claimIds)
      .not("issued_on", "is", null)
      .order("issued_on", { ascending: false });
    if (cinInErr) {
      console.log(`Error: ${cinInErr.message}`);
    } else {
      console.log(`Devueltas: ${cinIn?.length || 0} acciones`);
      if (cinIn) {
        const cinByClaim = {};
        for (const a of cinIn) {
          const tpl = a.action_template;
          if (tpl?.code === "CIN" && !cinByClaim[a.claim_id]) {
            cinByClaim[a.claim_id] = a.issued_on;
          }
        }
        console.log(`Claims con CIN: ${Object.keys(cinByClaim).length}`);
        for (const [cid, date] of Object.entries(cinByClaim)) {
          console.log(`  ${cid.substring(0, 8)}...  CIN issued_on=${date}`);
        }
      }
    }
  }

  // 5) Verificar si el problema es el join de action_template
  console.log(`\n=== 5) SIN JOIN — claim_actions directo ===\n`);
  const { data: rawActions, error: rawErr } = await supabase
    .from("claim_actions")
    .select("claim_id, issued_on, action_template_id")
    .not("issued_on", "is", null)
    .order("issued_on", { ascending: false })
    .limit(5);
  if (rawErr) {
    console.log(`Error: ${rawErr.message}`);
  } else if (rawActions) {
    for (const a of rawActions) {
      console.log(`  claim_id=${a.claim_id?.substring(0, 8)}...  issued_on=${a.issued_on}  template_id=${a.action_template_id?.substring(0, 8)}...`);
    }
  }

  // 6) Verificar el action_template_id del CIN
  console.log(`\n=== 6) ACTION_TEMPLATE con code=CIN ===\n`);
  const { data: cinTemplates, error: tplErr } = await supabase
    .from("action_template")
    .select("id, code, name")
    .eq("code", "CIN")
    .limit(5);
  if (tplErr) {
    console.log(`Error: ${tplErr.message}`);
  } else if (cinTemplates) {
    for (const t of cinTemplates) {
      console.log(`  id=${t.id}  code=${t.code}  name=${t.name}`);
    }
  }
}

main().catch(console.error);
