import { Client } from "pg";
import bcrypt from "bcrypt";

let clientInstance: Client | null = null;

function getClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    clientInstance.connect().catch(console.error);
  }
  return clientInstance;
}

/**
 * Genera un código de reset de 6 dígitos y lo guarda en la BD.
 */
export async function generateResetCode(email: string): Promise<string> {
  const client = getClient();
  const res = await client.query("SELECT generate_reset_code($1)", [email]);
  return res.rows[0].generate_reset_code;
}

/**
 * Valida un código de reset. Si es válido, lo marca como usado.
 */
export async function validateResetCode(email: string, code: string): Promise<boolean> {
  const client = getClient();
  const res = await client.query("SELECT validate_reset_code($1, $2)", [email, code]);
  return res.rows[0].validate_reset_code;
}

/**
 * Cambia la contraseña del usuario actualizando password_hash directamente
 * en auth.users usando bcrypt (mismo formato que usa Hasura Auth).
 */
export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  // Hashear la contraseña con bcrypt (cost factor 10, mismo que usa Hasura Auth)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  const client = getClient();
  await client.query(
    "UPDATE auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hashedPassword, userId]
  );
}

/**
 * Obtiene el user_id de un perfil por email.
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const client = getClient();
  const res = await client.query(
    "SELECT user_id FROM profiles WHERE email = $1 AND is_active = true LIMIT 1",
    [email]
  );
  return res.rows[0]?.user_id || null;
}
