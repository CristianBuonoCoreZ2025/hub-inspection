// Comparar count exacto vs claims devueltas por getClaims con joins
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

const CLAIM_SELECT = "id, claim_number, policy_number, policy_id, claim_date, status_id, report_date, assignment_date, client_reference, company_report_number, liquidation_number, is_special_claim, summary, event_id, internal_number, notes, company_id, assigned_adjuster_id, inspector_id, adjuster_id, auditor_id, dispatcher_id, assistant_id, insurance_company_id, broker_id, advisor_id, claim_cause_id, claim_type_id, business_line_id, insurance_product_id, country_id, region_id, city_id, commune_id, construction_type_id, destination_housing_id, damage_classification_id, habitability_id, type_id, currency_id, service_type_id, billing_type_id, claim_address, claim_latitude, claim_longitude, owner_same_as_insured, policy_item, policy_start_date, policy_end_date, policy_amount, policy_premium, recovery_type_legal, recovery_type_material, recovery_comments, broker_executive, created_at, updated_at, updated_by, disabled, disabled_reason, disabled_at, disabled_by, reopened_at, reopened_by, reopened_reason, status:lookup_catalog!claims_status_id_fkey(id, category, code, name), assigned_adjuster:profiles!claims_assigned_adjuster_id_fkey(id, full_name, email), adjuster:profiles!claims_adjuster_id_fkey(id, full_name, email), broker:brokers!claims_broker_id_fkey(id, name), insurance_company:insurance_companies!claims_insurance_company_id_fkey(id, name), policy:policies!claims_policy_id_fkey(id, policy_number, policy_name, status, currency), currency:currencies!claims_currency_id_fkey(id, code, name, symbol, decimals), country:countries!claims_country_id_fkey(id, name), region:regions!claims_region_id_fkey(id, name), city:cities!claims_city_id_fkey(id, name), commune:communes!claims_commune_id_fkey(id, name), destination_housing:housing_destinations!claims_destination_housing_id_fkey(id, name), business_line:business_lines!claims_business_line_id_fkey(id, name), claim_type:claim_types!claims_claim_type_id_fkey(id, name), claims_participants:claims_participants(claim_id, type, full_name, first_name, last_name, rut, email, phone, cell_phone, address, person_type, country, region, city, commune, is_active, linked_to_insured), inspector:profiles!claims_inspector_id_fkey(id, full_name, email), auditor:profiles!claims_auditor_id_fkey(id, full_name, email), dispatcher:profiles!claims_dispatcher_id_fkey(id, full_name, email), assistant:profiles!claims_assistant_id_fkey(id, full_name, email)";

async function main() {
  // 1) Count exacto (sin joins)
  const { count, error: countErr } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false);
  console.log(`Count exacto (sin joins): ${count}`);

  // 2) Traer página 1 con joins y ver cuántos devuelve
  const { data: page1, error: pageErr } = await supabase
    .from("claims")
    .select(CLAIM_SELECT)
    .eq("disabled", false)
    .order("created_at", { ascending: false })
    .range(0, 99);
  console.log(`Página 1 con joins: ${page1?.length || 0} filas (esperadas: 100)`);

  // 3) Traer TODAS las páginas y contar
  let total = 0;
  let page = 1;
  const pageSize = 100;
  const totalPages = Math.ceil((count || 0) / pageSize);
  for (let p = 1; p <= totalPages; p++) {
    const from = (p - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("claims")
      .select(CLAIM_SELECT)
      .eq("disabled", false)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      console.log(`Error página ${p}: ${error.message}`);
      break;
    }
    total += data?.length || 0;
    if (!data || data.length < pageSize) break;
  }
  console.log(`Total con joins (todas las páginas): ${total}`);
  console.log(`Diferencia: ${(count || 0) - total}`);

  // 4) Probar con la anon key
  console.log(`\n--- Con ANON key ---`);
  const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count: anonCount } = await supabaseAnon
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false);
  console.log(`Count con anon key: ${anonCount}`);

  // Página 1 con anon key
  const { data: anonPage1, error: anonErr } = await supabaseAnon
    .from("claims")
    .select(CLAIM_SELECT)
    .eq("disabled", false)
    .order("created_at", { ascending: false })
    .range(0, 99);
  console.log(`Página 1 con anon key: ${anonPage1?.length || 0} filas (esperadas: 100)`);
  if (anonErr) console.log(`Error: ${anonErr.message}`);
}

main().catch(console.error);
