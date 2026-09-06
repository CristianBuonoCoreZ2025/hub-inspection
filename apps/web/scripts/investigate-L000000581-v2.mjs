// Investigar L-000000581-HINS-001 — conexión y grabación
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
  const sessionId = "8068ce49-9c54-4fad-8944-0af29aa7791a";

  // 1. Connection logs
  console.log("=== Connection logs ===");
  const { data: logs, error: errLogs } = await supabase
    .from("connection_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (errLogs) {
    console.log("Error:", errLogs.message);
  } else if (logs && logs.length > 0) {
    logs.forEach((l) => {
      console.log("  -", l.created_at, "event:", l.event_type, "user:", l.user_id, "role:", l.role, "details:", JSON.stringify(l.details || {}).substring(0, 200));
    });
  } else {
    console.log("  Sin connection logs");
  }

  // 2. Evidences — agrupar por source
  console.log("\n=== Evidences por source ===");
  const { data: evidences } = await supabase
    .from("inspection_evidences")
    .select("id, source, mime_type, file_size, created_at, original_name")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (evidences) {
    const bySource = {};
    evidences.forEach((e) => {
      const src = e.source || "unknown";
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push(e);
    });
    Object.keys(bySource).forEach((src) => {
      console.log("  " + src + ": " + bySource[src].length + " evidences");
      // Mostrar primera y última
      const arr = bySource[src];
      if (arr.length > 0) {
        console.log("    Primera:", arr[0].created_at, "name:", arr[0].original_name);
        console.log("    Última:", arr[arr.length - 1].created_at, "name:", arr[arr.length - 1].original_name);
      }
    });

    // Verificar si hay alguna con source=live_video
    const recordings = evidences.filter((e) => e.source === "live_video");
    console.log("\n  Grabaciones live_video: " + recordings.length);
  }

  // 3. Chat messages — ver detalles completos
  console.log("\n=== Chat messages ===");
  const { data: messages } = await supabase
    .from("inspection_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(30);
  if (messages && messages.length > 0) {
    messages.forEach((m) => {
      console.log("  -", m.created_at, "sender:", m.sender_id, "role:", m.sender_role, "type:", m.message_type, "text:", (m.message || "").substring(0, 100));
    });
  } else {
    console.log("  Sin mensajes");
  }

  // 4. Verificar el claim
  console.log("\n=== Claim ===");
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("claim_id, inspector_id, magic_link_token, status, started_at, ended_at")
    .eq("id", sessionId)
    .single();
  if (sess) {
    console.log("  claim_id:", sess.claim_id);
    console.log("  inspector_id:", sess.inspector_id);
    console.log("  magic_link_token:", sess.magic_link_token);
    console.log("  status:", sess.status);
    console.log("  started_at:", sess.started_at);
    console.log("  ended_at:", sess.ended_at);

    // Buscar el claim
    const { data: claim } = await supabase
      .from("claims")
      .select("claim_number, company_id")
      .eq("id", sess.claim_id)
      .single();
    if (claim) {
      console.log("  claim_number:", claim.claim_number);
    }

    // Buscar el inspector
    const { data: inspector } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", sess.inspector_id)
      .single();
    if (inspector) {
      console.log("  inspector:", inspector.full_name, inspector.email);
    }
  }

  // 5. Verificar si hubo presign requests (buscar en audit_logs o similar)
  console.log("\n=== Audit logs ===");
  const { data: audit, error: errAudit } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("session_id", sessionId)
    .limit(10);
  if (errAudit) {
    console.log("  Error:", errAudit.message);
  } else if (audit && audit.length > 0) {
    audit.forEach((a) => console.log("  -", a.created_at, a.action, JSON.stringify(a).substring(0, 200)));
  } else {
    console.log("  Sin audit logs");
  }
}

main().catch(console.error);
