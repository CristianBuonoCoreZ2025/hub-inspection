// Verificar políticas RLS en claims_participants
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
  // Verificar RLS habilitado en claims_participants
  const { data: rlsInfo, error } = await supabase.rpc("to_jsonb", {
    p_query: `
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('claims_participants', 'claims', 'inspection_sessions', 'claim_actions')
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `
  });

  // Probar query directa a pg_class
  const { data: pgClass, error: pgErr } = await supabase
    .from("pg_class")
    .select("relname, relrowsecurity")
    .in("relname", ["claims_participants", "claims", "inspection_sessions", "claim_actions"]);

  // Si no funciona, usar una query SQL via rpc
  console.log(`--- Verificando RLS ---`);

  // Verificar si claims_participants tiene RLS probando con un usuario autenticado
  // Primero veamos si hay políticas
  const { data: policies, error: polErr } = await supabase
    .rpc("exec_sql", { sql_text: "SELECT polname, polcmd, qual FROM pg_policy WHERE polrelid = 'public.claims_participants'::regclass" });

  if (policies) {
    console.log(`Políticas en claims_participants: ${policies.length}`);
    for (const p of policies) {
      console.log(`  ${JSON.stringify(p)}`);
    }
  }

  // Verificar con anon key si claims_participants devuelve algo
  const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Probar con un claim que SABEMOS tiene participants
  const { data: testAnon, error: testErr } = await supabaseAnon
    .from("claims_participants")
    .select("id, claim_id, type, full_name")
    .eq("claim_id", "ce23a338-bbd4-449d-b68e-04ce148c91a3")
    .limit(5);
  console.log(`\nclaims_participants con anon key (sin sesión): ${testAnon?.length || 0} filas`);
  if (testErr) console.log(`Error: ${testErr.message}`);

  // Verificar si la grilla funciona porque el usuario está autenticado
  // El cliente del navegador usa cookies de sesión, no la anon key pura
  // Vamos a verificar si hay una política que permita lectura a usuarios autenticados

  // Verificar claims con anon key
  const { data: claimsAnon, error: claimsErr } = await supabaseAnon
    .from("claims")
    .select("id, liquidation_number")
    .eq("liquidation_number", "L-000000174")
    .limit(1);
  console.log(`\nclaims con anon key (sin sesión): ${claimsAnon?.length || 0} filas`);
  if (claimsErr) console.log(`Error: ${claimsErr.message}`);

  // El problema podría ser que getClaimsParticipants hace fetch con el cliente
  // del navegador que tiene la sesión del usuario, pero RLS filtra por company_id
  // y algunos claims no coinciden

  // Verificar si getClaimsParticipants en la grilla funciona para L-174
  // pero falla para otros. Vamos a ver cuántos participants hay en total
  const { count: totalParticipants } = await supabase
    .from("claims_participants")
    .select("id", { count: "exact", head: true });
  console.log(`\nTotal claims_participants: ${totalParticipants}`);

  // Verificar cuántos claims tienen participants
  const { data: claimsWithParticipants } = await supabase
    .from("claims_participants")
    .select("claim_id")
    .limit(1000);
  const uniqueClaims = new Set(claimsWithParticipants?.map(p => p.claim_id) || []);
  console.log(`Claims con participants (primeros 1000): ${uniqueClaims.size}`);

  // Verificar si L-174 está en la lista
  console.log(`L-174 tiene participants: ${uniqueClaims.has("ce23a338-bbd4-449d-b68e-04ce148c91a3")}`);
}

main().catch(console.error);
