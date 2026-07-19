import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Servicio de reseteo de contraseña.
 *
 * Usa el Supabase admin client (service role) para:
 * - Generar códigos de reset de 6 dígitos
 * - Validar códigos
 * - Cambiar contraseñas via admin API
 * - Buscar usuarios por email
 *
 * Antes usaba pg + bcrypt directo a la BD, pero eso no funcionaba
 * en Vercel (DATABASE_URL no configurado, bcrypt binary issues).
 */

/**
 * Genera un código de reset de 6 dígitos y lo guarda en la BD.
 */
export async function generateResetCode(email: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("generate_reset_code", { p_email: email });
  if (error) {
    logger.error("generateResetCode error", new Error(error.message), {
      component: "password-reset",
      action: "generateResetCode",
    });
    throw new Error(error.message);
  }
  return data as string;
}

/**
 * Valida un código de reset. Si es válido, lo marca como usado.
 */
export async function validateResetCode(email: string, code: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("validate_reset_code", {
    p_email: email,
    p_code: code,
  });
  if (error) {
    logger.error("validateResetCode error", new Error(error.message), {
      component: "password-reset",
      action: "validateResetCode",
    });
    return false;
  }
  return data as boolean;
}

/**
 * Cambia la contraseña del usuario usando Supabase admin API.
 */
export async function changeUserPassword(userId: string, newPassword: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) {
    logger.error("changeUserPassword error", new Error(error.message), {
      component: "password-reset",
      action: "changeUserPassword",
    });
    throw new Error(error.message);
  }
}

/**
 * Obtiene el user_id de un perfil por email.
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("getUserIdByEmail error", new Error(error.message), {
      component: "password-reset",
      action: "getUserIdByEmail",
    });
    return null;
  }

  return data?.user_id || null;
}
