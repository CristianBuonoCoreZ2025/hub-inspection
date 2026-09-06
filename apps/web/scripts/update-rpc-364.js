const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const sqlPath = path.join(__dirname, '..', '..', '..', 'migrations', '364_hubi_assistant_graphrag.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const c = new Client({
    connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  await c.query(sql);
  console.log("RPC actualizada en produccion (384 dims)");
  await c.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
