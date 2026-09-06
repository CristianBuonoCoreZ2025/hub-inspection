// Investigar L-000000581-HINS-001 — buscar por inspection_number
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

async function investigateSession(sessionId) {
  console.log("\n=== Sesión " + sessionId + " ===");

  // Datos de la sesión
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sess) {
    console.log("Status:", sess.status);
    console.log("Inspection number:", sess.inspection_number);
    console.log("Started at:", sess.started_at);
    console.log("Ended at:", sess.ended_at);
    console.log("Inspector_id:", sess.inspector_id);
    console.log("Claim_id:", sess.claim_id);
    console.log("Active tab:", sess.active_tab);
    console.log("Substate:", sess.substate);
  }

  // Evidencias
  const { data: evidences } = await supabase
    .from("inspection_evidences")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  console.log("\nEvidencias (" + (evidences?.length || 0) + "):");
  if (evidences && evidences.length > 0) {
    evidences.forEach((e) => {
      console.log("  - id:", e.id, "source:", e.source, "mime:", e.mime_type, "size:", e.file_size, "url:", (e.url || "").substring(0, 80));
    });
  } else {
    console.log("  SIN evidencias");
  }

  // Grabaciones
  const { data: recordings } = await supabase
    .from("inspection_evidences")
    .select("*")
    .eq("session_id", sessionId)
    .eq("source", "live_video");
  console.log("Grabaciones live_video (" + (recordings?.length || 0) + ")");

  // Chat
  const { data: messages } = await supabase
    .from("inspection_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(30);
  console.log("\nMensajes chat (" + (messages?.length || 0) + "):");
  if (messages) {
    messages.forEach((m) => {
      const text = (m.message || m.text || "").substring(0, 80);
      const type = m.type || m.message_type || "";
      console.log("  -", m.created_at, "role:", m.sender_role, "type:", type, "text:", text);
    });
  }

  // Daños
  const { data: damages } = await supabase
    .from("inspection_damages")
    .select("*")
    .eq("session_id", sessionId);
  console.log("\nDaños (" + (damages?.length || 0) + ")");

  // Notas
  const { data: notes } = await supabase
    .from("inspection_notes")
    .select("*")
    .eq("session_id", sessionId);
  console.log("Notas (" + (notes?.length || 0) + ")");
}

async function main() {
  // 1. Buscar por inspection_number que contenga "581"
  console.log("=== Buscar por inspection_number ===");
  const { data: byInspNum, error: err1 } = await supabase
    .from("inspection_sessions")
    .select("id, inspection_number, status, claim_id, started_at, ended_at, created_at")
    .ilike("inspection_number", "%581%")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Por inspection_number con 581:", JSON.stringify(byInspNum, null, 2));
  if (err1) console.log("Error:", err1.message);

  // 2. Buscar por inspection_number que contenga "HINS"
  console.log("\n=== Buscar por HINS ===");
  const { data: byHins, error: err2 } = await supabase
    .from("inspection_sessions")
    .select("id, inspection_number, status, claim_id, started_at, ended_at, created_at")
    .ilike("inspection_number", "%HINS%")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Por HINS:", JSON.stringify(byHins, null, 2));
  if (err2) console.log("Error:", err2.message);

  // 3. Buscar el claim con claim_number que contenga "581"
  console.log("\n=== Buscar claim con 581 ===");
  const { data: claims } = await supabase
    .from("claims")
    .select("id, claim_number, company_id")
    .ilike("claim_number", "%581%")
    .limit(10);
  console.log("Claims:", JSON.stringify(claims, null, 2));

  // Si encontramos sesiones, investigar la primera
  const found = byInspNum || byHins;
  if (found && found.length > 0) {
    await investigateSession(found[0].id);
    return;
  }

  // 4. Si encontramos claims, buscar sesiones por claim_id
  if (claims && claims.length > 0) {
    for (const claim of claims) {
      const { data: sessions } = await supabase
        .from("inspection_sessions")
        .select("*")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (sessions && sessions.length > 0) {
        console.log("\nClaim " + claim.claim_number + " tiene " + sessions.length + " sesiones");
        await investigateSession(sessions[0].id);
        return;
      }
    }
  }

  console.log("\nNo se encontró. ¿Puedes darme el ID de la sesión o el claim_number exacto?");
}

main().catch(console.error);
