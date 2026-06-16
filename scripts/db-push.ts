import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync } from "fs";

// Cargar .env.local primero (estándar Next.js), luego .env como fallback
const envPath = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envPath });

const DATABASE_URL =
  process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ Error: DATABASE_URL no está configurada.\n" +
      "   Agrega la connection string de PostgreSQL en .env.local:\n" +
      '   DATABASE_URL="postgres://user:password@host:port/database"\n' +
      "   (La encuentras en Nhost Console → Settings → Database)"
  );
  process.exit(1);
}

// Debug: mostrar host (sin credenciales)
function extractHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}`;
  } catch {
    return "(URL inválida)";
  }
}

console.log(`🔍 Intentando conectar a: ${extractHost(DATABASE_URL)}\n`);

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

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
    console.log(
      "   Ve a Hasura Console → Data → 'Track All' para exponer las tablas en GraphQL."
    );
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ENOTFOUND") {
      console.error(
        `\n❌ Error: No se puede resolver el host '${extractHost(DATABASE_URL!)}'.\n` +
          "   Posibles causas:\n" +
          "   1. El hostname en .env.local está mal escrito.\n" +
          "   2. El acceso público aún no se propagó por DNS (espera 2-5 min).\n" +
          "   3. Firewall o restricción de red en tu computador.\n" +
          "   4. El acceso público no está habilitado en Nhost Console.\n\n" +
          "   Solución: Copia exactamente la Connection String de Nhost Console → Settings → Database."
      );
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        `\n❌ Error: Conexión rechazada a '${extractHost(DATABASE_URL!)}'.\n` +
          "   Posibles causas:\n" +
          "   1. Puerto incorrecto.\n" +
          "   2. Acceso público deshabilitado.\n" +
          "   3. Contraseña incorrecta."
      );
    } else if (error.code === "28P01") {
      console.error(
        `\n❌ Error: Autenticación fallida.\n` +
          "   Verifica que el usuario y la contraseña sean correctos."
      );
    } else {
      console.error("\n❌ Error ejecutando migraciones:\n", error.message || err);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
