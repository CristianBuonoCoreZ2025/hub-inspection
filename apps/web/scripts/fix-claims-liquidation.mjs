import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Obtener status "adjustment" (Liquidación)
  const { data: statusRow, error: statusError } = await supabase
    .from("lookup_catalog")
    .select("id, code, name")
    .eq("category", "claim_status")
    .eq("code", "adjustment")
    .maybeSingle();

  if (statusError) throw statusError;
  if (!statusRow) {
    console.error("No se encontró status 'adjustment'");
    process.exit(1);
  }
  console.log("Status liquidación:", statusRow.id, statusRow.name);

  // 2. Leer plan de los 40 siniestros
  const raw = await readFile(resolve(process.cwd(), "fix-claims-plan.json"), "utf-8");
  const { plan } = JSON.parse(raw);

  if (!plan || plan.length === 0) {
    console.log("No hay siniestros para actualizar");
    return;
  }

  console.log(`Actualizando status a liquidación para ${plan.length} siniestros...`);

  const log = [];

  for (let i = 0; i < plan.length; i++) {
    const { claimId } = plan[i];

    // Actualizar status a adjustment/liquidación
    const { error: updError } = await supabase
      .from("claims")
      .update({
        status_id: statusRow.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updError) {
      console.error(`[${i + 1}/${plan.length}] ERROR status ${claimId}:`, updError.message);
      log.push({ claimId, status: "error-status", error: updError.message });
      continue;
    }

    // Sincronizar workflow
    const { data, error } = await supabase.rpc("sync_workflow_for_claim", {
      p_claim_id: claimId,
    });

    if (error) {
      console.error(`[${i + 1}/${plan.length}] ERROR sync ${claimId}:`, error.message);
      log.push({ claimId, status: "error-sync", error: error.message });
    } else {
      const created = (data || []).filter((r) => r.created).length;
      console.log(`[${i + 1}/${plan.length}] OK ${claimId}: status → ${statusRow.name}, ${created} acciones creadas`);
      log.push({ claimId, status: "ok", created });
    }
  }

  await writeFile("fix-claims-liquidation-log.json", JSON.stringify(log, null, 2), "utf-8");

  const ok = log.filter((l) => l.status === "ok").length;
  const errors = log.filter((l) => l.status !== "ok").length;
  const totalCreated = log.filter((l) => l.status === "ok").reduce((a, b) => a + (b.created || 0), 0);

  console.log(`\nTerminado. OK: ${ok}. Errores: ${errors}. Acciones creadas: ${totalCreated}`);
  console.log("Log: fix-claims-liquidation-log.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
