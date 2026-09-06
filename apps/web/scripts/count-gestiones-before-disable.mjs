// Cuenta gestiones activas por claim y muestra el plan de desactivación.
// SOLO LECTURA — no modifica nada.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
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

const references = [
  "202504152","202600212","202601844","202602132","202602231","202602570",
  "202602676","202602752","202602763","202602835","202602910","202603017",
  "202603052","202603314","202603437","202603442","202603503","202603504",
  "202603513","202603521","202603873","202604003","202604112","202604113",
  "202604155","202604207","202604222","202604232","202604281","202604319",
  "202604425","202604483","202604601","202604619","202604625","202604634",
  "202604659","202604747","202604750","202604786","202604797","202604798",
  "202604802","202604803","202604812","202604836","202604844","202604845",
  "202604866","202605085","202605117","202605124","202605137","202605357",
  "202605377","202605407","202605438","202605509","202605796",
];

async function main() {
  // 1) Traer claims
  const { data: claims, error } = await supabase
    .from("claims")
    .select("id, client_reference, claim_number, liquidation_number, status_id, status:lookup_catalog!claims_status_id_fkey(code, name), disabled, created_at")
    .in("client_reference", references)
    .order("client_reference", { ascending: true });

  if (error) { console.error("Error:", error.message); process.exit(1); }

  console.log(`\n=== IMPACTO DE DESACTIVACIÓN — ${claims.length} claims ===\n`);
  console.log(`Referencias solicitadas: ${references.length}`);
  console.log(`Claims encontrados: ${claims.length}`);
  const notFound = references.filter((r) => !claims.find((c) => c.client_reference === r));
  console.log(`Referencias NO encontradas: ${notFound.length} → ${notFound.join(", ")}\n`);

  // 2) Contar gestiones activas por claim
  console.log("Contando gestiones por claim...\n");
  const rows = [];
  for (const c of claims) {
    const { count: activeCount } = await supabase
      .from("claim_actions")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", c.id)
      .eq("is_active", true);
    const { count: totalCount } = await supabase
      .from("claim_actions")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", c.id);
    rows.push({
      id: c.id,
      client_reference: c.client_reference,
      claim_number: c.claim_number,
      liquidation_number: c.liquidation_number,
      status: c.status?.name || c.status?.code || "?",
      disabled: c.disabled,
      created_at: c.created_at,
      gestiones_activas: activeCount ?? 0,
      gestiones_total: totalCount ?? 0,
    });
  }

  // 3) Mostrar tabla
  console.log("ref          | liquidation    | gestiones_activas | gestiones_total | estado        | id");
  console.log("-------------|----------------|-------------------|-----------------|---------------|----");
  let totalActive = 0;
  let totalAll = 0;
  for (const r of rows) {
    console.log(
      `${r.client_reference.padEnd(12)} | ${String(r.liquidation_number).padEnd(14)} | ${String(r.gestiones_activas).padStart(17)} | ${String(r.gestiones_total).padStart(15)} | ${r.status.padEnd(13)} | ${r.id}`
    );
    totalActive += r.gestiones_activas;
    totalAll += r.gestiones_total;
  }

  console.log(`\nTOTAL gestiones activas a afectar: ${totalActive}`);
  console.log(`TOTAL gestiones (todas) a afectar: ${totalAll}`);

  const conGestiones = rows.filter((r) => r.gestiones_activas > 0);
  console.log(`\nClaims CON gestiones activas: ${conGestiones.length}`);
  if (conGestiones.length) {
    for (const r of conGestiones) {
      console.log(`  → ref=${r.client_reference}  gestiones_activas=${r.gestiones_activas}  liquidation=${r.liquidation_number}`);
    }
  }

  // 4) Guardar plan para el script de ejecución
  const planPath = resolve(__dirname, "disable-plan.json");
  writeFileSync(planPath, JSON.stringify({
    reason: "Carga errónea — desactivación solicitada por usuario",
    references_requested: references,
    references_not_found: notFound,
    claims_to_disable: rows.map((r) => ({
      id: r.id,
      client_reference: r.client_reference,
      claim_number: r.claim_number,
      liquidation_number: r.liquidation_number,
      gestiones_activas: r.gestiones_activas,
    })),
  }, null, 2), "utf8");
  console.log(`\nPlan guardado en: ${planPath}`);
  console.log(`\n>>> NO se realizó ningún cambio. Ejecuta scripts/disable-claims-confirm.mjs para aplicar. <<<`);
}

main().catch((e) => { console.error(e); process.exit(1); });
