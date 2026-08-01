import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.production" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const claimRes = await client.query(
    `SELECT id FROM claims WHERE liquidation_number = 'L-000000048' LIMIT 1`
  );

  if (claimRes.rows.length === 0) {
    console.log("No se encontró el siniestro");
    await client.end();
    return;
  }

  const claimId = claimRes.rows[0].id;

  for (const table of ["claim_documents", "claim_action_documents"]) {
    const urlCol = table === "claim_documents" ? "document_url" : "file_url";
    try {
      const res = await client.query(
        `SELECT id, ${urlCol} AS url, file_path, original_filename, mime_type FROM ${table}
         WHERE claim_id = $1
           AND (LOWER(${urlCol}) LIKE '%.heic' OR LOWER(${urlCol}) LIKE '%.heif'
                OR LOWER(file_path) LIKE '%.heic' OR LOWER(file_path) LIKE '%.heif'
                OR LOWER(original_filename) LIKE '%.heic' OR LOWER(original_filename) LIKE '%.heif'
                OR LOWER(mime_type) LIKE '%heic%' OR LOWER(mime_type) LIKE '%heif%')
         LIMIT 100`,
        [claimId]
      );
      console.log(`\nTabla ${table} (${res.rows.length} registros):`);
      for (const row of res.rows) {
        console.log(`  ${row.id}: url=${row.url} file_path=${row.file_path} name=${row.original_filename}`);
      }
    } catch (err) {
      console.error(`Error en ${table}:`, (err as Error).message);
    }
  }

  await client.end();
}

main();
