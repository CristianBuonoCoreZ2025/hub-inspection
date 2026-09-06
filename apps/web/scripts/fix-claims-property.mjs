import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "fs/promises";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";
const COUNTRY_FILTER = process.env.COUNTRY_FILTER || "Chile"; // o "" para todos

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Encontrar el claim_type "property"
  const { data: propertyType, error: ptError } = await supabase
    .from("claim_types")
    .select("id, name")
    .ilike("name", "property")
    .maybeSingle();

  if (ptError) throw ptError;
  if (!propertyType) {
    console.error("No se encontró claim_type 'property'");
    process.exit(1);
  }
  console.log("claim_type 'property' encontrado:", propertyType.id, propertyType.name);

  // 2. Encontrar business_lines de Hogar y Comercial (por ramo_fecu o nombre)
  const { data: businessLines, error: blError } = await supabase
    .from("business_lines")
    .select("id, name, ramo_fecu, claim_type_id, country_id")
    .or('ramo_fecu.ilike."%hogar%",ramo_fecu.ilike."%comercial%",name.ilike."%hogar%",name.ilike."%comercial%"')
    .eq("is_active", true);

  if (blError) throw blError;
  console.log(`Business lines encontradas: ${businessLines?.length || 0}`);
  for (const bl of businessLines || []) {
    console.log(`  - ${bl.name} | ramo: ${bl.ramo_fecu} | id: ${bl.id}`);
  }

  // 3. Buscar los 48 casos: sin claim_type_id y sin business_line_id
  let query = supabase
    .from("claims")
    .select("id, claim_number, policy_id, insurance_product_id, claim_type_id, business_line_id, company_id, country_id, policy:policies!claims_policy_id_fkey(business_line_id, policy_name), product:insurance_products!claims_insurance_product_id_fkey(business_line_id, name)")
    .is("claim_type_id", null)
    .is("business_line_id", null)
    .eq("disabled", false);

  if (COUNTRY_FILTER) {
    const { data: countries } = await supabase.from("countries").select("id, name").ilike("name", COUNTRY_FILTER);
    const countryIds = (countries || []).map((c) => c.id);
    if (countryIds.length > 0) {
      query = query.in("country_id", countryIds);
    }
  }

  const { data: claims, error: cError } = await query;

  if (cError) throw cError;

  console.log(`\nSiniestros sin claim_type_id y business_line_id: ${claims?.length || 0}`);

  if (!claims || claims.length === 0) {
    console.log("No hay siniestros para corregir");
    return;
  }

  const plan = [];
  const unresolved = [];

  for (const claim of claims) {
    // Determinar ramo desde producto o póliza
    const productBlId = claim.product?.business_line_id;
    const policyBlId = claim.policy?.business_line_id;
    const sourceBlId = productBlId || policyBlId;

    let targetBusinessLineId = null;
    let reason = "";

    if (sourceBlId) {
      const sourceBl = businessLines?.find((bl) => bl.id === sourceBlId);
      if (sourceBl) {
        // Buscar business_line destino con mismo ramo_fecu
        const ramo = sourceBl.ramo_fecu?.toLowerCase() || sourceBl.name?.toLowerCase() || "";
        const match = businessLines?.find((bl) => {
          const blRamo = (bl.ramo_fecu || bl.name || "").toLowerCase();
          return (ramo.includes("hogar") && blRamo.includes("hogar")) ||
                 (ramo.includes("comercial") && blRamo.includes("comercial"));
        });
        if (match) {
          targetBusinessLineId = match.id;
          reason = `producto/póliza business_line ${sourceBl.name} → ${match.name}`;
        } else {
          targetBusinessLineId = sourceBlId;
          reason = `copiado directo desde producto/póliza ${sourceBl.name}`;
        }
      } else {
        targetBusinessLineId = sourceBlId;
        reason = `copiado directo desde producto/póliza (BL no encontrada en catálogo)`;
      }
    } else {
      unresolved.push(claim);
      continue;
    }

    plan.push({
      claimId: claim.id,
      claimNumber: claim.claim_number,
      policyId: claim.policy_id,
      productId: claim.insurance_product_id,
      currentClaimTypeId: claim.claim_type_id,
      targetClaimTypeId: propertyType.id,
      currentBusinessLineId: claim.business_line_id,
      targetBusinessLineId,
      reason,
    });

    if (DRY_RUN) {
      console.log(`[DRY-RUN] ${claim.claim_number || claim.id}: claim_type → ${propertyType.name}, business_line → ${targetBusinessLineId} (${reason})`);
    }
  }

  await writeFile("fix-claims-plan.json", JSON.stringify({ dryRun: DRY_RUN, plan, unresolved }, null, 2), "utf-8");

  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Listo para corregir ${plan.length} siniestros. ${unresolved.length} sin producto/póliza asociada.`);
    console.log("Revisa fix-claims-plan.json. Si está correcto, ejecuta de nuevo con DRY_RUN=false");
    return;
  }

  // Aplicar cambios
  let updated = 0;
  for (const item of plan) {
    const { error } = await supabase
      .from("claims")
      .update({
        claim_type_id: item.targetClaimTypeId,
        business_line_id: item.targetBusinessLineId,
        updated_at: new Date().toISOString(),
        // updated_by: null, // opcional
      })
      .eq("id", item.claimId);

    if (error) {
      console.error(`ERROR actualizando ${item.claimId}:`, error.message);
    } else {
      updated++;
      console.log(`OK: ${item.claimNumber || item.claimId}`);
    }
  }

  console.log(`\nAplicado: ${updated}/${plan.length} siniestros corregidos. Sin resolver: ${unresolved.length}`);
  console.log("Log: fix-claims-plan.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
