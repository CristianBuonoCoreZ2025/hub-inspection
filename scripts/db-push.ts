import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { config } from "dotenv";

config();

const DATABASE_URL =
  process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ Error: DATABASE_URL no está configurada.\n" +
      "   Agrega la connection string de PostgreSQL en un archivo .env:\n" +
      '   DATABASE_URL="postgres://user:password@host:port/database"\n' +
      "   (La encuentras en Nhost Console → Settings → Database)"
  );
  process.exit(1);
}

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL (Nhost)\n");

    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("⚠️  No se encontraron archivos .sql en migrations/");
      return;
    }

    console.log(`📂 Migraciones encontradas: ${files.length}\n`);

    for (const file of files) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`⏳ Ejecutando: ${file} ...`);
      await client.query(sql);
      console.log(`✅ ${file} ejecutado correctamente\n`);
    }

    console.log("🎉 ¡Todas las migraciones se ejecutaron exitosamente!");
    console.log("\n📋 Próximo paso:");
    console.log("   Ve a Hasura Console → Data → 'Track All' para exponer las tablas en GraphQL.");
  } catch (err: any) {
    console.error("\n❌ Error ejecutando migraciones:\n", err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
