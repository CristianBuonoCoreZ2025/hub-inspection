import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const r = await client.query(`
    SELECT cs.code, cs.name AS status, count(*) AS total
    FROM claims c
    LEFT JOIN lookup_catalog cs ON cs.id = c.status_id
    GROUP BY cs.code, cs.name
    ORDER BY total DESC
  `);
  r.rows.forEach(x => console.log(`${x.code || "(sin código)"} | ${x.status || "(sin estado)"}: ${x.total}`));
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
