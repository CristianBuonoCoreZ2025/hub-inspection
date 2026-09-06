// Verificar si RLS en claims filtra por company_id cuando el usuario está autenticado
// Simular la sesión del navegador con un token real
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

async function main() {
  // 1) Verificar si hay claims con company_id null
  const { count: nullCompany } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false)
    .is("company_id", null);
  console.log(`Claims con company_id null: ${nullCompany}`);

  // 2) Verificar distribución por company_id
  const { data: byCompany } = await supabase
    .from("claims")
    .select("company_id")
    .eq("disabled", false);
  if (byCompany) {
    const counts = {};
    for (const c of byCompany) {
      const key = c.company_id || "null";
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log(`\nDistribución por company_id:`);
    for (const [cid, cnt] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cid.substring(0, 8)}...: ${cnt}`);
    }
  }

  // 3) Verificar las policies RLS en claims
  const { data: policies, error: polErr } = await supabase
    .rpc("to_jsonb", {
      p_query: `
        SELECT pol.polname, pol.polcmd, pol.qual, pol.with_check, usename
        FROM pg_policy pol
        JOIN pg_class cls ON pol.polrelid = cls.oid
        JOIN pg_namespace ns ON cls.relnamespace = ns.oid
        JOIN pg_user usr ON pol.polrelid = cls.oid
        WHERE cls.relname = 'claims' AND ns.nspname = 'public'
      `
    });
  if (polErr) {
    // Probar query directa
    const { data: policies2, error: polErr2 } = await supabase
      .from("pg_policy")
      .select("*");
    if (polErr2) {
      console.log(`No se pueden leer policies directamente: ${polErr2.message}`);
    }
  }

  // 4) Verificar si getClaimsCount y getClaims devuelven lo mismo con service role
  // (ya sabemos que sí - 1655)

  // 5) Verificar si el problema es que claimsCount en la UI está cacheado
  // con un valor viejo. El query tiene staleTime: 60_000 (1 minuto)
  // Si el usuario aplicó un filtro hace 1 minuto y luego lo quitó,
  // claimsCount podría tener el valor filtrado.

  console.log(`\n--- Verificando si el problema es de caché ---`);
  console.log(`claimsCount usa useQuery con queryKey que incluye todos los filtros`);
  console.log(`Si no hay filtros, el queryKey es ["claims-count", [], [], [], [], "", "", ""]`);
  console.log(`El valor debería ser 1655 si no hay filtros`);

  // 6) Verificar si hay claims que no tienen status_id válido
  // (podría causar que se filtren por RLS)
  const { count: nullStatus } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false)
    .is("status_id", null);
  console.log(`\nClaims con status_id null: ${nullStatus}`);

  // 7) Verificar si el problema es el ordenamiento
  // getClaims ordena por created_at desc por defecto
  // Si hay claims con created_at null, podrían perderse
  const { count: nullCreated } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("disabled", false)
    .is("created_at", null);
  console.log(`Claims con created_at null: ${nullCreated}`);
}

main().catch(console.error);
