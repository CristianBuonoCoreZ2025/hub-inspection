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
  try {
    await sendMetadata({
      type: "pg_track_relationships",
      args: {
        source: "default",
        table: { schema: "public", name: table },
      },
    });
    console.log(`  ✓ Tracked relationships: ${table}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("no new foreign keys") || msg.includes("already tracked")) {
      console.log(`  ℹ No new relationships for ${table}`);
    } else {
      console.error(`  ✗ Error tracking relationships ${table}:`, msg);
    }
  }
}

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
