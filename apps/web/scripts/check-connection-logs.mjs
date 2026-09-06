// Verificar estructura y datos de magic_link_connection_logs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const key = match ? match[1].trim() : "";
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const url = urlMatch ? urlMatch[1].trim() : "";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Estructura
  const { data: sample } = await supabase
    .from("magic_link_connection_logs")
    .select("*")
    .limit(1);
  if (sample && sample.length > 0) {
    console.log("Columnas:", Object.keys(sample[0]).join(", "));
  } else {
    console.log("Sin datos. Probando insert vacío para ver columnas...");
  }

  // 2. Total de logs
  const { count } = await supabase
    .from("magic_link_connection_logs")
    .select("*", { count: "exact", head: true });
  console.log("\nTotal logs:", count);

  // 3. Logs recientes
  const { data: recent } = await supabase
    .from("magic_link_connection_logs")
    .select("id, session_id, role, status, ip_address, city, country, device_type, browser, os, connected_at, disconnected_at")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("\nLogs recientes:");
  if (recent) {
    recent.forEach((l) => {
      console.log("  -", l.connected_at, "role:", l.role, "status:", l.status, "ip:", l.ip_address, "city:", l.city, "device:", l.device_type, "browser:", l.browser);
    });
  }

  // 4. Verificar si hay IPs duplicadas (magic link compartido)
  const { data: allLogs } = await supabase
    .from("magic_link_connection_logs")
    .select("session_id, ip_address, city, country, role, connected_at")
    .not("ip_address", "is", null)
    .order("connected_at", { ascending: false })
    .limit(200);
  if (allLogs) {
    const bySession = {};
    allLogs.forEach((l) => {
      if (!bySession[l.session_id]) bySession[l.session_id] = new Set();
      if (l.ip_address) bySession[l.session_id].add(l.ip_address);
    });
    const duplicates = Object.entries(bySession).filter(([, ips]) => ips.size > 1);
    console.log("\nSesiones con múltiples IPs (" + duplicates.length + "):");
    duplicates.slice(0, 5).forEach(([sid, ips]) => {
      console.log("  -", sid, "IPs:", Array.from(ips).join(", "));
    });
  }
}

main().catch(console.error);
