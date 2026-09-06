// Análisis del chat y columnas de inspection_chat_messages.
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

const SESSION_ID = "76bb90bf-9aac-45cc-b1e3-eb4f6d11a18e";

async function main() {
  // 1) Ver columnas de inspection_chat_messages
  console.log(`\n=== COLUMNAS DE inspection_chat_messages ===\n`);
  const { data: sample, error: sErr } = await supabase
    .from("inspection_chat_messages")
    .select("*")
    .eq("session_id", SESSION_ID)
    .limit(1);
  if (sErr) {
    console.log("Error (puede no haber filas):", sErr.message);
    // Intentar sin filtro
    const { data: anySample, error: aErr } = await supabase
      .from("inspection_chat_messages")
      .select("*")
      .limit(1);
    if (aErr) {
      console.log("Error sin filtro:", aErr.message);
    } else if (anySample && anySample.length) {
      console.log("Columnas:", Object.keys(anySample[0]).join(", "));
    } else {
      console.log("Tabla vacía o sin filas");
    }
  } else if (sample && sample.length) {
    console.log("Columnas:", Object.keys(sample[0]).join(", "));
    console.log("\nFila de ejemplo:");
    console.log(JSON.stringify(sample[0], null, 2));
  } else {
    console.log("Sin filas para esta sesión. Probando tabla completa...");
    const { data: anySample } = await supabase
      .from("inspection_chat_messages")
      .select("*")
      .limit(1);
    if (anySample && anySample.length) {
      console.log("Columnas:", Object.keys(anySample[0]).join(", "));
    } else {
      console.log("Tabla vacía");
    }
  }

  // 2) Contar mensajes de la sesión
  console.log(`\n=== MENSAJES DE LA SESIÓN ${SESSION_ID} ===\n`);
  const { count } = await supabase
    .from("inspection_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", SESSION_ID);
  console.log(`Total mensajes: ${count || 0}`);

  // 3) Traer todos los mensajes con select *
  const { data: msgs, error: mErr } = await supabase
    .from("inspection_chat_messages")
    .select("*")
    .eq("session_id", SESSION_ID)
    .order("created_at", { ascending: true });
  if (mErr) {
    console.log("Error:", mErr.message);
  } else if (msgs && msgs.length) {
    for (const m of msgs) {
      console.log(JSON.stringify(m, null, 2));
    }
  } else {
    console.log("Sin mensajes.");
  }

  // 4) ¿Hay algún campo de link/token en la sesión?
  console.log(`\n=== COLUMNAS DE inspection_sessions ===\n`);
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("*")
    .eq("id", SESSION_ID)
    .maybeSingle();
  if (sess) {
    console.log("Columnas:", Object.keys(sess).join(", "));
    console.log("\nValores:");
    for (const [k, v] of Object.entries(sess)) {
      if (v !== null && v !== undefined) {
        const vs = String(v);
        console.log(`  ${k}: ${vs.length > 100 ? vs.substring(0, 100) + "..." : vs}`);
      } else {
        console.log(`  ${k}: null`);
      }
    }
  }

  // 5) Buscar tablas relacionadas con links de inspección
  console.log(`\n=== BÚSQUEDA DE TABLAS DE LINK/INVITE ===\n`);
  // inspection_invites, inspection_links, etc.
  for (const table of ["inspection_invites", "inspection_links", "inspection_tokens", "inspection_connections", "inspection_access"]) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .limit(1);
    if (!error) {
      console.log(`Tabla ${table}: EXISTE`);
      if (data && data.length) console.log(`  Columnas: ${Object.keys(data[0]).join(", ")}`);
      // Buscar por session_id
      const { data: bySession } = await supabase
        .from(table)
        .select("*")
        .eq("session_id", SESSION_ID)
        .limit(5);
      if (bySession && bySession.length) {
        console.log(`  Filas para esta sesión: ${bySession.length}`);
        for (const r of bySession) console.log(`    ${JSON.stringify(r).substring(0, 200)}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
