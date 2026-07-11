/**
 * Track tables and relationships in Hasura for new tables.
 *
 * Uso:
 *   pnpm tsx scripts/hasura-track-tables.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_NHOST_SUBDOMAIN=tu-subdomain
 *   NEXT_PUBLIC_NHOST_REGION=eu-central-1
 *   NHOST_ADMIN_SECRET=tu-admin-secret
 */

import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

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

async function trackTable(table: string) {
  try {
    await sendMetadata({
      type: "pg_track_table",
      args: {
        source: "default",
        table: { schema: "public", name: table },
      },
    });
    console.log(`  ✓ Tracked table: ${table}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("already tracked")) {
      console.log(`  ℹ Table ${table} already tracked`);
    } else {
      console.error(`  ✗ Error tracking ${table}:`, msg);
    }
  }
}

async function trackRelationships(table: string) {
  // En Hasura v2+, las relaciones objeto se trackean individualmente con pg_track_relationship
  // Las FKs se detectan automáticamente al trackear la tabla, pero las relaciones
  // (object/array) necesitan trackearse explícitamente
  const rels = tableRelationships[table];
  if (!rels) {
    console.log(`  ℹ No relationships defined for ${table}`);
    return;
  }

  for (const rel of rels) {
    try {
      await sendMetadata({
        type: "pg_track_relationship",
        args: {
          source: "default",
          table: { schema: "public", name: table },
          name: rel.name,
          using: rel.type === "object"
            ? { foreign_key_constraint_on: rel.column }
            : { foreign_key_constraint_on: { column: rel.column, table: { schema: "public", name: rel.foreignTable! } } },
        },
      });
      console.log(`  ✓ Tracked relationship: ${table}.${rel.name}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("already tracked") || msg.includes("already exists") || msg.includes("no new foreign keys")) {
        console.log(`  ℹ Relationship ${table}.${rel.name} already tracked`);
      } else {
        console.error(`  ✗ Error tracking relationship ${table}.${rel.name}:`, msg);
      }
    }
  }
}

// Definición de relaciones por tabla
const tableRelationships: Record<string, { name: string; type: "object" | "array"; column: string; foreignTable?: string }[]> = {
  policies: [
    { name: "insurance_company", type: "object", column: "insurance_company_id" },
    { name: "country", type: "object", column: "country_id" },
    { name: "broker", type: "object", column: "broker_id" },
    { name: "business_line", type: "object", column: "business_line_id" },
    { name: "company", type: "object", column: "company_id" },
    { name: "policy_coverages", type: "array", column: "policy_id", foreignTable: "policy_coverages" },
  ],
  policy_coverages: [
    { name: "policy", type: "object", column: "policy_id" },
  ],
  policy_documents: [
    { name: "policy", type: "object", column: "policy_id" },
  ],
  claim_coverages: [
    { name: "claim", type: "object", column: "claim_id" },
  ],
  claim_reserves: [
    { name: "claim", type: "object", column: "claim_id" },
    { name: "reserve_coverages", type: "array", column: "claim_reserve_id", foreignTable: "reserve_coverages" },
  ],
  reserve_coverages: [
    { name: "claim_reserve", type: "object", column: "claim_reserve_id" },
    { name: "claim_coverage", type: "object", column: "claim_coverage_id" },
  ],
};

async function untrackTable(table: string) {
  try {
    await sendMetadata({
      type: "pg_untrack_table",
      args: {
        source: "default",
        table: { schema: "public", name: table },
      },
    });
    console.log(`  ✓ Untracked table: ${table}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("not tracked") || msg.includes("not found")) {
      console.log(`  ℹ Table ${table} was not tracked`);
    } else {
      console.error(`  ✗ Error untracking ${table}:`, msg);
    }
  }
}

async function main() {
  // Primero untrack tablas que fueron renombradas y ya no existen
  const staleTables = [
    "claim_participants",
  ];

  const tables = [
    "claims_participants",
    "events",
    "lookup_catalog",
    "property_classifications",
    "business_lines",
    "insurance_products",
    "advisors",
    "brokers",
    "housing_destinations",
    "damage_classifications",
    "document_types",
    // Sistema de gestiones
    "action_type",
    "action_feature",
    "action_template",
    "action_template_claim_status",
    "claim_status",
    // Plantillas de documentos
    "document_templates",
    // Permisos a nivel de campo
    "field_permissions",
    // Coberturas de póliza
    "policy_coverages",
    "claim_coverages",
    "claim_reserves",
    "reserve_coverages",
    // Pólizas
    "policies",
    "policy_documents",
    "policy_business_lines",
    "coverage_catalog",
    "subcoverage_catalog",
    // Sistema de documentos
    "document_requirements",
    "claim_document_requests",
    "claim_document_request_items",
  ];

  console.log(`\nUntracking stale tables in Hasura...`);
  for (const table of staleTables) {
    await untrackTable(table);
  }

  console.log(`\nTracking tables in Hasura...`);
  console.log(`URL: ${metadataUrl}\n`);

  for (const table of tables) {
    await trackTable(table);
    await trackRelationships(table);
  }

  console.log("\nHecho. Refresca la app para aplicar cambios.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
