// Script temporal: detecta claims duplicados por client_reference en producción
// y cuenta gestiones activas (claim_actions.is_active=true) por cada claim.
// SOLO LECTURA — no modifica nada.
//
// Uso: node scripts/find-duplicate-claims.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Estamos en apps/web/scripts → root del repo está 3 niveles arriba
const root = resolve(__dirname, "..", "..", "..");

// Cargar .env.production manualmente (está en la raíz del repo)
const envFile = readFileSync(resolve(root, ".env.production"), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.production");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Referencias reportadas como duplicadas
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
  console.log(`\n=== DETECCIÓN DE DUPLICADOS POR client_reference (PRODUCCIÓN) ===\n`);
  console.log(`Referencias a verificar: ${references.length}\n`);

  // 1) Traer todos los claims (incluyendo disabled) con esas client_reference
  // PostgREST soporta .in() para filtrar por array
  const { data: claims, error: err } = await supabase
    .from("claims")
    .select("id, claim_number, client_reference, company_id, insurance_company_id, status_id, disabled, disabled_reason, disabled_at, created_at, updated_at")
    .in("client_reference", references)
    .order("client_reference", { ascending: true });

  if (err) {
    console.error("Error consultando claims:", err.message);
    process.exit(1);
  }

  console.log(`Claims encontrados con esas referencias: ${claims.length}\n`);

  // 2) Agrupar por client_reference
  const byRef = new Map();
  for (const c of claims) {
    const key = c.client_reference ?? "(null)";
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key).push(c);
  }

  // 3) Identificar referencias NO encontradas y duplicados reales
  const notFound = references.filter((r) => !byRef.has(r));
  const duplicates = [];
  const singletons = [];

  for (const [ref, group] of byRef.entries()) {
    if (group.length > 1) duplicates.push({ ref, group });
    else singletons.push({ ref, claim: group[0] });
  }

  console.log(`Referencias NO encontradas en BD: ${notFound.length}`);
  if (notFound.length) console.log("  → " + notFound.join(", "));
  console.log(`\nReferencias con UN solo claim: ${singletons.length}`);
  console.log(`Referencias con DUPLICADOS (>1 claim): ${duplicates.length}\n`);

  if (!duplicates.length) {
    console.log("No se encontraron duplicados. Nada que desactivar.");
    return;
  }

  // 4) Para cada grupo duplicado, contar gestiones activas por claim
  console.log("=== DETALLE DE DUPLICADOS ===\n");

  const plan = [];

  for (const { ref, group } of duplicates) {
    console.log(`\n--- Referencia: ${ref} (${group.length} claims) ---`);

    // Contar claim_actions is_active=true para cada claim del grupo
    const counts = await Promise.all(
      group.map(async (c) => {
        const { count, error } = await supabase
          .from("claim_actions")
          .select("id", { count: "exact", head: true })
          .eq("claim_id", c.id)
          .eq("is_active", true);
        if (error) {
          console.error(`  Error contando gestiones para ${c.id}: ${error.message}`);
          return { claim: c, activeCount: -1 };
        }
        return { claim: c, activeCount: count ?? 0 };
      })
    );

    // Ordenar por más gestiones primero (el que se queda es el de más)
    counts.sort((a, b) => b.activeCount - a.activeCount);

    for (const { claim, activeCount } of counts) {
      const flag = claim.disabled ? "[DISABLED]" : "[ACTIVE]";
      console.log(
        `  ${flag} id=${claim.id}  claim_number=${claim.claim_number ?? "-"}  ` +
        `gestiones_activas=${activeCount}  created=${claim.created_at}  ` +
        `updated=${claim.updated_at}`
      );
    }

    // El que se desactiva = el de MENOS gestiones (el último del orden)
    // Si hay empate, se elige el más reciente (created_at mayor) como "duplicado"
    // Caso a mantener = el primero (más gestiones)
    const keep = counts[0];
    const disable = counts[counts.length - 1];

    // Si hay más de 2 duplicados, marcar todos los del medio también como "a desactivar"
    const toDisable = counts.slice(1);

    plan.push({
      reference: ref,
      keep: { id: keep.claim.id, claim_number: keep.claim.claim_number, gestiones: keep.activeCount },
      toDisable: toDisable.map((t) => ({
        id: t.claim.id,
        claim_number: t.claim.claim_number,
        gestiones: t.activeCount,
        alreadyDisabled: t.claim.disabled,
      })),
    });
  }

  // 5) Resumen del plan
  console.log("\n\n=== PLAN DE DESACTIVACIÓN (PROPUESTA — NO EJECUTADO) ===\n");
  console.log("Regla: se MANTIENE el claim con MÁS gestiones activas.");
  console.log("Se DESACTIVAN los demás duplicados de cada grupo.\n");

  let totalToDisable = 0;
  let alreadyDisabled = 0;
  for (const p of plan) {
    console.log(`Ref ${p.reference}:`);
    console.log(`  MANTENER   → id=${p.keep.id}  gestiones=${p.keep.gestiones}`);
    for (const d of p.toDisable) {
      const tag = d.alreadyDisabled ? " (ya desactivado)" : "";
      console.log(`  DESACTIVAR → id=${d.id}  gestiones=${d.gestiones}${tag}`);
      if (!d.alreadyDisabled) totalToDisable++;
      else alreadyDisabled++;
    }
  }

  console.log(`\nTotal a desactivar: ${totalToDisable}`);
  console.log(`Ya desactivados (sin acción): ${alreadyDisabled}`);
  console.log(`\n>>> NO se realizó ningún cambio. Ejecuta scripts/disable-duplicate-claims.mjs para aplicar. <<<`);

  // Guardar plan en JSON para el script de aplicación
  const planPath = resolve(__dirname, "duplicate-claims-plan.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
  console.log(`\nPlan guardado en: ${planPath}`);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
