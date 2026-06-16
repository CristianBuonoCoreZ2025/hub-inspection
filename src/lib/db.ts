import { Client } from "pg";

export async function query(sql: string, params?: unknown[]) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result;
  } finally {
    await client.end();
  }
}

export async function getUserProfile(userId: string) {
  const result = await query(
    `SELECT id, company_id, role, full_name FROM profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}
