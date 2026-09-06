const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  const r = await c.query("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("pgvector habilitado en produccion:", r.command);
  const check = await c.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'");
  console.log("Version:", JSON.stringify(check.rows));
  await c.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
