import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.production", "utf-8");
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Probar funciones RPC disponibles
  const funcs = ["pg_exec", "exec_sql", "exec", "run_sql", "query"];
  for (const fn of funcs) {
    const { error } = await supabase.rpc(fn, { query: "SELECT 1", sql: "SELECT 1", sql_text: "SELECT 1" });
    console.log(fn + ":", error ? error.message.substring(0, 60) : "OK");
  }
}

main().catch(console.error);
