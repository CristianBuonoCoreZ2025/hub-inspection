require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

async function main() {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query(
    "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='action_template' AND schemaname='public' AND cmd='SELECT'"
  );
  console.log("SELECT policy:", JSON.stringify(r.rows, null, 2));
  await p.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
