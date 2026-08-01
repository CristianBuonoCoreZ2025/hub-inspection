import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.production" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const sessionRes = await client.query(
    `SELECT s.id FROM inspection_sessions s
     JOIN claims c ON c.id = s.claim_id
     WHERE c.liquidation_number = 'L-000000048'
     LIMIT 1`
  );

  if (sessionRes.rows.length === 0) {
    console.log("No se encontró sesión");
    await client.end();
    return;
  }

  const sessionId = sessionRes.rows[0].id;

  const res = await client.query(
    `SELECT id, url, metadata FROM inspection_evidences
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [sessionId]
  );

  console.log(`Evidencias de sesión ${sessionId}:`);
  for (const row of res.rows) {
    console.log(`- ${row.id}: ${row.url}`);
  }

  const heicRes = await client.query(
    `SELECT COUNT(*) FROM inspection_evidences
     WHERE session_id = $1
       AND (LOWER(url) LIKE '%.heic' OR LOWER(url) LIKE '%.heif')`,
    [sessionId]
  );

  console.log(`\nEvidencias HEIC restantes: ${heicRes.rows[0].count}`);

  await client.end();
}

main();
