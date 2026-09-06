import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  // Verificar RLS en inspection_sessions y claims
  const r = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE tablename IN ('inspection_sessions', 'claims', 'claims_participants')
  `);
  console.log("RLS status:");
  r.rows.forEach(row => console.log(`  ${row.tablename}: rowsecurity=${row.rowsecurity}`));

  // Ver las policies
  const policies = await client.query(`
    SELECT tablename, policyname, cmd, roles, qual
    FROM pg_policies
    WHERE tablename IN ('inspection_sessions', 'claims')
    ORDER BY tablename, policyname
  `);
  console.log("\nPolicies:");
  policies.rows.forEach(p => {
    console.log(`  [${p.tablename}] ${p.policyname} (${p.cmd})`);
    console.log(`    roles: ${p.roles}`);
    console.log(`    qual: ${p.qual}`);
  });

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
