// Simular exactamente lo que hace el navegador: getClaims con la sesión del usuario
// Pero usando service role para ver si hay diferencia
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
  // 1) Count exacto
  const { count } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false);
  console.log(`Count exacto: ${count}`);
  console.log(`totalPages esperadas: ${Math.ceil((count || 0) / 100)}`);

  // 2) Simular el loop del export: fetchear todas las páginas en paralelo
  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  const CONCURRENCY = 5;

  let allRaw = [];
  for (let startPage = 1; startPage <= totalPages; startPage += CONCURRENCY) {
    const pagesToFetch = [];
    for (let p = startPage; p < startPage + CONCURRENCY && p <= totalPages; p++) {
      pagesToFetch.push(p);
    }
    console.log(`Fetching páginas ${pagesToFetch.join(", ")}...`);

    const batches = await Promise.all(
      pagesToFetch.map(async (page) => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("claims")
          .select(CLAIM_SELECT)
          .eq("disabled", false)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) {
          console.log(`  Error página ${page}: ${error.message}`);
          return [];
        }
        return data || [];
      })
    );

    for (const batch of batches) {
      allRaw.push(...batch);
    }
    console.log(`  Acumulado: ${allRaw.length}`);
  }

  console.log(`\nTotal filas con joins: ${allRaw.length}`);
  console.log(`Diferencia: ${(count || 0) - allRaw.length}`);

  // 3) Verificar si hay IDs duplicados
  const ids = allRaw.map(c => c.id);
  const uniqueIds = new Set(ids);
  console.log(`IDs únicos: ${uniqueIds.size}`);
  if (ids.length !== uniqueIds.size) {
    console.log(`Duplicados: ${ids.length - uniqueIds.size}`);
  }

  // 4) Buscar qué claims faltan
  if (allRaw.length < (count || 0)) {
    const foundIds = new Set(allRaw.map(c => c.id));
    // Traer todos los IDs sin joins
    const { data: allIds } = await supabase
      .from("claims")
      .select("id, liquidation_number, created_at")
      .eq("disabled", false)
      .order("created_at", { ascending: false });
    const missing = (allIds || []).filter(c => !foundIds.has(c.id));
    console.log(`\nClaims faltantes: ${missing.length}`);
    for (const m of missing.slice(0, 10)) {
      console.log(`  ${m.liquidation_number}  created_at=${m.created_at}`);
    }
  }
}

main().catch(console.error);
