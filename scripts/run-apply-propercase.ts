import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync } from "fs";

const envPath = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envPath });

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ Error: DATABASE_URL no está configurada.\n" +
      '   Agrega la connection string de PostgreSQL en .env.local.\n'
  );
  process.exit(1);
}

function extractHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}`;
  } catch {
    return "(URL inválida)";
  }
}

console.log(`🔍 Conectando a: ${extractHost(DATABASE_URL)}\n`);

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL!,
    ssl: ["127.0.0.1", "localhost"].includes(new URL(DATABASE_URL!).hostname)
      ? false
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL (Supabase)\n");

    const sqlPath = join(process.cwd(), "scripts", "apply-propercase.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    // Ejecutar statement por statement, ignorando líneas de comentario en blanco.
    const statements = sql
      .split(/;\s*\r?\n/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim()
      )
      .filter(Boolean);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ";";
      console.log(`\n▶️ Ejecutando bloque ${i + 1}...`);
      const res = await client.query(stmt);
      console.log(`   Filas afectadas: ${res.rowCount}`);
    }

    console.log("\n🎉 proper_case aplicado correctamente.");
  } catch (err) {
    console.error("\n❌ Error ejecutando apply-propercase.sql:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
