import { createServerClient } from "@/lib/supabase/server";

/**
 * Obtiene el usuario autenticado actual desde la sesión.
 * Devuelve { id, email } o null si no hay sesión.
 */
export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email || "" };
}

/**
 * Obtiene el usuario autenticado actual o lanza error 401.
 */
export async function requireCurrentUser(): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("No autenticado") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}
