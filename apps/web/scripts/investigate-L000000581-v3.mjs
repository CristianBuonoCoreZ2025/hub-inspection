// Verificar datos del claim y participantes de L-000000581
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

  // 1. Datos de la sesión
  const { data: sess } = await supabase
    .from("inspection_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  console.log("=== Sesión ===");
  console.log("interviewed_name:", JSON.stringify(sess?.interviewed_name));
  console.log("interviewed_email:", JSON.stringify(sess?.interviewed_email));
  console.log("interviewed_relationship:", JSON.stringify(sess?.interviewed_relationship));
  console.log("property_risk:", JSON.stringify(sess?.property_risk));
  console.log("property_materiality:", JSON.stringify(sess?.property_materiality));
  console.log("security_measures:", JSON.stringify(sess?.security_measures));
  console.log("insured_statement:", JSON.stringify(sess?.insured_statement));
  console.log("inspector_observations:", JSON.stringify(sess?.inspector_observations));
  console.log("active_tab:", sess?.active_tab);
  console.log("acta_step:", sess?.acta_step);
  console.log("substate:", sess?.substate);

  // 2. Participantes del claim
  console.log("\n=== Participantes del claim ===");
  const { data: participants } = await supabase
    .from("claims_participants")
    .select("type, full_name, first_name, last_name, email, phone, cell_phone, rut")
    .eq("claim_id", sess?.claim_id);
  if (participants) {
    participants.forEach((p) => {
      console.log("  type:", p.type, "name:", p.full_name, "email:", JSON.stringify(p.email), "phone:", p.phone);
    });
  }

  // 3. Verificar si el email del asegurado es válido
  const insured = participants?.find((p) => p.type === "insured");
  if (insured?.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    console.log("\n=== Validación email asegurado ===");
    console.log("Email:", JSON.stringify(insured.email));
    console.log("Es válido:", emailRegex.test(insured.email));
  }
}

main().catch(console.error);
