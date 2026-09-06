import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = readFileSync(".env.production", "utf-8");
const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim() || anonKey;
const supabase = createClient(url, serviceKey);

const SESSION_SELECT = "*";

async function searchInspections(q, page = 1, pageSize = 50) {
  // 1. Buscar IDs via RPC
  const { data: searchData, error: searchErr } = await supabase.rpc("search_inspection_sessions_unaccent", { p_q: q });
  if (searchErr) throw new Error(searchErr.message);
  const ids = (searchData || []).map((r) => r.session_id);
  console.log(`[q="${q}"] RPC encontro ${ids.length} IDs`);

  if (ids.length === 0) return { sessions: [], total: 0 };

  // 2. Contar total
  const { count, error: countErr } = await supabase
    .from("inspection_sessions")
    .select("id", { count: "exact", head: true })
    .in("id", ids);
  if (countErr) throw new Error(countErr.message);
  console.log(`  count: ${count}`);

  // 3. Traer pagina
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from("inspection_sessions")
    .select(`${SESSION_SELECT}, claim:claims!inspection_sessions_claim_id_fkey(claim_number, liquidation_number, internal_number, client_reference, claim_address, claims_participants:claims_participants!claim_participants_claim_id_fkey(type, full_name)), claim_action:claim_actions!inspection_sessions_claim_action_id_fkey(code)`)
    .in("id", ids)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  console.log(`  pagina ${page}: ${data?.length} sesiones`);
  data?.slice(0, 3).forEach((s) => {
    const liq = s.claim?.liquidation_number || "—";
    const internal = s.claim?.internal_number || "—";
    const ref = s.claim?.client_reference || "—";
    const insured = s.claim?.claims_participants?.[0]?.full_name || "—";
    const addr = s.claim?.claim_address || "—";
    const code = s.claim_action?.code || "—";
    console.log(`    liq=${liq} internal=${internal} ref=${ref} insured=${insured} addr=${addr} code=${code}`);
  });

  return { sessions: data, total: count };
}

async function main() {
  console.log("=== Test '1314' (liquidation_number) ===");
  await searchInspections("1314");

  console.log("\n=== Test '100' (multiple) ===");
  await searchInspections("100");

  console.log("\n=== Test 'juan' (nombre asegurado) ===");
  await searchInspections("juan");

  console.log("\n=== Test 'pending' (estado) ===");
  await searchInspections("pending");

  console.log("\n=== Test 'avenida' (direccion) ===");
  await searchInspections("avenida");
}

main().catch(console.error);
