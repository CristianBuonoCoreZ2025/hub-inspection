import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = readFileSync(".env.production", "utf-8");
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const url = urlMatch ? urlMatch[1].trim() : "";
const anonKey = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, anonKey);

async function main() {
  console.log("URL:", url);
  console.log("Key:", anonKey?.slice(0, 20) + "...");

  // 1. Probar RPC con internal_number '1314'
  console.log("\n=== Test RPC '1314' ===");
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_inspection_sessions_ordered_v3",
    {
      p_page: 1,
      p_page_size: 50,
      p_status_filter: null,
      p_inspector_filter: null,
      p_internal_number: "1314",
      p_sort_column: "created_at",
      p_sort_dir: "desc",
    }
  );
  if (rpcError) {
    console.error("RPC Error:", rpcError);
  } else {
    console.log("RPC rows:", rpcData?.length, "total:", rpcData?.[0]?.total_count);
    console.log("First 3 IDs:", rpcData?.slice(0, 3).map(r => r.id));
  }

  // 2. Probar sin filtro
  console.log("\n=== Test RPC sin filtro ===");
  const { data: rpcData2, error: rpcError2 } = await supabase.rpc(
    "get_inspection_sessions_ordered_v3",
    {
      p_page: 1,
      p_page_size: 5,
      p_status_filter: null,
      p_inspector_filter: null,
      p_internal_number: null,
      p_sort_column: "created_at",
      p_sort_dir: "desc",
    }
  );
  if (rpcError2) {
    console.error("RPC Error:", rpcError2);
  } else {
    console.log("RPC rows:", rpcData2?.length, "total:", rpcData2?.[0]?.total_count);
  }

  // 3. Verificar qué columnas tiene claims
  console.log("\n=== Verificar claims.liquidation_number e internal_number ===");
  const { data: claimData, error: claimError } = await supabase
    .from("claims")
    .select("id, liquidation_number, internal_number")
    .ilike("liquidation_number", "%1314%")
    .limit(3);
  if (claimError) {
    console.error("Claims Error:", claimError);
  } else {
    console.log("Claims con 1314 en liquidation_number:", claimData?.length);
    claimData?.forEach(c => console.log("  -", c.id, c.liquidation_number, c.internal_number));
  }

  const { data: claimData2, error: claimError2 } = await supabase
    .from("claims")
    .select("id, liquidation_number, internal_number")
    .ilike("internal_number", "%1314%")
    .limit(3);
  if (claimError2) {
    console.error("Claims Error:", claimError2);
  } else {
    console.log("Claims con 1314 en internal_number:", claimData2?.length);
    claimData2?.forEach(c => console.log("  -", c.id, c.liquidation_number, c.internal_number));
  }
}

main().catch(console.error);
