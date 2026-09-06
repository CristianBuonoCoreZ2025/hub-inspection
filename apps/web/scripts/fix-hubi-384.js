const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  await c.query("ALTER TABLE hubi_docs ALTER COLUMN embedding TYPE VECTOR(384)");
  await c.query("DROP INDEX IF EXISTS idx_hubi_docs_embedding");
  await c.query("CREATE INDEX idx_hubi_docs_embedding ON hubi_docs USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)");
  console.log("Produccion: embedding cambiado a 384 dims");
  await c.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
