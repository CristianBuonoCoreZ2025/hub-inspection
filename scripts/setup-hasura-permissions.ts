/**
 * Configura permisos de Hasura GraphQL para el rol 'user'
 * en TODAS las tablas del esquema public de una sola vez.
 *
 * Uso:
 *   pnpm tsx scripts/setup-hasura-permissions.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_NHOST_SUBDOMAIN=tu-subdomain
 *   NEXT_PUBLIC_NHOST_REGION=eu-central-1
 *   NHOST_ADMIN_SECRET=tu-admin-secret
 */

import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const TABLES = [
  "companies",
  "profiles",
  "claims",
  "inspection_sessions",
  "inspection_checklists",
  "inspection_damages",
  "inspection_evidences",
  "inspection_notes",
  "inspection_signatures",
  "inspection_reports",
  "inspection_chat_messages",
  "magic_links",
  "audit_logs",
  "countries",
  "regions",
  "cities",
  "communes",
  "business_lines",
  "insurance_products",
  "claim_causes",
  "claim_types",
  "brokers",
  "advisors",
  "insurance_companies",
  "housing_destinations",
  "property_classifications",
  "damage_classifications",
  "building_ages",
  "relationships",
  "policy_types",
  "lookup_catalog",
  "events",
];

const ROLE = "user";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;

if (!subdomain || !region || !adminSecret) {
  console.error("Faltan variables de entorno. Necesitas:");
  console.error("  NEXT_PUBLIC_NHOST_SUBDOMAIN");
  console.error("  NEXT_PUBLIC_NHOST_REGION");
  console.error("  NHOST_ADMIN_SECRET");
  process.exit(1);
}

const metadataUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`;

async function sendMetadata(payload: unknown) {
  const res = await fetch(metadataUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hasura-Admin-Secret": adminSecret!,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(JSON.stringify(data, null, 2));
  }
  return data;
}

async function createPermission(
  table: string,
  type: "select" | "insert" | "update" | "delete"
) {
  const permissionType = `pg_create_${type}_permission` as const;

  const baseArgs = {
    table: { name: table, schema: "public" },
    role: ROLE,
    source: "default",
  };

  let permission: Record<string, unknown>;

  switch (type) {
    case "select":
      permission = { columns: "*", filter: {} };
      break;
    case "insert":
      permission = { columns: "*", check: {} };
      break;
    case "update":
      permission = { columns: "*", filter: {}, check: {} };
      break;
    case "delete":
      permission = { filter: {} };
      break;
  }

  await sendMetadata({
    type: permissionType,
    args: { ...baseArgs, permission },
  });

  console.log(`  ✓ ${type} on ${table}`);
}

async function main() {
  console.log(`\nConfigurando permisos para rol '${ROLE}' en Hasura...`);
  console.log(`URL: ${metadataUrl}\n`);

  for (const table of TABLES) {
    console.log(`Tabla: ${table}`);
    try {
      await createPermission(table, "select");
      await createPermission(table, "insert");
      await createPermission(table, "update");
      await createPermission(table, "delete");
    } catch (err) {
      console.error(`  ✗ Error en ${table}:`, (err as Error).message);
    }
  }

  console.log("\nHecho. Refresca la app para aplicar cambios.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
