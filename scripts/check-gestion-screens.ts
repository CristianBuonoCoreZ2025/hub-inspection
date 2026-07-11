import { Pool } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const r = await pool.query("SELECT code, name, description FROM gestion_screens ORDER BY sort_order");
    console.log("gestion_screens rows:", r.rows);
  } catch (e) {
    console.error("Error:", e);
  }
  await pool.end();
})();
