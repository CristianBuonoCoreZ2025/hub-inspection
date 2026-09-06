// Diagnóstico 2: muestra estado de los 57 claims y busca variantes de formato.
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
  // 1) Traer TODOS los claims con esas client_reference (sin filtro de disabled)
  const { data: claims, error } = await supabase
    .from("claims")
    .select("id, claim_number, client_reference, disabled, disabled_reason, disabled_at, created_at, updated_at, company_id, insurance_company_id")
    .in("client_reference", references)
    .order("client_reference", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) { console.error(error.message); process.exit(1); }

  console.log(`\n=== ESTADO DE LOS ${claims.length} CLAIMS ENCONTRADOS ===\n`);
  const disabled = claims.filter((c) => c.disabled);
  const active = claims.filter((c) => !c.disabled);
  console.log(`Activos: ${active.length}, Desactivados: ${disabled.length}\n`);

  // Mostrar todos
  for (const c of claims) {
    const flag = c.disabled ? "[DISABLED]" : "[ACTIVE]  ";
    console.log(`${flag} ref=${c.client_reference}  id=${c.id}  created=${c.created_at}  updated=${c.updated_at}`);
  }

  // 2) Buscar variantes: claims cuyo client_reference CONTIENE alguno de los números
  // (puede haber espacios, prefijos, etc.)
  console.log(`\n=== BÚSQUEDA DE VARIANTES (ilike por prefijo) ===\n`);
  // Tomar los primeros 3 dígitos como prefijo para ver si hay variantes
  // Mejor: buscar cada referencia con ilike %ref%
  const foundRefs = new Set(claims.map((c) => c.client_reference));
  const missing = references.filter((r) => !foundRefs.has(r));
  console.log(`Referencias no encontradas exactas: ${missing.join(", ")}`);

  for (const ref of missing) {
    const { data: variants } = await supabase
      .from("claims")
      .select("id, claim_number, client_reference, disabled, created_at")
      .ilike("client_reference", `%${ref}%`);
    if (variants && variants.length) {
      console.log(`\nVariantes para ${ref}:`);
      for (const v of variants) {
        console.log(`  ref="${v.client_reference}"  id=${v.id}  disabled=${v.disabled}  created=${v.created_at}`);
      }
    } else {
      console.log(`Sin variantes para ${ref} (ilike %${ref}%)`);
    }
  }

  // 3) ¿Hay claims con el mismo claim_number duplicados?
  console.log(`\n=== DUPLICADOS POR claim_number (todos los claims) ===\n`);
  // Traer todos los claims y agrupar por claim_number — puede ser pesado, usar RPC si existe
  // Alternativa: buscar los claim_numbers de los 57 encontrados
  const claimNumbers = [...new Set(claims.map((c) => c.claim_number).filter(Boolean))];
  console.log(`Claim_numbers distintos de los encontrados: ${claimNumbers.length}`);
  if (claimNumbers.length) {
    const { data: byNum } = await supabase
      .from("claims")
      .select("id, claim_number, client_reference, disabled, created_at, company_id, insurance_company_id")
      .in("claim_number", claimNumbers)
      .order("claim_number", { ascending: true })
      .order("created_at", { ascending: true });
    if (byNum) {
      const byNumMap = new Map();
      for (const c of byNum) {
        if (!byNumMap.has(c.claim_number)) byNumMap.set(c.claim_number, []);
        byNumMap.get(c.claim_number).push(c);
      }
      let dupCount = 0;
      for (const [num, group] of byNumMap.entries()) {
        if (group.length > 1) {
          dupCount++;
          console.log(`\nclaim_number="${num}" → ${group.length} claims:`);
          for (const c of group) {
            const flag = c.disabled ? "[DISABLED]" : "[ACTIVE]  ";
            console.log(`  ${flag} ref=${c.client_reference}  id=${c.id}  company=${c.company_id}  created=${c.created_at}`);
          }
        }
      }
      console.log(`\nTotal de claim_numbers duplicados: ${dupCount}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
