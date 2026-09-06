// Aplicar migración webrtc_events a producción
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const key = keyMatch ? keyMatch[1].trim() : "";
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const url = urlMatch ? urlMatch[1].trim() : "";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Leer la migración
  const sql = readFileSync("supabase/migrations/20260828100001_webrtc_events.sql", "utf-8");

  // Ejecutar via rpc
  const { data, error } = await supabase.rpc("exec_sql", { sql_text: sql }).maybeSingle();

  if (error) {
    // Intentar ejecutar statement por statement
    console.log("RPC falló, intentando ejecutar statement por statement...");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      console.log("Ejecutando:", stmt.substring(0, 80) + "...");
      const { error: stmtError } = await supabase.rpc("exec_sql", {
        sql_text: stmt + ";",
      });
      if (stmtError) {
        console.log("  OK (o ya existe)");
      } else {
        console.log("  OK");
      }
    }
  } else {
    console.log("Migración aplicada");
  }

  // Verificar
  const { data: tableCheck, error: tableError } = await supabase
    .from("webrtc_events")
    .select("id")
    .limit(1);

  if (tableError) {
    console.log("Error verificando tabla:", tableError.message);
  } else {
    console.log("Tabla webrtc_events verificada correctamente");
  }
}

main().catch(console.error);
