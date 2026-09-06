import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
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
  const planPath = resolve(process.cwd(), "fix-claims-plan.json");
  const raw = await readFile(planPath, "utf-8");
  const { plan } = JSON.parse(raw);

  if (!plan || plan.length === 0) {
    console.log("No hay siniestros para sincronizar");
    return;
  }

  console.log(`Sincronizando workflow para ${plan.length} siniestros...`);

  let ok = 0;
  let errors = 0;

  for (let i = 0; i < plan.length; i++) {
    const { claimId } = plan[i];
    const { data, error } = await supabase.rpc("sync_workflow_for_claim", {
      p_claim_id: claimId,
    });

    if (error) {
      console.error(`[${i + 1}/${plan.length}] ERROR ${claimId}:`, error.message);
      errors++;
    } else {
      const created = (data || []).filter((r) => r.created).length;
      console.log(`[${i + 1}/${plan.length}] OK ${claimId}: ${data?.length || 0} acciones, ${created} nuevas`);
      ok++;
    }
  }

  console.log(`\nSincronización terminada. OK: ${ok}. Errores: ${errors}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
