import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync } from "fs";
import { createHash } from "crypto";

// Cargar .env.local primero (estándar Next.js), luego .env como fallback
const envPath = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ Error: DATABASE_URL no está configurada.\n" +
      "   Agrega la connection string de PostgreSQL en .env.local:\n" +
      '   DATABASE_URL="postgres://user:password@host:port/database"\n' +
      "   (La encuentras en Supabase Dashboard → Project Settings → Database)"
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
  const isLocalhost = ["127.0.0.1", "localhost"].includes(
    new URL(DATABASE_URL!).hostname
  );

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL (Supabase)\n");

    // Crear tabla de tracking si no existe (con checksum para detectar drift)
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Asegurar columna checksum en tablas existentes previas
    await client.query(`
      ALTER TABLE _migrations ADD COLUMN IF NOT EXISTS checksum TEXT
    `);

    // Obtener migraciones ya ejecutadas con su checksum
    const executedRes = await client.query('SELECT filename, checksum FROM _migrations');
    const executed = new Map<string, string | null>(executedRes.rows.map(r => [r.filename, r.checksum]));

    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("⚠️  No se encontraron archivos .sql en migrations/");
      return;
    }

    function fileChecksum(path: string): string {
      return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex");
    }

    const legacy: string[] = []; // ejecutadas sin checksum → solo actualizar
    const pending = files.filter(f => {
      const recorded = executed.get(f);
      if (recorded === undefined) return true; // nunca ejecutada
      const current = fileChecksum(join(migrationsDir, f));
      if (recorded === null) {
        legacy.push(f);
        return false;
      }
      return recorded !== current; // cambió desde la última ejecución
    });

    if (pending.length === 0) {
      console.log(`📂 Migraciones encontradas: ${files.length}`);
      console.log("✅ Todas las migraciones ya están ejecutadas.");
      console.log("\n📋 Próximo paso:");
      console.log(
        "   Ve a Hasura Console → Data → 'Track All' para exponer las tablas en GraphQL."
      );
      return;
    }

    // Actualizar checksums de migraciones legacy (ejecutadas antes de este tracking)
    for (const file of legacy) {
      const filePath = join(migrationsDir, file);
      const checksum = fileChecksum(filePath);
      await client.query('UPDATE _migrations SET checksum = $2 WHERE filename = $1', [file, checksum]);
    }

    console.log(`📂 Migraciones encontradas: ${files.length}`);
    console.log(`   Ejecutadas: ${executed.size}`);
    console.log(`   Legacy actualizando checksum: ${legacy.length}`);
    console.log(`   Pendientes o modificadas: ${pending.length}\n`);

    // Preprocesa una migración para hacer idempotentes las sentencias que
    // no lo son por defecto (CREATE POLICY, ADD CONSTRAINT), evitando fallas
    // cuando el schema local ya las tiene aplicadas.
    function makeIdempotent(migrationSql: string): string {
      // CREATE POLICY <name> ON <table>  -> DROP POLICY IF EXISTS ...
      let sql = migrationSql.replace(
        /CREATE POLICY\s+(?:"([^"]+)"|([^\s(]+))\s+ON\s+(\S+)/g,
        (match, quotedName, unquotedName, table) => {
          const name = quotedName ? `"${quotedName}"` : unquotedName;
          return `DROP POLICY IF EXISTS ${name} ON ${table};\n${match}`;
        }
      );

      // ALTER TABLE <table> ADD CONSTRAINT <name> -> DROP CONSTRAINT IF EXISTS ...
      sql = sql.replace(
        /ALTER TABLE\s+(\S+)\s+ADD CONSTRAINT\s+([^\s(]+)/g,
        (match, table, name) => {
          return `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name};\n${match}`;
        }
      );

      return sql;
    }

    for (const file of pending) {
      const filePath = join(migrationsDir, file);
      const rawSql = readFileSync(filePath, "utf-8");
      const sql = makeIdempotent(rawSql);
      const checksum = fileChecksum(filePath);

      console.log(`⏳ Ejecutando: ${file} ...`);
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, executed_at = NOW()',
        [file, checksum]
      );
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
          "   4. El acceso público no está habilitado en Supabase Dashboard.\n\n" +
          "   Solución: Copia exactamente la Connection String de Supabase Dashboard → Project Settings → Database."
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
