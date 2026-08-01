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
    `SELECT c.id FROM claims c WHERE c.liquidation_number = 'L-000000048' LIMIT 1`
  );

  if (claimRes.rows.length === 0) {
    console.log("No se encontró el siniestro");
    await client.end();
    return;
  }

  const claimId = claimRes.rows[0].id;

  const res = await client.query(
    `
    UPDATE inspection_evidences
    SET type = 'photo',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{mimeType}',
          to_jsonb('image/jpeg'::text)
        )
    FROM inspection_sessions s
    WHERE inspection_evidences.session_id = s.id
      AND s.claim_id = $1
      AND (LOWER(inspection_evidences.url) LIKE '%.jpg' OR LOWER(inspection_evidences.url) LIKE '%.jpeg')
      AND (inspection_evidences.metadata ->> 'converted_from' = 'heic'
           OR LOWER(inspection_evidences.metadata::text) LIKE '%heic%')
    RETURNING inspection_evidences.id, inspection_evidences.url, inspection_evidences.type, inspection_evidences.metadata
    `,
    [claimId]
  );

  console.log(`Actualizadas ${res.rows.length} evidencias:`);
  for (const row of res.rows) {
    console.log(`  ${row.id}: type=${row.type} mime=${row.metadata?.mimeType}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
