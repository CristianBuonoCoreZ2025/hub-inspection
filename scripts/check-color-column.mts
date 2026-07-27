import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) { console.error("No connection string"); process.exit(1); }
  const c = new Client({ connectionString: connStr });
  await c.connect();

  // 1. Verificar que la columna existe
  const r = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'characteristic' AND column_name = 'color'"
  );
  console.log("Column 'color' in 'characteristic':", r.rows);

  // 2. Forzar reload del schema cache de PostgREST
  await c.query("NOTIFY pgrst, 'reload schema'");
  console.log("NOTIFY pgrst sent");

  // 3. Esperar 2 segundos y verificar
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log("Done — wait a few seconds for PostgREST to reload");

  await c.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
