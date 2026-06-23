import dotenv from "dotenv";
import { resolve } from "path";
import { Client } from "pg";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const tables = [
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
  "countries",
  "companies",
  "profiles",
  "claims",
];

async function main() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("\nConteo de registros por tabla:\n");
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*)::int as n FROM ${t}`);
      console.log(`  ${t.padEnd(30)} ${res.rows[0].n}`);
    } catch (err) {
      console.log(`  ${t.padEnd(30)} ERROR: ${(err as Error).message}`);
    }
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
