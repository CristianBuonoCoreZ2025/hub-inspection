import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Total policies
  const total = await client.query("SELECT count(*) as cnt FROM policies");
  console.log("Total policies:", total.rows[0].cnt);

  // Sample
  const sample = await client.query("SELECT id, policy_name, policy_number, company_id, insurance_company_id, status FROM policies LIMIT 10");
  sample.rows.forEach((r) => {
    console.log(`  ${r.policy_name} | company: ${r.company_id} | ins: ${r.insurance_company_id} | status: ${r.status} | num: ${r.policy_number}`);
  });

  // Distinct company_ids
  const comps = await client.query("SELECT DISTINCT company_id FROM policies");
  console.log("\nDistinct company_ids in policies:", comps.rows.map((r) => r.company_id));

  // User's company
  const profiles = await client.query("SELECT id, email, company_id FROM profiles LIMIT 5");
  console.log("\nProfiles:");
  profiles.rows.forEach((r) => console.log(`  ${r.email} | company: ${r.company_id}`));

  await client.end();
}

main().catch(console.error);
