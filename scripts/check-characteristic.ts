import { Pool } from 'pg';

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'characteristic' ORDER BY ordinal_position");
  console.log("Columns in characteristic:");
  for (const row of r.rows) {
    console.log("-", row.column_name);
  }
  await pool.end();
})();
