import pg from "pg";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.production", "utf-8");
const match = envContent.match(/DATABASE_URL=(.+)/);
const connectionString = match ? match[1].trim() : "";

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const r = await client.query(`
    SELECT co.name, c.name AS city, r.name AS region
    FROM communes co
    JOIN cities c ON c.id = co.city_id
    JOIN regions r ON r.id = c.region_id
    WHERE r.country_id = '9b8807b5-0af1-4331-b576-3b09b6a1db31'
      AND (unaccent(lower(co.name)) LIKE unaccent(lower('%llay%'))
           OR unaccent(lower(co.name)) LIKE unaccent(lower('%rinconada%')))
    ORDER BY co.name
  `);
  r.rows.forEach(x => console.log(`${x.name} | ${x.city} | ${x.region}`));
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
